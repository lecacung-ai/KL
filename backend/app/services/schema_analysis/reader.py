"""Read raw CSV and Excel files without modifying their structure."""

import csv
from dataclasses import dataclass, field
from pathlib import Path
from typing import TextIO

import pandas as pd


@dataclass
class SheetData:
    """Raw data for one worksheet or CSV file."""

    name: str
    position: int
    dataframe: pd.DataFrame


@dataclass
class ReaderMetadata:
    """Information about how the source file was read."""

    file_type: str
    file_size_bytes: int
    encoding: str | None = None
    delimiter: str | None = None
    has_bom: bool = False
    warnings: list[str] = field(default_factory=list)


@dataclass
class LoadedDataset:
    """Raw dataset returned by the reader."""

    filename: str
    sheets: list[SheetData]
    metadata: ReaderMetadata


class DataReader:
    """Read supported files while preserving their original tabular layout."""

    SUPPORTED_EXTENSIONS = {".csv", ".xlsx", ".xls"}

    ENCODING_CANDIDATES = (
        "utf-8-sig",
        "utf-8",
        "cp1258",
        "cp1252",
    )

    DELIMITER_CANDIDATES = (",", ";", "\t", "|")

    def read(
        self,
        file_path: str | Path,
        encoding: str | None = None,
        delimiter: str | None = None,
    ) -> LoadedDataset:
        path = Path(file_path)

        if not path.exists() or not path.is_file():
            raise FileNotFoundError(f"File không tồn tại: {path}")

        extension = path.suffix.lower()

        if extension not in self.SUPPORTED_EXTENSIONS:
            raise ValueError(f"Định dạng file không được hỗ trợ: {extension}")

        if extension == ".csv":
            return self._read_csv(path, encoding, delimiter)

        return self._read_excel(path)

    def _read_csv(
        self,
        path: Path,
        encoding: str | None,
        delimiter: str | None,
    ) -> LoadedDataset:
        warnings: list[str] = []
        has_bom = self._has_utf8_bom(path)

        selected_encoding = encoding or self._detect_encoding(path)

        if selected_encoding is None:
            raise UnicodeError(
                "Không xác định được encoding. "
                "Hãy cung cấp encoding tường minh khi gọi reader."
            )

        if encoding is None and selected_encoding in {
            "cp1258",
            "cp1252",
            "latin1",
        }:
            warnings.append(
                f"CSV được đọc bằng {selected_encoding}. "
                "Cần kiểm tra lại văn bản để tránh lỗi giải mã ký tự."
            )

        with path.open(
            "r",
            encoding=selected_encoding,
            errors="strict",
            newline="",
        ) as text_file:
            sample = text_file.read(8192)
            text_file.seek(0)

            selected_delimiter = delimiter or self._detect_delimiter(sample)

            if selected_delimiter is None:
                selected_delimiter = ","
                warnings.append(
                    "Không nhận diện chắc chắn được delimiter; "
                    "tạm thời sử dụng dấu phẩy."
                )

            dataframe = pd.read_csv(
                text_file,
                sep=selected_delimiter,
                header=None,
                dtype=object,
                keep_default_na=False,
                skip_blank_lines=False,
                on_bad_lines="error",
            )

        sheet = SheetData(
            name=path.stem,
            position=0,
            dataframe=dataframe,
        )

        metadata = ReaderMetadata(
            file_type="csv",
            file_size_bytes=path.stat().st_size,
            encoding=selected_encoding,
            delimiter=selected_delimiter,
            has_bom=has_bom,
            warnings=warnings,
        )

        return LoadedDataset(
            filename=path.name,
            sheets=[sheet],
            metadata=metadata,
        )

    def _read_excel(self, path: Path) -> LoadedDataset:
        try:
            raw_sheets = pd.read_excel(
                path,
                sheet_name=None,
                header=None,
                dtype=object,
                keep_default_na=False,
            )
        except ImportError as exc:
            raise RuntimeError(
                "Thiếu thư viện đọc Excel. "
                "Hãy kiểm tra engine tương ứng với định dạng file."
            ) from exc

        sheets = [
            SheetData(
                name=sheet_name,
                position=position,
                dataframe=dataframe,
            )
            for position, (sheet_name, dataframe) in enumerate(
                raw_sheets.items()
            )
        ]

        metadata = ReaderMetadata(
            file_type=path.suffix.lower().lstrip("."),
            file_size_bytes=path.stat().st_size,
        )

        return LoadedDataset(
            filename=path.name,
            sheets=sheets,
            metadata=metadata,
        )

    def _detect_encoding(self, path: Path) -> str | None:
        """Try strict decoding; never silently discard invalid bytes."""

        with path.open("rb") as binary_file:
            sample = binary_file.read(65536)

        for candidate in self.ENCODING_CANDIDATES:
            try:
                sample.decode(candidate, errors="strict")
                return candidate
            except UnicodeDecodeError:
                continue

        # Latin-1 can decode nearly any byte sequence, but may produce
        # mojibake. Use it only as a last resort and report a warning.
        try:
            sample.decode("latin1", errors="strict")
            return "latin1"
        except UnicodeDecodeError:
            return None

    def _detect_delimiter(self, sample: str) -> str | None:
        if not sample.strip():
            return None

        try:
            dialect = csv.Sniffer().sniff(
                sample,
                delimiters="".join(self.DELIMITER_CANDIDATES),
            )
            return dialect.delimiter
        except csv.Error:
            return None

    @staticmethod
    def _has_utf8_bom(path: Path) -> bool:
        with path.open("rb") as binary_file:
            return binary_file.read(3) == b"\xef\xbb\xbf"


data_reader = DataReader()