import base64
import io
from typing import Any
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression

from app.analytics.metrics import calculate_metrics


def train_and_forecast_series(
    df: pd.DataFrame,
    target_column: str,
    date_column: str | None = None,
    horizon: int = 3,
    model_type: str = "linear_regression",
) -> dict[str, Any]:
    """
    Module 8 & 10: Dự báo tài chính doanh nghiệp với thuật toán học máy / thống kê
    - Hỗ trợ các mô hình: Hồi quy tuyến tính (Linear Regression), Xu hướng đa thức (Polynomial Trend), Làm mịn số mũ (Exponential Smoothing)
    - Tính toán khoảng tin cậy 95% (Confidence Interval)
    - Đo lường độ chính xác: MAE, RMSE, MAPE, R²
    - Trực quan hóa đường xu hướng thực tế & dự báo ra ảnh Base64
    """
    if target_column not in df.columns:
        raise ValueError(f"Không tìm thấy cột chỉ tiêu tài chính '{target_column}' trong tệp.")

    # 1. Tiền xử lý dữ liệu & sắp xếp thời gian
    working_df = df.copy()
    if date_column and date_column in working_df.columns:
        try:
            working_df["_parsed_date"] = pd.to_datetime(working_df[date_column], errors="coerce")
            working_df = working_df.dropna(subset=["_parsed_date", target_column])
            working_df = working_df.sort_values(by="_parsed_date")
        except Exception:
            working_df = working_df.dropna(subset=[target_column])
    else:
        working_df = working_df.dropna(subset=[target_column])

    # Ép kiểu dữ liệu số
    working_df[target_column] = pd.to_numeric(working_df[target_column], errors="coerce")
    working_df = working_df.dropna(subset=[target_column])

    n_samples = len(working_df)
    if n_samples < 3:
        raise ValueError(f"Số lượng bản ghi dữ liệu ({n_samples}) quá ít để huấn luyện mô hình dự báo (tối thiểu 3 bản ghi).")

    y_train = working_df[target_column].values.astype(float)
    x_train = np.arange(n_samples).reshape(-1, 1)

    # Nhãn thời gian cho dữ liệu quá khứ
    if "_parsed_date" in working_df.columns and working_df["_parsed_date"].notna().all():
        date_labels = working_df["_parsed_date"].dt.strftime("%Y-%m-%d").tolist()
        last_date = working_df["_parsed_date"].iloc[-1]
        # Suy luận tần suất (tháng/ngày)
        try:
            future_dates = pd.date_range(start=last_date, periods=horizon + 1, freq="MS")[1:]
            if len(future_dates) < horizon:
                future_dates = pd.date_range(start=last_date, periods=horizon + 1, freq="D")[1:]
            forecast_labels = [d.strftime("%Y-%m-%d") for d in future_dates]
        except Exception:
            forecast_labels = [f"Kỳ +{i+1}" for i in range(horizon)]
    else:
        date_labels = [f"Kỳ {i+1}" for i in range(n_samples)]
        forecast_labels = [f"Dự báo +{i+1}" for i in range(horizon)]

    # 2. Huấn luyện mô hình theo lựa chọn
    x_future = np.arange(n_samples, n_samples + horizon).reshape(-1, 1)

    if model_type == "polynomial_trend" and n_samples >= 4:
        # Hồi quy bậc 2
        poly_coeffs = np.polyfit(np.arange(n_samples), y_train, deg=2)
        poly_fn = np.poly1d(poly_coeffs)
        y_fitted = poly_fn(np.arange(n_samples))
        y_forecast = poly_fn(np.arange(n_samples, n_samples + horizon))
    elif model_type == "exponential_smoothing":
        # Holt's linear exponential smoothing
        alpha = 0.5
        beta = 0.3
        level = y_train[0]
        trend = (y_train[-1] - y_train[0]) / n_samples if n_samples > 1 else 0.0
        y_fitted = []
        for val in y_train:
            y_fitted.append(level + trend)
            prev_level = level
            level = alpha * val + (1 - alpha) * (level + trend)
            trend = beta * (level - prev_level) + (1 - beta) * trend
        y_fitted = np.array(y_fitted)
        y_forecast = np.array([level + (h + 1) * trend for h in range(horizon)])
    else:
        # Linear Regression chuẩn
        lr = LinearRegression()
        lr.fit(x_train, y_train)
        y_fitted = lr.predict(x_train)
        y_forecast = lr.predict(x_future)

    # 3. Tính toán sai số & Khoảng tin cậy 95% (Confidence Interval)
    residuals = y_train - y_fitted
    deg_freedom = max(1, n_samples - 2)
    s_err = np.sqrt(np.sum(residuals ** 2) / deg_freedom)

    x_mean = np.mean(x_train)
    ss_x = np.sum((x_train - x_mean) ** 2)
    if ss_x == 0:
        ss_x = 1.0

    lower_bounds = []
    upper_bounds = []
    for idx, x_f in enumerate(range(n_samples, n_samples + horizon)):
        # Độ vươn margin mở rộng dần theo số kỳ tương lai
        leverage = 1.0 + (1.0 / n_samples) + (((x_f - x_mean) ** 2) / ss_x)
        margin = 1.96 * s_err * np.sqrt(leverage)
        val = y_forecast[idx]
        lower_bounds.append(round(float(max(0.0, val - margin)), 2))
        upper_bounds.append(round(float(val + margin), 2))

    y_forecast_rounded = [round(float(v), 2) for v in y_forecast]
    y_fitted_rounded = [round(float(v), 2) for v in y_fitted]

    # Chỉ số đánh giá
    metrics = calculate_metrics(y_train, y_fitted)

    # Tỷ lệ tăng trưởng dự kiến so với kỳ gần nhất
    last_val = y_train[-1]
    avg_forecast = float(np.mean(y_forecast))
    growth_rate = round(((avg_forecast - last_val) / last_val * 100), 2) if last_val != 0 else 0.0
    metrics["growth_rate_pct"] = growth_rate

    # 4. Trực quan hóa biểu đồ (Matplotlib)
    fig, ax = plt.subplots(figsize=(10, 5.2), dpi=130)
    fig.patch.set_facecolor("#0f172a")
    ax.set_facecolor("#1e293b")

    # Dữ liệu thực tế
    ax.plot(
        range(n_samples),
        y_train,
        marker="o",
        color="#38bdf8",
        linewidth=2.2,
        label="Dữ liệu thực tế lịch sử",
        zorder=3,
    )

    # Đường khớp xu hướng quá khứ
    ax.plot(
        range(n_samples),
        y_fitted,
        linestyle=":",
        color="#94a3b8",
        linewidth=1.5,
        alpha=0.7,
        label=f"Đường xu hướng khớp (R²={metrics['r2']})",
    )

    # Điểm nối giữa thực tế và dự báo
    connect_x = [n_samples - 1, n_samples]
    connect_y = [y_train[-1], y_forecast[0]]
    ax.plot(connect_x, connect_y, linestyle="--", color="#f97316", linewidth=2.0, alpha=0.8)

    # Đường dự báo tương lai
    forecast_x = range(n_samples, n_samples + horizon)
    ax.plot(
        forecast_x,
        y_forecast,
        marker="s",
        linestyle="--",
        color="#f97316",
        linewidth=2.4,
        label=f"Dự báo ({horizon} kỳ tới)",
        zorder=4,
    )

    # Vùng tin cậy 95%
    ax.fill_between(
        forecast_x,
        lower_bounds,
        upper_bounds,
        color="#f97316",
        alpha=0.18,
        label="Khoảng tin cậy 95% [Min - Max]",
    )

    # Nhãn và trục
    all_x = list(range(n_samples + horizon))
    all_labels = date_labels + forecast_labels

    # Giảm bớt ticks nếu quá nhiều điểm
    if len(all_x) > 15:
        step = max(1, len(all_x) // 10)
        ticks_to_show = list(range(0, n_samples, step)) + list(forecast_x)
        ax.set_xticks(ticks_to_show)
        ax.set_xticklabels([all_labels[i] for i in ticks_to_show], rotation=35, ha="right", color="#cbd5e1", fontsize=9)
    else:
        ax.set_xticks(all_x)
        ax.set_xticklabels(all_labels, rotation=35, ha="right", color="#cbd5e1", fontsize=9)

    ax.tick_params(colors="#cbd5e1", which="both")
    ax.grid(True, linestyle="--", alpha=0.2, color="#64748b")
    ax.spines["bottom"].set_color("#475569")
    ax.spines["left"].set_color("#475569")
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)

    ax.set_title(
        f"MÔ HÌNH DỰ BÁO {target_column.upper()} - {horizon} KỲ TIẾP THEO",
        color="#f8fafc",
        fontsize=13,
        fontweight="bold",
        pad=14,
    )
    ax.set_ylabel(f"Giá trị ({target_column})", color="#cbd5e1", fontsize=10)
    ax.legend(facecolor="#1e293b", edgecolor="#334155", labelcolor="#f1f5f9", fontsize=9, loc="upper left")

    plt.tight_layout()
    buf = io.BytesIO()
    plt.savefig(buf, format="png", bbox_inches="tight", facecolor=fig.get_facecolor())
    plt.close(fig)
    buf.seek(0)
    chart_base64 = f"data:image/png;base64,{base64.b64encode(buf.read()).decode('utf-8')}"

    # 5. Tóm tắt định lượng
    direction = "tăng trưởng" if growth_rate >= 0 else "suy giảm"
    summary_text = (
        f"Mô hình dự báo tài chính ({model_type}) ghi nhận xu hướng {direction} với tốc độ bình quân {abs(growth_rate)}% "
        f"trong {horizon} kỳ sắp tới. Sai số kiểm định MAE đạt {metrics['mae']} và chỉ số độ phù hợp R² đạt {metrics['r2']}. "
        f"Khoảng tin cậy 95% dự phóng giá trị dao động từ {min(lower_bounds)} đến {max(upper_bounds)}."
    )

    # Chuẩn bị dữ liệu bảng
    forecast_table = []
    for i in range(horizon):
        forecast_table.append({
            "period": forecast_labels[i],
            "forecast_value": y_forecast_rounded[i],
            "lower_bound": lower_bounds[i],
            "upper_bound": upper_bounds[i],
        })

    historical_table = []
    for i in range(n_samples):
        historical_table.append({
            "period": date_labels[i],
            "actual_value": round(float(y_train[i]), 2),
            "fitted_value": y_fitted_rounded[i],
        })

    return {
        "target_column": target_column,
        "date_column": date_column,
        "horizon": horizon,
        "model_type": model_type,
        "sample_count": n_samples,
        "metrics": metrics,
        "growth_rate_pct": growth_rate,
        "summary": summary_text,
        "forecast_table": forecast_table,
        "historical_table": historical_table,
        "chart_image": chart_base64,
    }
