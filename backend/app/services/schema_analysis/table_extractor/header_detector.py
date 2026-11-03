"""Multi-Signal Header Detector for tabular data regions."""

import datetime
import logging
from typing import Any

import pandas as pd

from app.services.schema_analysis.table_extractor.models import (
    HeaderDetectionResult,
    HeaderType,
)

logger = logging.getLogger(__name__)


class HeaderDetector:
    """Detects header presence, row boundaries, and multi-level structures using multi-signal scoring."""

    SCORE_THRESHOLD_HEADER = 0.55
    SCORE_THRESHOLD_NEEDS_CONFIRM = 0.40

    def detect(
        self,
        dataframe: pd.DataFrame,
        merged_ranges: list[str] | None = None,
        offset_row: int = 0,
        offset_col: int = 0,
    ) -> HeaderDetectionResult:
        """Analyze a DataFrame region to identify header presence and boundaries."""
        if dataframe.empty or dataframe.shape[0] == 0:
            return HeaderDetectionResult(
                header_type=HeaderType.NO_HEADER,
                header_rows=[],
                header_start_row=None,
                header_end_row=None,
                column_names=[],
                confidence=1.0,
                evidence=["Vùng dữ liệu hoàn toàn rỗng."],
                reasoning="Không có dòng dữ liệu nào để phát hiện header.",
            )

        num_rows, num_cols = dataframe.shape

        # If single row table, evaluate if it's header-only or data-only
        if num_rows == 1:
            row = dataframe.iloc[0]
            non_empty = [v for v in row if not self._is_missing(v)]
            text_count = sum(self._is_text_label(v) for v in non_empty)
            if non_empty and (text_count / len(non_empty)) >= 0.7:
                return HeaderDetectionResult(
                    header_type=HeaderType.SINGLE_ROW_HEADER,
                    header_rows=[0],
                    header_start_row=0,
                    header_end_row=0,
                    column_names=self._build_single_row_names(row),
                    confidence=0.7,
                    evidence=["Chỉ có 1 dòng dữ liệu, chứa đa số các chuỗi văn bản."],
                    reasoning="Bảng chỉ chứa duy nhất một dòng tiêu đề.",
                )
            return HeaderDetectionResult(
                header_type=HeaderType.NO_HEADER,
                header_rows=[],
                header_start_row=None,
                header_end_row=None,
                column_names=[f"Column_{i + 1}" for i in range(num_cols)],
                confidence=0.75,
                evidence=["Chỉ có 1 dòng dữ liệu và không mang đặc trưng tiêu đề."],
                reasoning="Không phát hiện dòng tiêu đề cột.",
            )

        # In a multi-row table, header must be located near the top (never the bottom row)
        if num_rows == 2:
            candidate_count = 1  # Only row 0 can be header
        elif num_rows <= 5:
            candidate_count = num_rows - 1  # Cannot be the very last row
        else:
            candidate_count = min(num_rows - 2, 8)

        row_scores: list[dict[str, Any]] = []
        for r in range(candidate_count):
            score_data = self._evaluate_row_as_header(dataframe, r)
            row_scores.append(score_data)

        if not row_scores:
            return HeaderDetectionResult(
                header_type=HeaderType.NO_HEADER,
                header_rows=[],
                column_names=[f"Column_{i + 1}" for i in range(num_cols)],
                confidence=0.8,
                evidence=["Không có dòng nào đạt tiêu chí header."],
            )

        # Sort by score descending
        sorted_scores = sorted(row_scores, key=lambda x: x["score"], reverse=True)
        best = sorted_scores[0]
        best_row = best["row_index"]
        best_score = best["score"]

        # Case 1: Definite NO_HEADER
        if best_score < self.SCORE_THRESHOLD_NEEDS_CONFIRM:
            col_names = [f"Column_{i + 1}" for i in range(num_cols)]
            return HeaderDetectionResult(
                header_type=HeaderType.NO_HEADER,
                header_rows=[],
                header_start_row=None,
                header_end_row=None,
                column_names=col_names,
                confidence=round(max(0.7, 1.0 - best_score), 2),
                evidence=[
                    f"Điểm số header cao nhất chỉ đạt {best_score:.2f} (< {self.SCORE_THRESHOLD_NEEDS_CONFIRM}).",
                    "Các dòng đầu đều mang đặc trưng của dữ liệu thay vì tiêu đề cột.",
                ],
                reasoning="Không tìm thấy dòng tiêu đề cột đáng tin cậy; dữ liệu bắt đầu ngay từ dòng đầu.",
            )

        # Case 2: Ambiguous signals -> NEEDS_CONFIRMATION
        if self.SCORE_THRESHOLD_NEEDS_CONFIRM <= best_score < self.SCORE_THRESHOLD_HEADER:
            col_names = self._build_single_row_names(dataframe.iloc[best_row])
            evidence = list(best["evidence"])
            evidence.append(
                f"Độ tin cậy nằm trong vùng nghi vấn ({best_score:.2f} trong [{self.SCORE_THRESHOLD_NEEDS_CONFIRM}, {self.SCORE_THRESHOLD_HEADER}])."
            )
            return HeaderDetectionResult(
                header_type=HeaderType.NEEDS_CONFIRMATION,
                header_rows=[best_row],
                header_start_row=best_row,
                header_end_row=best_row,
                column_names=col_names,
                confidence=round(best_score, 2),
                evidence=evidence,
                warnings=[
                    f"Cần người dùng xác nhận: Dòng {best_row + 1} có khả năng là header nhưng độ tin cậy chưa tuyệt đối ({best_score:.2f})."
                ],
                reasoning="Tín hiệu tiêu đề chưa đủ mạnh để tự động kết luận mà không có xác nhận.",
            )

        # Case 3: best_score >= SCORE_THRESHOLD_HEADER -> Check for MULTI_ROW_HEADER
        is_multi_row, multi_rows, multi_names, multi_levels = self._check_multi_row_header(
            dataframe=dataframe,
            best_header_row=best_row,
            merged_ranges=merged_ranges or [],
            offset_row=offset_row,
            offset_col=offset_col,
        )

        if is_multi_row:
            evidence = list(best["evidence"])
            evidence.append(
                f"Phát hiện tiêu đề phân cấp {len(multi_rows)} dòng: {', '.join(str(r + 1) for r in multi_rows)}."
            )
            return HeaderDetectionResult(
                header_type=HeaderType.MULTI_ROW_HEADER,
                header_rows=multi_rows,
                header_start_row=multi_rows[0],
                header_end_row=multi_rows[-1],
                column_names=multi_names,
                header_levels=multi_levels,
                confidence=round(min(0.95, best_score + 0.05), 2),
                evidence=evidence,
                reasoning="Cấu trúc tiêu đề gồm nhiều tầng kết hợp ô gộp hoặc các nhóm chỉ tiêu con.",
            )

        # Case 4: SINGLE_ROW_HEADER
        col_names = self._build_single_row_names(dataframe.iloc[best_row])
        return HeaderDetectionResult(
            header_type=HeaderType.SINGLE_ROW_HEADER,
            header_rows=[best_row],
            header_start_row=best_row,
            header_end_row=best_row,
            column_names=col_names,
            header_levels=[col_names],
            confidence=round(best_score, 2),
            evidence=best["evidence"],
            reasoning=f"Dòng {best_row + 1} có đặc trưng tiêu đề cột vượt trội (điểm: {best_score:.2f}).",
        )

    def _evaluate_row_as_header(self, df: pd.DataFrame, r: int) -> dict[str, Any]:
        """Score row r based on 5 structural signals."""
        row = df.iloc[r]
        num_cols = len(row)
        values = [v for v in row if not self._is_missing(v)]

        if not values:
            return {
                "row_index": r,
                "score": 0.0,
                "evidence": ["Dòng hoàn toàn rỗng."],
            }

        # 1. Density Score
        density = len(values) / max(num_cols, 1)

        # 2. Text / String Label Score
        text_count = sum(self._is_text_label(v) for v in values)
        text_ratio = text_count / len(values)

        # If a row has fewer than 50% text labels, it cannot be a header!
        if text_ratio < 0.5:
            return {
                "row_index": r,
                "score": 0.0,
                "density": density,
                "text_ratio": text_ratio,
                "unique_ratio": 0.0,
                "type_shift": 0.0,
                "evidence": [f"Dòng {r + 1}: Chứa ít hơn 50% nhãn văn bản (Điểm=0.00)."],
            }

        # 3. Uniqueness Score (headers should have unique column names)
        str_values = [str(v).strip().casefold() for v in values]
        unique_ratio = len(set(str_values)) / len(values)

        # 4. Type Shift Gradient (Contrast with rows below)
        type_shift, ambiguity_penalty = self._calculate_type_shift_and_ambiguity(df, r)

        # 5. Report Title Penalty
        title_penalty = 0.0
        if len(values) == 1 and num_cols >= 2:
            title_penalty = 0.45
        elif len(values) <= 2 and num_cols >= 4:
            title_penalty = 0.35
        elif len(values) > 0 and any(len(str(v).strip()) > 40 for v in values) and density < 0.5:
            title_penalty = 0.30

        # Weighted combination
        score = (
            0.25 * density
            + 0.35 * text_ratio
            + 0.15 * unique_ratio
            + 0.25 * type_shift
            - title_penalty
            - ambiguity_penalty
        )
        score = max(0.0, min(1.0, score))

        evidence = [
            f"Dòng {r + 1}: Mật độ ô={density:.2f}, Tỷ lệ text={text_ratio:.2f}, "
            f"Tính duy nhất={unique_ratio:.2f}, Type shift={type_shift:.2f}, "
            f"Điểm={score:.2f}"
        ]
        if title_penalty > 0:
            evidence.append(f"Áp dụng phạt tiêu đề báo cáo (-{title_penalty:.2f}).")
        if ambiguity_penalty > 0:
            evidence.append(f"Áp dụng phạt trùng lặp hình thái dữ liệu với các dòng dưới (-{ambiguity_penalty:.2f}).")

        return {
            "row_index": r,
            "score": score,
            "density": density,
            "text_ratio": text_ratio,
            "unique_ratio": unique_ratio,
            "type_shift": type_shift,
            "evidence": evidence,
        }

    def _calculate_type_shift_and_ambiguity(
        self, df: pd.DataFrame, r: int
    ) -> tuple[float, float]:
        """Measure contrast and structural homogeneity between candidate row r and following data rows."""
        rows_below = df.iloc[r + 1 : min(r + 6, len(df))]
        if rows_below.empty:
            return 0.1, 0.0

        shifts: list[float] = []
        is_identical_alphanumeric_pattern = True

        for c in range(df.shape[1]):
            val = df.iloc[r, c]
            is_r_text = not self._is_missing(val) and self._is_text_label(val)
            below_vals = [
                v for v in rows_below.iloc[:, c] if not self._is_missing(v)
            ]
            if not below_vals:
                continue

            below_numeric_ratio = sum(self._looks_like_number(v) for v in below_vals) / len(below_vals)

            if is_r_text and below_numeric_ratio >= 0.7:
                # Strong signal: Header is text, all data below is numeric!
                shifts.append(1.0)
                is_identical_alphanumeric_pattern = False
            elif is_r_text and below_numeric_ratio < 0.3:
                # Both row r and below are text/strings.
                val_str = str(val).strip()
                if self._is_short_code(val_str) and all(self._is_short_code(str(bv).strip()) for bv in below_vals):
                    shifts.append(0.1)
                else:
                    shifts.append(0.2)
                    is_identical_alphanumeric_pattern = False
            elif not is_r_text and below_numeric_ratio >= 0.7:
                # Both row r and data below are numeric -> NOT a header
                shifts.append(0.0)
                is_identical_alphanumeric_pattern = False
            else:
                shifts.append(0.4)
                is_identical_alphanumeric_pattern = False

        if not shifts:
            return 0.1, 0.0

        avg_shift = sum(shifts) / len(shifts)
        ambiguity_penalty = 0.40 if is_identical_alphanumeric_pattern else 0.0
        return avg_shift, ambiguity_penalty

    def _is_short_code(self, s: str) -> bool:
        """Check if string is a short alphanumeric code like '12A', '99B'."""
        if len(s) > 6:
            return False
        has_digit = any(ch.isdigit() for ch in s)
        has_alpha = any(ch.isalpha() for ch in s)
        return has_digit and has_alpha

    def _check_multi_row_header(
        self,
        dataframe: pd.DataFrame,
        best_header_row: int,
        merged_ranges: list[str],
        offset_row: int,
        offset_col: int,
    ) -> tuple[bool, list[int], list[str], list[list[str]]]:
        """Examine if best_header_row forms a multi-level header with adjacent rows."""
        num_rows = len(dataframe)

        # Check pair (best_header_row - 1, best_header_row) if best_header_row > 0
        if best_header_row > 0:
            r_top = best_header_row - 1
            r_sub = best_header_row
            is_multi, rows, names, levels = self._evaluate_header_pair(
                dataframe, r_top, r_sub, merged_ranges, offset_row
            )
            if is_multi:
                return True, rows, names, levels

        # Check pair (best_header_row, best_header_row + 1) if best_header_row + 1 < num_rows
        if best_header_row + 1 < num_rows:
            r_top = best_header_row
            r_sub = best_header_row + 1
            is_multi, rows, names, levels = self._evaluate_header_pair(
                dataframe, r_top, r_sub, merged_ranges, offset_row
            )
            if is_multi:
                return True, rows, names, levels

        return False, [], [], []

    def _evaluate_header_pair(
        self,
        dataframe: pd.DataFrame,
        r1: int,
        r2: int,
        merged_ranges: list[str],
        offset_row: int,
    ) -> tuple[bool, list[int], list[str], list[list[str]]]:
        row1 = dataframe.iloc[r1]
        row2 = dataframe.iloc[r2]

        vals1 = [v for v in row1 if not self._is_missing(v)]
        vals2 = [v for v in row2 if not self._is_missing(v)]

        if not vals1 or not vals2:
            return False, [], [], []

        abs_r1 = offset_row + r1 + 1
        abs_r2 = offset_row + r2 + 1
        has_merged_signal = False

        for rng in merged_ranges:
            if ":" in rng:
                try:
                    p1, p2 = rng.split(":")
                    r_start = int("".join(ch for ch in p1 if ch.isdigit()))
                    r_end = int("".join(ch for ch in p2 if ch.isdigit()))
                    if (r_start <= abs_r1 <= r_end) or (r_start <= abs_r2 <= r_end):
                        has_merged_signal = True
                        break
                except Exception:
                    pass

        # A single-cell text row (like 'BÁO CÁO DOANH THU') is an isolated title banner, NOT a multi-row group header
        if len(vals1) <= 1 and not has_merged_signal:
            return False, [], [], []

        text1_ratio = sum(self._is_text_label(v) for v in vals1) / len(vals1)
        text2_ratio = sum(self._is_text_label(v) for v in vals2) / len(vals2)

        if text1_ratio < 0.5 or text2_ratio < 0.5:
            return False, [], [], []

        if has_merged_signal or (len(vals1) < len(vals2) and text1_ratio >= 0.7 and text2_ratio >= 0.7):
            multi_rows = [r1, r2]
            level1 = [str(v).strip() if not self._is_missing(v) else "" for v in row1]
            level2 = [str(v).strip() if not self._is_missing(v) else "" for v in row2]
            header_levels = [level1, level2]

            combined_names: list[str] = []
            last_top = ""
            for c in range(len(row1)):
                top = level1[c]
                sub = level2[c]
                if top:
                    last_top = top
                current_top = top or last_top

                if current_top and sub and current_top != sub:
                    name = f"{current_top}_{sub}"
                elif sub:
                    name = sub
                elif current_top:
                    name = current_top
                else:
                    name = f"Unnamed_{c + 1}"
                combined_names.append(name)

            return True, multi_rows, combined_names, header_levels

        return False, [], [], []

    def _build_single_row_names(self, row: pd.Series) -> list[str]:
        names: list[str] = []
        for i, val in enumerate(row):
            if self._is_missing(val):
                names.append(f"Unnamed_{i + 1}")
            else:
                names.append(str(val).strip().replace("\n", " "))
        return names

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

    @staticmethod
    def _looks_like_number(value: object) -> bool:
        if isinstance(value, (int, float)) and not isinstance(value, bool):
            return True
        if isinstance(value, str):
            cleaned = value.replace(",", "").replace("%", "").strip()
            try:
                float(cleaned)
                return True
            except ValueError:
                return False
        return False

    @staticmethod
    def _looks_like_date(value: object) -> bool:
        if isinstance(value, (pd.Timestamp, datetime.date, datetime.datetime)):
            return True
        if isinstance(value, str):
            clean = value.strip()
            if any(sep in clean for sep in ["-", "/"]) and any(ch.isdigit() for ch in clean):
                parts = clean.replace("/", "-").split("-")
                if len(parts) == 3 and all(p.isdigit() for p in parts):
                    return True
                try:
                    if pd.notna(pd.to_datetime(clean, errors="coerce")):
                        return True
                except Exception:
                    pass
        return False

    def _is_text_label(self, value: object) -> bool:
        if self._is_missing(value):
            return False
        if isinstance(value, str):
            val_clean = value.strip()
            if self._looks_like_number(val_clean) or self._looks_like_date(val_clean):
                return False
            return len(val_clean) > 0
        return False


header_detector = HeaderDetector()
