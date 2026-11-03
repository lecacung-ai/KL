"""Dataset classification and intelligent algorithm recommendation engine.

Maps financial dataset characteristics to 5 tutorial methodologies:
1. Time Series Forecasting (freeCodeCamp.org) - ARIMA / SARIMA / Holt-Winters
2. Linear Regression (Python Simplified - Mariya Sha) - OLS / R² / Trend forecasting
3. LSTM Time Series (Code with Josh) - Deep sequential non-linear neural network forecasting
4. Logistic Regression (StatQuest - Josh Starmer) - Odds Ratios, Sigmoid curve, Binary risk classification
5. K-Means Clustering (Andy McDonald) - Unsupervised financial segmentation, PCA, Elbow & Silhouette
"""

import re
from typing import Any
import numpy as np
import pandas as pd


def analyze_and_recommend(df: pd.DataFrame, filename: str = "") -> dict[str, Any]:
    """Inspects a dataframe structure, column types, sample distributions, and filename

    to classify the dataset and recommend optimal algorithms among the 5 tutorials.
    """
    total_rows = len(df)
    columns = list(df.columns)
    fname_lower = (filename or "").lower()

    # 1. Identify column characteristics
    numeric_cols: list[str] = []
    date_cols: list[str] = []
    categorical_cols: list[str] = []
    binary_cols: list[str] = []

    # Check date patterns in column names (wide financial statement indicators: '2021-12-31', '2022', 'Q1 2023', '2025-12-31 00:00:00')
    year_col_pattern = re.compile(
        r"^(19|20)\d{2}([-/.]\d{1,2}([-/.]\d{1,2})?)?(\s+\d{1,2}:\d{2}(:\d{2})?)?.*$|^q[1-4][-_ ]?(19|20)?\d{2}",
        re.IGNORECASE,
    )
    date_like_column_names = [c for c in columns if year_col_pattern.match(str(c).strip())]

    # Inspect columns
    for col in columns:
        col_str = str(col).lower()
        series = df[col]
        non_null = series.dropna()

        # Check datetime
        is_date = False
        if any(keyword in col_str for keyword in ["date", "ngay", "ngày", "thang", "tháng", "year", "nam", "năm", "timestamp", "time"]):
            is_date = True
        elif not pd.api.types.is_numeric_dtype(series) and len(non_null) > 0:
            try:
                # Try parsing small sample as date
                sample = non_null.head(10)
                parsed = pd.to_datetime(sample, errors="coerce")
                if parsed.notna().sum() >= len(sample) * 0.8:
                    is_date = True
            except Exception:
                is_date = False

        if is_date:
            date_cols.append(str(col))

        # Check numeric
        is_num = False
        if pd.api.types.is_numeric_dtype(series):
            is_num = True
        else:
            # Check if strings can be numeric (e.g. currency "$1,234.56" or numbers with commas)
            sample_str = non_null.head(20).astype(str)
            cleaned = sample_str.str.replace(r"[$,\s%]", "", regex=True)
            conv = pd.to_numeric(cleaned, errors="coerce")
            if conv.notna().sum() >= len(sample_str) * 0.8:
                is_num = True

        if is_num and str(col) not in date_cols:
            numeric_cols.append(str(col))

        # Check binary / low cardinality target candidate
        n_unique = non_null.nunique()
        if n_unique == 2:
            binary_cols.append(str(col))
        elif n_unique in [3, 4] and not is_num:
            categorical_cols.append(str(col))

    # Potential risk/classification column indicators
    risk_keywords = ["default", "churn", "status", "approved", "target", "label", "class", "risk", "no_xau", "tra_no", "ket_qua", "loan_status"]
    priority_binary_targets = [
        c for c in binary_cols if any(k in str(c).lower() for k in risk_keywords)
    ]

    # Potential sales/revenue indicators for forecasting
    sales_keywords = ["revenue", "sales", "doanh_thu", "doanhthu", "profit", "loi_nhuan", "close", "price", "volume", "amount", "total", "ebitda"]
    priority_numeric_targets = [
        c for c in numeric_cols if any(k in str(c).lower() for k in sales_keywords)
    ]
    if not priority_numeric_targets and numeric_cols:
        priority_numeric_targets = [numeric_cols[0]]

    # 2. Determine Dataset Financial Classification
    # Type A: Wide Financial Statement (Tesla, Apple annual reports: years as columns)
    is_wide_financial_statement = (
        len(date_like_column_names) >= 2 or
        ("statement" in fname_lower or "bctc" in fname_lower or "financial" in fname_lower) and len(date_like_column_names) >= 1
    )

    # Type B: Credit Risk / Binary Loan Classification
    is_credit_risk = (
        len(priority_binary_targets) > 0 or
        (len(binary_cols) > 0 and any(k in fname_lower for k in ["risk", "credit", "loan", "churn", "default", "rui_ro"]))
    )

    # Type C: Time Series Sales / Transactions
    is_time_series_sales = (
        len(date_cols) > 0 and len(numeric_cols) > 0 and total_rows >= 5
    )

    # Type D: Customer / Portfolio Multi-metric Profiling
    is_portfolio_clustering = (
        len(numeric_cols) >= 3 and not is_wide_financial_statement
    )

    # Resolve primary classification
    recommendations: list[dict[str, Any]] = []

    if is_wide_financial_statement:
        detected_type = "financial_statement"
        type_label = "Báo cáo tài chính định kỳ (Wide Format: Các năm/kỳ là cột)"
        type_description = (
            "Dữ liệu báo cáo tài chính doanh nghiệp với các cột đại diện cho niên độ kế toán hoặc kỳ tài chính "
            f"({', '.join(date_like_column_names[:4])}...). Thích hợp nhất cho phân tích tốc độ tăng trưởng và dự báo xu hướng tương lai."
        )

        recommendations.append({
            "algorithm_id": "linear_regression",
            "algorithm_name": "Hồi quy tuyến tính OLS (Linear Regression)",
            "tutorial_title": "Linear Regression Algorithm with Code Examples – Python Simplified",
            "tutorial_channel": "Python Simplified (Mariya Sha)",
            "task_type": "time_series_forecast",
            "suitability": "Khuyên dùng cao nhất",
            "confidence_score": 0.96,
            "badge_color": "#0ea5e9",
            "reason": "Thiết lập đường xu hướng OLS (y = mx + b) để đo lường tốc độ tăng trưởng bình quân qua các năm tài chính và dự phóng các kỳ tiếp theo với độ tin cậy R².",
            "suggested_target": numeric_cols[0] if numeric_cols else columns[0],
            "suggested_features": date_like_column_names,
            "suggested_date": None,
            "suggested_horizon": 3,
        })
        recommendations.append({
            "algorithm_id": "exponential_smoothing",
            "algorithm_name": "Làm mịn số mũ Holt's (Exponential Smoothing)",
            "tutorial_title": "Time Series Forecasting in Python – Tutorial for Beginners",
            "tutorial_channel": "freeCodeCamp.org",
            "task_type": "time_series_forecast",
            "suitability": "Phù hợp",
            "confidence_score": 0.88,
            "badge_color": "#10b981",
            "reason": "Điều chỉnh trọng số giảm dần cho các kỳ tài chính quá khứ xa hơn và ưu tiên các kỳ gần nhất để phản ánh chính xác đà kinh doanh hiện tại.",
            "suggested_target": numeric_cols[0] if numeric_cols else columns[0],
            "suggested_features": date_like_column_names,
            "suggested_date": None,
            "suggested_horizon": 3,
        })
        recommendations.append({
            "algorithm_id": "kmeans",
            "algorithm_name": "Phân cụm danh mục K-Means (K-Means Clustering)",
            "tutorial_title": "K-Means Clustering Algorithm with Python Tutorial",
            "tutorial_channel": "Andy McDonald",
            "task_type": "clustering",
            "suitability": "Khám phá mở rộng",
            "confidence_score": 0.72,
            "badge_color": "#8b5cf6",
            "reason": "Gộp nhóm các khoản mục chi phí / doanh thu có quy mô tương đương để phân bổ cơ cấu tài chính.",
            "suggested_target": "",
            "suggested_features": date_like_column_names[:4] if len(date_like_column_names) >= 2 else numeric_cols[:4],
            "suggested_date": None,
            "suggested_horizon": 3,
        })

    elif is_credit_risk:
        detected_type = "credit_risk_classification"
        type_label = "Hồ sơ thẩm định tín dụng & Phân loại rủi ro (Binary Classification)"
        target_name = priority_binary_targets[0] if priority_binary_targets else binary_cols[0]
        type_description = (
            f"Dữ liệu chứa biến kết quả nhị phân '{target_name}' (ví dụ: Nợ xấu / Bình thường, Vay được duyệt / Từ chối, Rời bỏ / Giữ chân) "
            "cùng các chỉ số đo lường tín dụng của khách hàng/doanh nghiệp."
        )

        candidate_features = [c for c in numeric_cols if c != target_name]

        recommendations.append({
            "algorithm_id": "logistic_regression",
            "algorithm_name": "Hồi quy Logistic & Tỷ số tỷ cược Odds Ratios (Logistic Regression)",
            "tutorial_title": "StatQuest: Logistic Regression",
            "tutorial_channel": "StatQuest with Josh Starmer",
            "task_type": "classification",
            "suitability": "Khuyên dùng cao nhất",
            "confidence_score": 0.98,
            "badge_color": "#f59e0b",
            "reason": "Chuẩn hóa đường cong hàm Sigmoid để ước lượng xác suất rủi ro (0% - 100%), tính ma trận nhầm lẫn (Confusion Matrix) và phân tích Odds Ratios (e^β) xác định yếu tố nào làm tăng nguy cơ nợ xấu cao nhất.",
            "suggested_target": target_name,
            "suggested_features": candidate_features[:5],
            "suggested_date": None,
            "suggested_horizon": 0,
        })
        recommendations.append({
            "algorithm_id": "kmeans",
            "algorithm_name": "Phân cụm hồ sơ khách hàng vay K-Means",
            "tutorial_title": "K-Means Clustering Algorithm with Python Tutorial",
            "tutorial_channel": "Andy McDonald",
            "task_type": "clustering",
            "suitability": "Phù hợp",
            "confidence_score": 0.85,
            "badge_color": "#8b5cf6",
            "reason": "Phân đoạn khách hàng vay thành các cụm khẩu vị rủi ro (VIP, Tiêu chuẩn, Cảnh báo) bằng thuật toán chuẩn hóa StandardScaler và trực quan PCA 2D.",
            "suggested_target": "",
            "suggested_features": candidate_features[:4],
            "suggested_date": None,
            "suggested_horizon": 3,
        })

    elif is_time_series_sales:
        detected_type = "time_series_sales"
        type_label = "Chuỗi thời gian bán hàng & Giao dịch tài chính (Time Series Analysis)"
        time_col = date_cols[0]
        target_col = priority_numeric_targets[0] if priority_numeric_targets else (numeric_cols[0] if numeric_cols else "")
        type_description = (
            f"Dữ liệu chuỗi thời gian liên tục với cột mốc ngày/tháng '{time_col}' và chỉ tiêu đo lường '{target_col}' "
            f"gồm {total_rows} bản ghi. Rất lý tưởng cho các mô hình dự báo chuỗi thời gian chuyên sâu."
        )

        recommendations.append({
            "algorithm_id": "exponential_smoothing",
            "algorithm_name": "Chuỗi thời gian & Làm mịn số mũ Holt-Winters (ARIMA / Holt-Winters)",
            "tutorial_title": "Time Series Forecasting in Python – Tutorial for Beginners",
            "tutorial_channel": "freeCodeCamp.org",
            "task_type": "time_series_forecast",
            "suitability": "Khuyên dùng cao nhất",
            "confidence_score": 0.95,
            "badge_color": "#10b981",
            "reason": "Phân rã chuỗi thời gian thành Xu hướng (Trend) và Chu kỳ theo nguyên lý bài giảng freeCodeCamp để dự phóng chính xác tương lai kèm dải tin cậy 95%.",
            "suggested_target": target_col,
            "suggested_features": [target_col],
            "suggested_date": time_col,
            "suggested_horizon": 6,
        })
        recommendations.append({
            "algorithm_id": "linear_regression",
            "algorithm_name": "Hồi quy xu hướng tuyến tính (Linear Regression)",
            "tutorial_title": "Linear Regression Algorithm with Code Examples – Python Simplified",
            "tutorial_channel": "Python Simplified (Mariya Sha)",
            "task_type": "time_series_forecast",
            "suitability": "Rất phù hợp",
            "confidence_score": 0.91,
            "badge_color": "#0ea5e9",
            "reason": "Xác định nhanh hướng đi tổng thể dài hạn (tăng trưởng hay suy thoái) và đo độ lệch chuẩn MAE/RMSE.",
            "suggested_target": target_col,
            "suggested_features": [target_col],
            "suggested_date": time_col,
            "suggested_horizon": 6,
        })
        recommendations.append({
            "algorithm_id": "lstm_neural_trend",
            "algorithm_name": "Mạng nơ-ron học sâu chuỗi thời gian (LSTM Deep Learning Concept)",
            "tutorial_title": "LSTM Time Series Forecasting with TensorFlow & Python – Step-by-Step Tutorial",
            "tutorial_channel": "Code with Josh",
            "task_type": "time_series_forecast",
            "suitability": "Nâng cao",
            "confidence_score": 0.86,
            "badge_color": "#ec4899",
            "reason": "Khai thác cửa sổ trượt (Sliding Window / Lag Features) và mạng nơ-ron phi tuyến nhiều tầng để bắt trọn các biến động phức tạp của thị trường tài chính.",
            "suggested_target": target_col,
            "suggested_features": [target_col],
            "suggested_date": time_col,
            "suggested_horizon": 6,
        })
        recommendations.append({
            "algorithm_id": "kmeans",
            "algorithm_name": "Phân cụm hành vi chu kỳ K-Means",
            "tutorial_title": "K-Means Clustering Algorithm with Python Tutorial",
            "tutorial_channel": "Andy McDonald",
            "task_type": "clustering",
            "suitability": "Tham khảo",
            "confidence_score": 0.70,
            "badge_color": "#8b5cf6",
            "reason": "Phân nhóm các giai đoạn kinh doanh (Cao điểm, Thấp điểm, Bình ổn) dựa trên tổ hợp doanh thu và số lượng giao dịch.",
            "suggested_target": "",
            "suggested_features": numeric_cols[:3],
            "suggested_date": None,
            "suggested_horizon": 3,
        })

    else:
        # Type D or general tabular
        detected_type = "customer_portfolio_clustering"
        type_label = "Hồ sơ danh mục đầu tư & Phân khúc khách hàng đa biến (Multi-metric Profiling)"
        type_description = (
            f"Tập dữ liệu chứa {len(numeric_cols)} chỉ số định lượng độc lập ({', '.join(numeric_cols[:4])}...). "
            "Phù hợp nhất cho việc tìm kiếm các mẫu tương đồng tự nhiên và phân cụm không giám sát."
        )

        recommendations.append({
            "algorithm_id": "kmeans",
            "algorithm_name": "Phân cụm không giám sát K-Means & PCA (K-Means Clustering)",
            "tutorial_title": "K-Means Clustering Algorithm with Python Tutorial",
            "tutorial_channel": "Andy McDonald",
            "task_type": "clustering",
            "suitability": "Khuyên dùng cao nhất",
            "confidence_score": 0.96,
            "badge_color": "#8b5cf6",
            "reason": "Chuẩn hóa đa biến với StandardScaler, tìm số cụm tối ưu qua Elbow/Silhouette score và trực quan hóa bản đồ phân khúc 2D bằng PCA.",
            "suggested_target": "",
            "suggested_features": numeric_cols[:4],
            "suggested_date": None,
            "suggested_horizon": 3,
        })
        if len(numeric_cols) >= 2:
            recommendations.append({
                "algorithm_id": "linear_regression",
                "algorithm_name": "Hồi quy tuyến tính tương quan 2 biến (Linear Regression)",
                "tutorial_title": "Linear Regression Algorithm with Code Examples – Python Simplified",
                "tutorial_channel": "Python Simplified (Mariya Sha)",
                "task_type": "time_series_forecast",
                "suitability": "Phù hợp",
                "confidence_score": 0.84,
                "badge_color": "#0ea5e9",
                "reason": f"Dự báo mối quan hệ nhân quả giữa biến mục tiêu '{numeric_cols[0]}' và các biến độc lập tài chính.",
                "suggested_target": numeric_cols[0],
                "suggested_features": numeric_cols[1:4],
                "suggested_date": None,
                "suggested_horizon": 3,
            })
        if binary_cols:
            recommendations.append({
                "algorithm_id": "logistic_regression",
                "algorithm_name": "Phân loại Logistic Regression (StatQuest)",
                "tutorial_title": "StatQuest: Logistic Regression",
                "tutorial_channel": "StatQuest with Josh Starmer",
                "task_type": "classification",
                "suitability": "Phù hợp",
                "confidence_score": 0.82,
                "badge_color": "#f59e0b",
                "reason": f"Phân loại xác suất nhị phân cho cột '{binary_cols[0]}'.",
                "suggested_target": binary_cols[0],
                "suggested_features": numeric_cols[:4],
                "suggested_date": None,
                "suggested_horizon": 0,
            })

    return {
        "detected_type": detected_type,
        "type_label": type_label,
        "type_description": type_description,
        "total_rows": total_rows,
        "total_columns": len(columns),
        "recommendations": recommendations,
        "available_fields": {
            "numeric_columns": numeric_cols,
            "date_columns": date_cols,
            "binary_columns": binary_cols,
            "categorical_columns": categorical_cols,
            "priority_numeric_targets": priority_numeric_targets,
            "priority_binary_targets": priority_binary_targets,
        },
    }
