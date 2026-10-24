import os
import pandas as pd
import numpy as np


def smart_load_dataframe(file_path: str) -> pd.DataFrame:
    """
    Bộ đọc dữ liệu thông minh cho Excel (.xlsx, .xls) và CSV (.csv):
    - Tự động nhận diện dòng tiêu đề thật (Header Detection), bỏ qua các banner tiêu đề báo cáo, dòng trống hoặc logo
    - Tự động xử lý và loại bỏ các cột rỗng (Unnamed: x)
    - Tự động gán tên nghiệp vụ có nghĩa cho các cột bị khuyết tên
    - Hỗ trợ đa bảng mã Tiếng Việt (UTF-8, UTF-8-SIG, Latin1, CP1258)
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Không tìm thấy tệp dữ liệu tại {file_path}")

    ext = os.path.splitext(file_path)[1].lower()

    if ext in [".xlsx", ".xls"]:
        # 1. Đọc thử 25 dòng đầu không header để chấm điểm dòng nào là Header thật
        try:
            raw = pd.read_excel(file_path, header=None, nrows=25)
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

        # 2. Đọc lại DataFrame từ dòng header chuẩn nhất
        df = pd.read_excel(file_path, header=best_row)

    elif ext == ".csv":
        # Hỗ trợ nhiều bảng mã Tiếng Việt
        encodings = ["utf-8", "utf-8-sig", "latin1", "cp1258"]
        df = None
        last_err = None
        for enc in encodings:
            try:
                df = pd.read_csv(file_path, encoding=enc)
                break
            except Exception as err:
                last_err = err

        if df is None:
            raise ValueError(f"Không thể đọc tệp CSV: {str(last_err)}")

        # Nếu dòng đầu của CSV chỉ có 1 cột có chữ và còn lại là Unnamed
        if sum(1 for c in df.columns if not str(c).startswith("Unnamed:")) <= 1 and len(df) > 0:
            raw = pd.read_csv(file_path, header=None, nrows=15, encoding="utf-8", errors="ignore")
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
                df = pd.read_csv(file_path, header=best_row, encoding="utf-8", errors="ignore")
    else:
        raise ValueError(f"Định dạng tệp '{ext}' không được hỗ trợ. Chỉ hỗ trợ .xlsx, .xls, .csv")

    # 3. Loại bỏ các cột hoàn toàn trống (All NaN)
    df = df.dropna(axis=1, how="all")

    # 4. Chuẩn hóa tên cột thông minh (Bỏ Unnamed, chuẩn hóa Tiếng Việt)
    cleaned_cols = []
    for idx, col in enumerate(df.columns):
        col_str = str(col).strip().replace("\n", " ").replace("\r", "")
        # Nếu cột bị Unnamed hoặc rỗng, suy luận từ dữ liệu bên dưới
        if "Unnamed:" in col_str or col_str.lower() in ["nan", "", "none"]:
            sample_vals = df[col].dropna().head(6).astype(str).tolist()
            sample_str = " ".join(sample_vals).lower()

            if any(d in sample_str for d in ["thứ", "cn", "ngày", "t2", "t3", "t4", "t5", "t6", "t7", "tháng", "tuần"]):
                col_str = "Thời_Gian" if idx > 0 else "Ngày_Giao_Dịch"
            elif any(c in sample_str for c in ["kh", "sp", "nv", "mã", "id", "code"]):
                col_str = f"Mã_Định_Danh_{idx + 1}"
            elif any(k in sample_str for k in ["hà nội", "hcm", "đà nẵng", "khu vực", "miền"]):
                col_str = "Khu_Vực"
            else:
                col_str = f"Chỉ_Tiêu_{idx + 1}"

        # Đảm bảo không trùng tên cột
        base_name = col_str
        suffix = 1
        while col_str in cleaned_cols:
            col_str = f"{base_name}_{suffix}"
            suffix += 1

        cleaned_cols.append(col_str)

    df.columns = cleaned_cols

    # 5. Loại bỏ các dòng hoàn toàn rỗng
    df = df.dropna(how="all")

    # 6. Reset index
    df = df.reset_index(drop=True)

    return df
