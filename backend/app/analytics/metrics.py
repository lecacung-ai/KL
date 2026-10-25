import numpy as np


def calculate_metrics(y_true: list[float] | np.ndarray, y_pred: list[float] | np.ndarray) -> dict[str, float]:
    """
    Module 8 & 10: Tính toán các chỉ số thống kê & sai số định lượng tài chính
    - MAE: Sai số tuyệt đối trung bình (Mean Absolute Error)
    - RMSE: Căn bậc hai sai số bình phương trung bình (Root Mean Squared Error)
    - MAPE: Phần trăm sai số tuyệt đối trung bình (Mean Absolute Percentage Error)
    - R²: Hệ số xác định / Độ phù hợp mô hình (Coefficient of Determination)
    """
    y_true = np.array(y_true, dtype=float)
    y_pred = np.array(y_pred, dtype=float)

    if len(y_true) == 0 or len(y_pred) == 0 or len(y_true) != len(y_pred):
        return {
            "mae": 0.0,
            "rmse": 0.0,
            "mape": 0.0,
            "r2": 0.0,
        }

    # MAE
    mae = float(np.mean(np.abs(y_true - y_pred)))

    # RMSE
    rmse = float(np.sqrt(np.mean((y_true - y_pred) ** 2)))

    # MAPE (chỉ tính trên các phần tử != 0)
    non_zero_mask = y_true != 0
    if np.any(non_zero_mask):
        mape = float(np.mean(np.abs((y_true[non_zero_mask] - y_pred[non_zero_mask]) / y_true[non_zero_mask])) * 100)
    else:
        mape = 0.0

    # R²
    ss_res = np.sum((y_true - y_pred) ** 2)
    ss_tot = np.sum((y_true - np.mean(y_true)) ** 2)
    if ss_tot > 0:
        r2 = float(1.0 - (ss_res / ss_tot))
    else:
        r2 = 1.0 if ss_res == 0 else 0.0

    return {
        "mae": round(mae, 2),
        "rmse": round(rmse, 2),
        "mape": round(mape, 2),
        "r2": round(max(0.0, min(1.0, r2)), 4),
    }
