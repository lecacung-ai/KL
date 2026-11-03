"""StatQuest: Logistic Regression Analysis & Financial Risk Classification.

Faithfully implements the methodologies from:
- StatQuest with Josh Starmer: Logistic Regression
Features:
- Sigmoid S-Curve mapping probability p = 1 / (1 + e^-z)
- Log-Odds and Odds Ratios (e^beta) to explain how each financial variable multiplies risk
- Confusion Matrix (TP, TN, FP, FN), Precision, Recall, F1, ROC-AUC
- High-res Matplotlib visualization (Sigmoid curve, Odds Ratios, Confusion Matrix)
"""

import base64
import io
from typing import Any
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
    roc_curve,
)
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler


def train_and_predict_logistic(
    df: pd.DataFrame,
    target_column: str,
    feature_columns: list[str],
    test_size: float = 0.25,
    random_state: int = 42,
) -> dict[str, Any]:
    """Train Logistic Regression model, calculate odds ratios, metrics and generate visual charts."""
    if target_column not in df.columns:
        raise ValueError(f"Không tìm thấy cột mục tiêu '{target_column}' trong tập dữ liệu.")

    # Validate feature columns
    valid_features = [f for f in feature_columns if f in df.columns and f != target_column]
    if len(valid_features) < 1:
        # Fallback: auto-detect numeric columns
        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        valid_features = [c for c in numeric_cols if c != target_column][:5]

    if len(valid_features) < 1:
        raise ValueError("Cần ít nhất 1 biến đặc trưng (feature) dạng số để huấn luyện mô hình Logistic Regression.")

    working_df = df[[target_column] + valid_features].copy()

    # Drop missing values
    working_df = working_df.dropna(subset=[target_column])
    for col in valid_features:
        working_df[col] = pd.to_numeric(working_df[col], errors="coerce")
        median_val = working_df[col].median()
        working_df[col] = working_df[col].fillna(median_val if pd.notna(median_val) else 0)

    # Encode target to binary (0 and 1)
    target_series = working_df[target_column]
    unique_vals = target_series.unique()
    if len(unique_vals) != 2:
        raise ValueError(f"Cột mục tiêu '{target_column}' phải có đúng 2 giá trị nhị phân (hiện có: {list(unique_vals)[:5]}).")

    # Map target values to 0 and 1
    # Try common positive labels (Default, 1, Yes, Churn, Khong, Co, Bad, Approved)
    val_0, val_1 = unique_vals[0], unique_vals[1]
    # Check if naturally 0 and 1
    if set(unique_vals).issubset({0, 1, 0.0, 1.0, "0", "1"}):
        mapping = {0: 0, 0.0: 0, "0": 0, 1: 1, 1.0: 1, "1": 1}
        class_0_label, class_1_label = "0 (Bình thường / Âm tính)", "1 (Rủi ro / Dương tính)"
    else:
        str_0 = str(val_0).strip().lower()
        if str_0 in ["0", "no", "false", "non-default", "khong", "binh thuong", "good"]:
            mapping = {val_0: 0, val_1: 1}
            class_0_label = str(val_0)
            class_1_label = str(val_1)
        else:
            mapping = {val_1: 0, val_0: 1}
            class_0_label = str(val_1)
            class_1_label = str(val_0)

    y = target_series.map(mapping).values.astype(int)
    X = working_df[valid_features].values

    n_samples = len(working_df)
    if n_samples < 10:
        raise ValueError(f"Số lượng bản ghi ({n_samples}) quá ít để huấn luyện Logistic Regression (tối thiểu 10 bản ghi).")

    # Train / Test split
    test_sz = min(max(test_size, 0.15), 0.4)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=test_sz, random_state=random_state, stratify=y if np.min(np.bincount(y)) >= 2 else None
    )

    # Standardize features for stable convergence and comparable odds ratios
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    # Fit Logistic Regression model
    model = LogisticRegression(random_state=random_state, max_iter=1000)
    model.fit(X_train_scaled, y_train)

    y_pred = model.predict(X_test_scaled)
    y_prob = model.predict_proba(X_test_scaled)[:, 1]

    # Metrics computation
    acc = float(accuracy_score(y_test, y_pred))
    prec = float(precision_score(y_test, y_pred, zero_division=0))
    rec = float(recall_score(y_test, y_pred, zero_division=0))
    f1 = float(f1_score(y_test, y_pred, zero_division=0))

    try:
        auc = float(roc_auc_score(y_test, y_prob))
    except Exception:
        auc = 0.5

    cm = confusion_matrix(y_test, y_pred)
    tn = int(cm[0, 0]) if cm.shape == (2, 2) else 0
    fp = int(cm[0, 1]) if cm.shape == (2, 2) else 0
    fn = int(cm[1, 0]) if cm.shape == (2, 2) else 0
    tp = int(cm[1, 1]) if cm.shape == (2, 2) else 0

    # Odds Ratios (e^beta) calculation - Core StatQuest concept!
    coefficients = model.coef_[0]
    intercept = float(model.intercept_[0])
    odds_ratios = np.exp(coefficients)

    odds_ratios_data = []
    for feat, coef, odds in zip(valid_features, coefficients, odds_ratios):
        effect = "Tăng nguy cơ" if coef > 0 else "Giảm nguy cơ"
        multiplier = round(float(odds), 3)
        pct_change = round(float((odds - 1.0) * 100), 1)
        odds_ratios_data.append({
            "feature": feat,
            "coefficient": round(float(coef), 4),
            "odds_ratio": multiplier,
            "pct_impact": f"{'+' if pct_change > 0 else ''}{pct_change}%",
            "interpretation": f"Mỗi đơn vị độ lệch chuẩn của '{feat}' làm {effect.lower()} lên {multiplier}x ({pct_change:+0.1f}%)",
        })

    # Sort odds ratios by absolute coefficient descending
    odds_ratios_data.sort(key=lambda x: abs(x["coefficient"]), reverse=True)

    # Visualization: 2-Panel Plot (Sigmoid Curve & Odds Ratios)
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(13, 5.2), dpi=130)
    fig.patch.set_facecolor("#0f172a")

    for ax in [ax1, ax2]:
        ax.set_facecolor("#1e293b")
        ax.tick_params(colors="#cbd5e1", which="both")
        ax.grid(True, linestyle="--", alpha=0.2, color="#64748b")
        for spine in ["bottom", "left"]:
            ax.spines[spine].set_color("#475569")
        for spine in ["top", "right"]:
            ax.spines[spine].set_visible(False)

    # Panel 1: StatQuest Sigmoid Curve (Decision boundary & probabilities)
    # Project X_test onto log-odds z
    z_test = model.decision_function(X_test_scaled)
    z_range = np.linspace(np.min(z_test) - 2, np.max(z_test) + 2, 200)
    sigmoid_curve = 1.0 / (1.0 + np.exp(-z_range))

    ax1.plot(z_range, sigmoid_curve, color="#38bdf8", linewidth=2.8, label="Đường cong Sigmoid: p = 1 / (1 + e^-z)")
    ax1.axhline(0.5, color="#f59e0b", linestyle="--", linewidth=1.4, alpha=0.8, label="Ngưỡng phân loại (Cutoff = 0.5)")
    ax1.axvline(0.0, color="#64748b", linestyle=":", linewidth=1.2, alpha=0.7)

    # Scatter points of actual test samples
    scatter_0 = ax1.scatter(
        z_test[y_test == 0], y_prob[y_test == 0],
        color="#10b981", alpha=0.8, edgecolors="#0f172a", s=45, label=f"Thực tế: {class_0_label}"
    )
    scatter_1 = ax1.scatter(
        z_test[y_test == 1], y_prob[y_test == 1],
        color="#ef4444", alpha=0.8, edgecolors="#0f172a", s=45, label=f"Thực tế: {class_1_label}"
    )

    ax1.set_title("ĐƯỜNG CONG SIGMOID (STATQUEST JOSH STARMER)", color="#f8fafc", fontsize=11, fontweight="bold", pad=12)
    ax1.set_xlabel("Log-Odds (Điểm số rủi ro z = β₀ + Σ βᵢXᵢ)", color="#cbd5e1", fontsize=9)
    ax1.set_ylabel("Xác suất dự đoán p(Y=1)", color="#cbd5e1", fontsize=9)
    ax1.legend(facecolor="#1e293b", edgecolor="#334155", labelcolor="#f1f5f9", fontsize=8, loc="upper left")

    # Panel 2: Odds Ratios (e^beta) Horizontal Bar Chart
    top_features = odds_ratios_data[:7]
    y_pos = np.arange(len(top_features))
    feat_names = [f["feature"] for f in top_features][::-1]
    ratios = [f["odds_ratio"] for f in top_features][::-1]
    bar_colors = ["#ef4444" if r >= 1.0 else "#10b981" for r in ratios]

    bars = ax2.barh(y_pos, ratios, color=bar_colors, alpha=0.85, edgecolor="#0f172a", height=0.6)
    ax2.axvline(1.0, color="#f5c579", linestyle="--", linewidth=1.6, label="Mốc cơ sở (Odds Ratio = 1.0: Không đổi)")
    ax2.set_yticks(y_pos)
    ax2.set_yticklabels(feat_names, color="#cbd5e1", fontsize=9)
    ax2.set_title("TỶ SỐ TỶ CƯỢC ODDS RATIOS (e^β)", color="#f8fafc", fontsize=11, fontweight="bold", pad=12)
    ax2.set_xlabel("Tỷ lệ tác động lên nguy cơ (Odds Multiplier)", color="#cbd5e1", fontsize=9)
    ax2.legend(facecolor="#1e293b", edgecolor="#334155", labelcolor="#f1f5f9", fontsize=8, loc="lower right")

    # Annotate numbers on bars
    for bar, r in zip(bars, ratios):
        width = bar.get_width()
        ax2.text(
            width + 0.05, bar.get_y() + bar.get_height() / 2,
            f"{r:.2f}x",
            va="center", ha="left", color="#f8fafc", fontsize=8, fontweight="bold"
        )

    plt.tight_layout()
    buf = io.BytesIO()
    plt.savefig(buf, format="png", bbox_inches="tight", facecolor=fig.get_facecolor())
    plt.close(fig)
    buf.seek(0)
    chart_base64 = f"data:image/png;base64,{base64.b64encode(buf.read()).decode('utf-8')}"

    # Generate business summary
    most_influential = odds_ratios_data[0]
    direction_word = "làm tăng xác suất rủi ro" if most_influential["coefficient"] > 0 else "giúp giảm thiểu nguy cơ rủi ro"
    summary_text = (
        f"Mô hình Logistic Regression (StatQuest methodology) phân loại '{target_column}' đạt độ chính xác Accuracy {round(acc * 100, 1)}% "
        f"và chỉ số ROC-AUC {round(auc, 3)}. Yếu tố tác động lớn nhất là '{most_influential['feature']}' "
        f"với Odds Ratio đạt {most_influential['odds_ratio']}x ({direction_word}). "
        f"Ma trận nhầm lẫn ghi nhận {tp} ca dự báo đúng rủi ro (TP) và {tn} ca xác định an toàn chuẩn xác (TN)."
    )

    return {
        "target_column": target_column,
        "feature_columns": valid_features,
        "sample_count": n_samples,
        "train_samples": len(X_train),
        "test_samples": len(X_test),
        "classes": {
            "negative_class": class_0_label,
            "positive_class": class_1_label,
        },
        "metrics": {
            "accuracy": round(acc, 4),
            "precision": round(prec, 4),
            "recall": round(rec, 4),
            "f1_score": round(f1, 4),
            "roc_auc": round(auc, 4),
        },
        "confusion_matrix": {
            "true_negative": tn,
            "false_positive": fp,
            "false_negative": fn,
            "true_positive": tp,
        },
        "intercept": round(intercept, 4),
        "odds_ratios": odds_ratios_data,
        "summary": summary_text,
        "chart_image": chart_base64,
    }
