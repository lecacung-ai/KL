"""Table Region Extractor: isolates independent table bounding boxes using spatial projection."""

import logging
from typing import Any

from openpyxl.utils import get_column_letter
import pandas as pd

from app.services.schema_analysis.models.layout import DataLayout
from app.services.schema_analysis.table_extractor.header_detector import (
    HeaderDetector,
    header_detector,
)
from app.services.schema_analysis.table_extractor.layout_classifier import (
    LayoutClassifier,
    layout_classifier,
)
from app.services.schema_analysis.table_extractor.models import (
    HeaderDetectionResult,
    HeaderType,
    SheetStructureAnalysisResult,
    TableRegion,
)

logger = logging.getLogger(__name__)


class TableRegionExtractor:
    """Extracts isolated tabular data regions from worksheets without mutating raw data."""

    def __init__(
        self,
        header_detector_instance: HeaderDetector | None = None,
        layout_classifier_instance: LayoutClassifier | None = None,
    ) -> None:
        self.header_detector = header_detector_instance or header_detector
        self.layout_classifier = layout_classifier_instance or layout_classifier

    def extract_regions(
        self,
        dataframe: pd.DataFrame,
        merged_ranges: list[str] | None = None,
        sheet_name: str = "Sheet1",
        sheet_index: int = 0,
    ) -> SheetStructureAnalysisResult:
        """Discover and segment all independent table regions within a worksheet."""
        if dataframe.empty or dataframe.shape[0] == 0 or dataframe.shape[1] == 0:
            return SheetStructureAnalysisResult(
                sheet_name=sheet_name,
                sheet_index=sheet_index,
                overall_layout=DataLayout.UNKNOWN,
                table_regions=[],
                table_count=0,
                confidence=1.0,
                warnings=[f"Worksheet '{sheet_name}' không có dữ liệu."],
                evidence=["Worksheet hoàn toàn trống."],
                reasoning="Không tìm thấy bảng dữ liệu nào.",
            )

        rows, cols = dataframe.shape

        # Step 1: Find candidate bounding boxes using 2D grid density and separator projections
        raw_boxes = self._segment_bounding_boxes(
            dataframe=dataframe,
            merged_ranges=merged_ranges or [],
        )

        table_regions: list[TableRegion] = []
        warnings: list[str] = []

        table_idx = 1
        for box in raw_boxes:
            r_start, r_end, c_start, c_end = box

            # Extract slice
            sub_df = dataframe.iloc[r_start : r_end + 1, c_start : c_end + 1].copy()
            sub_df.reset_index(drop=True, inplace=True)

            non_empty_cells = sum(
                not self._is_missing(val)
                for val in sub_df.to_numpy().flatten()
            )

            # Ignore tiny orphan 1-cell fragments
            if non_empty_cells < 2:
                continue

            # Check if this box is purely a standalone title or footnote
            if self._is_isolated_banner_or_note(sub_df, cols):
                continue

            # Detect Header for this specific region
            header_res = self.header_detector.detect(
                dataframe=sub_df,
                merged_ranges=merged_ranges,
                offset_row=r_start,
                offset_col=c_start,
            )

            # Classify layout for this specific region
            table_layout = self.layout_classifier.classify_table(
                dataframe=sub_df,
                header_info=header_res,
            )

            coord_range = (
                f"{get_column_letter(c_start + 1)}{r_start + 1}:"
                f"{get_column_letter(c_end + 1)}{r_end + 1}"
            )

            region_warnings: list[str] = list(header_res.warnings)
            region_confidence = header_res.confidence

            region = TableRegion(
                table_id=f"table_{table_idx}",
                start_row=r_start,
                end_row=r_end,
                start_column=c_start,
                end_column=c_end,
                range=coord_range,
                header_info=header_res,
                layout_type=table_layout,
                non_empty_cell_count=non_empty_cells,
                confidence=region_confidence,
                warnings=region_warnings,
            )
            table_regions.append(region)
            table_idx += 1

        # Step 2: Classify overall sheet layout
        overall_layout, sheet_conf, evidence, reasoning = self.layout_classifier.classify_sheet(
            table_regions=table_regions,
            raw_dataframe=dataframe,
        )

        if len(table_regions) > 1:
            warnings.append(
                f"Phát hiện {len(table_regions)} bảng độc lập trên cùng sheet '{sheet_name}'."
            )

        return SheetStructureAnalysisResult(
            sheet_name=sheet_name,
            sheet_index=sheet_index,
            overall_layout=overall_layout,
            table_regions=table_regions,
            table_count=len(table_regions),
            confidence=sheet_conf,
            warnings=warnings,
            evidence=evidence,
            reasoning=reasoning,
        )

    def _segment_bounding_boxes(
        self,
        dataframe: pd.DataFrame,
        merged_ranges: list[str],
    ) -> list[tuple[int, int, int, int]]:
        """Identify discrete rectangular data clusters separated by blank rows and columns."""
        rows, cols = dataframe.shape

        # Construct binary occupancy mask
        occupied = [[False] * cols for _ in range(rows)]
        for r in range(rows):
            for c in range(cols):
                val = dataframe.iloc[r, c]
                if not self._is_missing(val):
                    occupied[r][c] = True

        # Expand mask for merged ranges to maintain bridge connectivity
        for rng in merged_ranges:
            if ":" in rng:
                try:
                    c1, r1, c2, r2 = self._parse_range(rng)
                    for r in range(max(0, r1), min(rows, r2 + 1)):
                        for c in range(max(0, c1), min(cols, c2 + 1)):
                            occupied[r][c] = True
                except Exception:
                    pass

        # 1. Vertical Splitting: Group consecutive non-empty rows into horizontal bands
        horizontal_bands: list[tuple[int, int]] = []
        in_band = False
        band_start = 0

        for r in range(rows):
            row_has_data = any(occupied[r][c] for c in range(cols))
            if row_has_data and not in_band:
                in_band = True
                band_start = r
            elif not row_has_data and in_band:
                in_band = False
                horizontal_bands.append((band_start, r - 1))

        if in_band:
            horizontal_bands.append((band_start, rows - 1))

        # Merge adjacent bands if the gap is small (<= 2 empty rows) and following band has no independent header/banner
        merged_bands: list[tuple[int, int]] = []
        for band in horizontal_bands:
            if not merged_bands:
                merged_bands.append(band)
                continue

            prev_start, prev_end = merged_bands[-1]
            curr_start, curr_end = band
            gap = curr_start - prev_end - 1

            if gap <= 2:
                curr_slice = dataframe.iloc[curr_start : curr_end + 1]
                is_banner = self._is_isolated_banner_or_note(curr_slice, cols)
                has_own_header = False
                if not is_banner:
                    h_test = self.header_detector.detect(curr_slice)
                    if h_test.header_type in {HeaderType.SINGLE_ROW_HEADER, HeaderType.MULTI_ROW_HEADER} and h_test.confidence >= 0.7:
                        has_own_header = True

                if not is_banner and not has_own_header:
                    merged_bands[-1] = (prev_start, curr_end)
                    continue

            merged_bands.append(band)

        horizontal_bands = merged_bands

        # 2. Horizontal Splitting inside each horizontal band:
        # Check for empty columns separating side-by-side tables
        boxes: list[tuple[int, int, int, int]] = []

        for r_start, r_end in horizontal_bands:
            in_col_block = False
            col_start = 0

            for c in range(cols):
                col_has_data = any(occupied[r][c] for r in range(r_start, r_end + 1))
                if col_has_data and not in_col_block:
                    in_col_block = True
                    col_start = c
                elif not col_has_data and in_col_block:
                    in_col_block = False
                    boxes.append((r_start, r_end, col_start, c - 1))

            if in_col_block:
                boxes.append((r_start, r_end, col_start, cols - 1))

        refined_boxes = self._refine_boxes(boxes, dataframe)
        return refined_boxes

    def _refine_boxes(
        self,
        boxes: list[tuple[int, int, int, int]],
        df: pd.DataFrame,
    ) -> list[tuple[int, int, int, int]]:
        """Trim empty borders within each bounding box to ensure tight boundaries."""
        trimmed_boxes: list[tuple[int, int, int, int]] = []

        for r_start, r_end, c_start, c_end in boxes:
            sub = df.iloc[r_start : r_end + 1, c_start : c_end + 1]

            rows_with_data = [
                i
                for i in range(sub.shape[0])
                if any(not self._is_missing(sub.iloc[i, j]) for j in range(sub.shape[1]))
            ]
            cols_with_data = [
                j
                for j in range(sub.shape[1])
                if any(not self._is_missing(sub.iloc[i, j]) for i in range(sub.shape[0]))
            ]

            if not rows_with_data or not cols_with_data:
                continue

            tight_r_start = r_start + min(rows_with_data)
            tight_r_end = r_start + max(rows_with_data)
            tight_c_start = c_start + min(cols_with_data)
            tight_c_end = c_start + max(cols_with_data)

            trimmed_boxes.append((tight_r_start, tight_r_end, tight_c_start, tight_c_end))

        return trimmed_boxes

    def _is_isolated_banner_or_note(self, sub_df: pd.DataFrame, total_sheet_cols: int) -> bool:
        """Check if a sub-region is purely a report title, note, or metadata banner."""
        rows, cols = sub_df.shape
        if total_sheet_cols < 2:
            return False

        vals = [v for v in sub_df.to_numpy().flatten() if not self._is_missing(v)]
        if not vals:
            return True

        # Case 1: 1 single text cell spanning 1 row while sheet is multi-column
        if rows == 1 and len(vals) == 1:
            return True

        # Case 2: 1 or 2 rows occupying only 1 column (e.g. metadata block in col A like "Đơn vị: ...", "Ngày: ...")
        if cols == 1 and rows <= 2 and total_sheet_cols >= 2:
            return True

        return False

    @staticmethod
    def _parse_range(rng: str) -> tuple[int, int, int, int]:
        """Parse Excel range coordinate like 'B2:D4' into 0-based (c1, r1, c2, r2)."""
        from openpyxl.utils import column_index_from_string

        p1, p2 = rng.split(":")
        c1_str = "".join(ch for ch in p1 if ch.isalpha())
        r1_str = "".join(ch for ch in p1 if ch.isdigit())
        c2_str = "".join(ch for ch in p2 if ch.isalpha())
        r2_str = "".join(ch for ch in p2 if ch.isdigit())

        c1 = column_index_from_string(c1_str) - 1
        r1 = int(r1_str) - 1
        c2 = column_index_from_string(c2_str) - 1
        r2 = int(r2_str) - 1

        return c1, r1, c2, r2

    @staticmethod
    def _is_missing(value: object) -> bool:
        if value is None:
            return True
        try:
            return bool(pd.isna(value)) or (
                isinstance(value, str) and not value.strip()
            )
        except (TypeError, ValueError):
            return False


table_region_extractor = TableRegionExtractor()
