import os
import pandas as pd

# Chuẩn Corey Schafer (Part 9: Cleaning Data): Danh sách các placeholder chuỗi tùy chỉnh thể hiện giá trị khuyết thiếu
CUSTOM_NA_VALUES = [
    "NA", "N/A", "na", "n/a", "NaN", "nan",
    "Missing", "missing", "MISSING",
    "null", "Null", "NULL",
    "-", "--", "---",
    "none", "None", "NONE",
    "?", "unknown", "Unknown",
]


class DataFrameService:
    """Shared service for loading tabular files and identifying their columns."""

    CUSTOM_NA_VALUES = CUSTOM_NA_VALUES

    def load_dataframe(self, file_path: str) -> pd.DataFrame:
        """
        Bộ đọc dữ liệu thông minh cho Excel (.xlsx, .xls) và CSV (.csv):
        - Áp dụng chuẩn Corey Schafer: Thay thế các ký hiệu missing tùy chỉnh (NA, missing, -) thành np.nan
        - Tự động nhận diện dòng tiêu đề thật (Header Detection), bỏ qua các banner tiêu đề báo cáo, dòng trống hoặc logo
        - Tự động xử lý và loại bỏ các cột rỗng (Unnamed: x)
        - Hỗ trợ đa bảng mã Tiếng Việt (UTF-8, UTF-8-SIG, Latin1, CP1258)
        - Loại bỏ cột/dòng hoàn toàn rỗng bằng dropna(axis=..., how='all')
        """
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"Không tìm thấy tệp dữ liệu tại {file_path}")

        ext = os.path.splitext(file_path)[1].lower()

        if ext in [".xlsx", ".xls"]:
            # 1. Đọc thử 25 dòng đầu không header để chấm điểm dòng nào là Header thật
            try:
                raw = pd.read_excel(file_path, header=None, nrows=25, na_values=CUSTOM_NA_VALUES)
            except Exception as e:
                raise ValueError(f"Không thể mở tệp Excel: {str(e)}")

            best_row = 0
            max_text_cols = 0

            for idx, row in raw.iterrows():
                # Đếm số lượng ô có chuỗi văn bản hợp lệ (không phải số, không rỗng)
                text_count = sum(
                    1
                    for v in row
                    if pd.notna(v)
                    and isinstance(v, str)
                    and len(v.strip()) > 1
                    and not v.strip().replace(".", "", 1).replace("-", "", 1).isdigit()
                )
                # Dòng tiêu đề của bảng thường có số lượng cột tên văn bản nhiều nhất
                if text_count > max_text_cols and text_count >= 2:
                    max_text_cols = text_count
                    best_row = int(idx)

            # 2. Đọc lại DataFrame từ dòng header chuẩn nhất với na_values
            df = pd.read_excel(file_path, header=best_row, na_values=CUSTOM_NA_VALUES)

        elif ext == ".csv":
            # Hỗ trợ nhiều bảng mã Tiếng Việt
            encodings = ["utf-8", "utf-8-sig", "latin1", "cp1258"]
            df = None
            last_err = None
            for enc in encodings:
                try:
                    df = pd.read_csv(file_path, encoding=enc, na_values=CUSTOM_NA_VALUES)
                    break
                except Exception as err:
                    last_err = err

            if df is None:
                raise ValueError(f"Không thể đọc tệp CSV: {str(last_err)}")

            # Nếu dòng đầu của CSV chỉ có 1 cột có chữ và còn lại là Unnamed
            if sum(1 for c in df.columns if not str(c).startswith("Unnamed:")) <= 1 and len(df) > 0:
                raw = pd.read_csv(file_path, header=None, nrows=15, encoding="utf-8", errors="ignore", na_values=CUSTOM_NA_VALUES)
                best_row = 0
                max_text_cols = 0
                for idx, row in raw.iterrows():
                    text_count = sum(
                        1
                        for v in row
                        if pd.notna(v)
                        and isinstance(v, str)
                        and len(v.strip()) > 1
                        and not v.strip().replace(".", "", 1).isdigit()
                    )
                    if text_count > max_text_cols and text_count >= 2:
                        max_text_cols = text_count
                        best_row = int(idx)
                if best_row > 0:
                    df = pd.read_csv(file_path, header=best_row, encoding="utf-8", errors="ignore", na_values=CUSTOM_NA_VALUES)
        else:
            raise ValueError(f"Định dạng tệp '{ext}' không được hỗ trợ. Chỉ hỗ trợ .xlsx, .xls, .csv")

        # 3. Chuẩn Corey Schafer (11:01): Thay thế các placeholder chuỗi tùy chỉnh thành NA
        df = df.replace(CUSTOM_NA_VALUES, pd.NA)

        # 4. Chuẩn Corey Schafer (2:28, 3:55): Loại bỏ các cột hoàn toàn trống (how='all', axis='columns')
        df = df.dropna(axis="columns", how="all")

        # 5. Chuẩn hóa tên cột
        cleaned_cols = []
        for idx, col in enumerate(df.columns):
            col_str = str(col).strip().replace("\n", " ").replace("\r", "")
            if "Unnamed:" in col_str or col_str.lower() in ["nan", "", "none", "<na>"]:
                col_str = f"Cot_{idx + 1}"

            # Đảm bảo không trùng tên cột
            base_name = col_str
            suffix = 1
            while col_str in cleaned_cols:
                col_str = f"{base_name}_{suffix}"
                suffix += 1

            cleaned_cols.append(col_str)

        df.columns = cleaned_cols

        # 6. Chuẩn Corey Schafer (2:28, 3:55): Loại bỏ các dòng hoàn toàn rỗng (how='all', axis='index')
        df = df.dropna(axis="index", how="all")

        # 7. Reset index
        df = df.reset_index(drop=True)

        return df


dataframe_service = DataFrameService()
