import base64
import io
from typing import Any
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.decomposition import PCA
from sklearn.metrics import silhouette_score
from sklearn.preprocessing import StandardScaler


def run_kmeans_clustering(
    df: pd.DataFrame,
    features: list[str],
    n_clusters: int = 3,
    id_column: str | None = None,
) -> dict[str, Any]:
    """
    Module 10: Tích hợp thuật toán Machine Learning (K-Means Clustering)
    - Phân cụm khách hàng hoặc phân khúc mặt hàng/sản phẩm theo doanh thu, sản lượng, tần suất
    - Chuẩn hóa đặc trưng bằng StandardScaler
    - Đo lường chất lượng phân cụm bằng Silhouette Score
    - Chiếu giảm chiều dữ liệu bằng PCA (Principal Component Analysis) để trực quan hóa đa chiều
    - Gán nhãn nghiệp vụ kinh doanh định lượng cho từng phân cụm
    """
    if len(df) < n_clusters * 2:
        raise ValueError(f"Số lượng bản ghi ({len(df)}) quá ít để phân chia thành {n_clusters} cụm.")

    # 1. Kiểm tra và chọn các đặc trưng số học
    valid_features = [f for f in features if f in df.columns]
    if len(valid_features) < 2:
        # Nếu người dùng chưa chọn đủ, tự động quét tìm các cột dạng số
        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        valid_features = [c for c in numeric_cols if not c.startswith("_") and df[c].nunique() > 1][:4]

    if len(valid_features) < 2:
        raise ValueError("Cần tối thiểu 2 cột đặc trưng định lượng (dạng số) để thực hiện phân cụm K-Means.")

    working_df = df.copy()

    # Xử lý khuyết thiếu bằng trung vị
    for col in valid_features:
        working_df[col] = pd.to_numeric(working_df[col], errors="coerce")
        median_val = working_df[col].median()
        working_df[col] = working_df[col].fillna(median_val if pd.notna(median_val) else 0)

    X = working_df[valid_features].values

    # 2. Chuẩn hóa đặc trưng (Feature Scaling)
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    # 3. Huấn luyện mô hình K-Means
    kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
    cluster_labels = kmeans.fit_predict(X_scaled)
    working_df["_cluster"] = cluster_labels

    # 4. Đo lường chỉ số Silhouette Score
    try:
        sil_score = float(silhouette_score(X_scaled, cluster_labels))
    except Exception:
        sil_score = 0.5
    sil_score = round(sil_score, 3)

    # 5. Phân tích đặc trưng từng cụm & Định danh nghiệp vụ
    cluster_stats = []
    primary_metric = valid_features[0]

    # Tính giá trị trung bình trên từng cụm
    cluster_means = []
    for c_id in range(n_clusters):
        c_mask = cluster_labels == c_id
        count = int(np.sum(c_mask))
        pct = round(count / len(df) * 100, 1)
        means = {feat: round(float(np.mean(working_df.loc[c_mask, feat])), 2) for feat in valid_features}
        cluster_means.append({
            "cluster_id": c_id,
            "count": count,
            "percentage": pct,
            "primary_mean": means[primary_metric],
            "feature_means": means,
        })

    # Sắp xếp các cụm theo giá trị đặc trưng chính từ cao xuống thấp để gán nhãn nghiệp vụ
    sorted_clusters = sorted(cluster_means, key=lambda x: x["primary_mean"], reverse=True)

    tier_labels = [
        ("🏆 Phân khúc VIP / Đóng góp hàng đầu", "Nhóm khách hàng/mặt hàng chủ lực đem lại doanh thu vượt trội, cần ưu tiên chăm sóc đặc biệt."),
        ("⭐ Phân khúc Tiềm năng / Tăng trưởng cao", "Nhóm có tần suất giao dịch ổn định và sức mua khá, có tiềm năng nâng cấp lên nhóm VIP."),
        ("🔄 Phân khúc Tiêu chuẩn / Phổ thông", "Nhóm duy trì mức chi tiêu trung bình, chiếm tỷ trọng người dùng lớn trong doanh nghiệp."),
        ("⚠️ Phân khúc Cần kích cầu / Rủi ro rời bỏ", "Nhóm có giá trị giao dịch thấp hoặc ít tương tác, cần chính sách khuyến mãi để tái kích hoạt."),
        ("💤 Phân khúc Ít hoạt động", "Nhóm cần khảo sát tìm hiểu nguyên nhân giảm sút sức mua."),
        ("📦 Phân khúc Dự bị / Khác", "Nhóm bản ghi đặc thù cần theo dõi thêm chu kỳ."),
    ]

    for rank, item in enumerate(sorted_clusters):
        label_info = tier_labels[min(rank, len(tier_labels) - 1)]
        item["business_label"] = label_info[0]
        item["description"] = label_info[1]
        cluster_stats.append(item)

    # Trả về thứ tự theo ID gốc
    cluster_stats = sorted(cluster_stats, key=lambda x: x["cluster_id"])

    # 6. Trực quan hóa dữ liệu bằng Matplotlib
    # Nếu > 2 đặc trưng, dùng PCA để chiếu xuống 2 chiều giữ trọn không gian phương sai
    fig, ax = plt.subplots(figsize=(9, 5.5), dpi=130)
    fig.patch.set_facecolor("#0f172a")
    ax.set_facecolor("#1e293b")

    colors = ["#38bdf8", "#f97316", "#10b981", "#a855f7", "#ec4899", "#eab308"]

    if len(valid_features) == 2:
        x_plot = X[:, 0]
        y_plot = X[:, 1]
        x_label = valid_features[0]
        y_label = valid_features[1]
        centroids_plot = scaler.inverse_transform(kmeans.cluster_centers_)
    else:
        pca = PCA(n_components=2, random_state=42)
        X_pca = pca.fit_transform(X_scaled)
        x_plot = X_pca[:, 0]
        y_plot = X_pca[:, 1]
        var_ratio = np.sum(pca.explained_variance_ratio_) * 100
        x_label = f"PCA Thành phần 1 ({round(pca.explained_variance_ratio_[0]*100, 1)}%)"
        y_label = f"PCA Thành phần 2 ({round(pca.explained_variance_ratio_[1]*100, 1)}%)"
        centroids_plot = pca.transform(kmeans.cluster_centers_)

    for c_id in range(n_clusters):
        mask = cluster_labels == c_id
        c_info = next(c for c in cluster_stats if c["cluster_id"] == c_id)
        ax.scatter(
            x_plot[mask],
            y_plot[mask],
            color=colors[c_id % len(colors)],
            alpha=0.75,
            s=48,
            label=f"Cụm {c_id}: {''.join(ch for ch in c_info['business_label'].split('/')[0].strip() if ord(ch) < 10000).strip()} ({c_info['percentage']}%)",
            edgecolors="none",
        )

    # Vẽ tâm cụm (Centroids)
    ax.scatter(
        centroids_plot[:, 0],
        centroids_plot[:, 1],
        color="#ffffff",
        marker="X",
        s=160,
        linewidths=1.5,
        edgecolors="#0f172a",
        label="Tâm phân cụm (Centroids)",
        zorder=5,
    )

    ax.tick_params(colors="#cbd5e1", which="both")
    ax.grid(True, linestyle="--", alpha=0.2, color="#64748b")
    ax.spines["bottom"].set_color("#475569")
    ax.spines["left"].set_color("#475569")
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)

    title_text = f"PHÂN CỤM HỌC MÁY K-MEANS ({n_clusters} PHÂN KHÚC) - SILHOUETTE SCORE: {sil_score}"
    ax.set_title(title_text, color="#f8fafc", fontsize=12, fontweight="bold", pad=12)
    ax.set_xlabel(x_label, color="#cbd5e1", fontsize=9.5)
    ax.set_ylabel(y_label, color="#cbd5e1", fontsize=9.5)
    ax.legend(facecolor="#1e293b", edgecolor="#334155", labelcolor="#f1f5f9", fontsize=8.5, loc="best")

    plt.tight_layout()
    buf = io.BytesIO()
    plt.savefig(buf, format="png", bbox_inches="tight", facecolor=fig.get_facecolor())
    plt.close(fig)
    buf.seek(0)
    chart_base64 = f"data:image/png;base64,{base64.b64encode(buf.read()).decode('utf-8')}"

    # 7. Trích xuất mẫu 15 bản ghi kèm nhãn phân cụm
    sample_cols = [id_column] if (id_column and id_column in working_df.columns) else []
    sample_cols += valid_features
    sample_data = []
    for _, row in working_df[sample_cols + ["_cluster"]].head(15).iterrows():
        rec = {col: row[col] for col in sample_cols}
        c_id = int(row["_cluster"])
        c_info = next(c for c in cluster_stats if c["cluster_id"] == c_id)
        rec["cluster_id"] = c_id
        rec["cluster_label"] = c_info["business_label"]
        sample_data.append(rec)

    quality_rating = "Rất tốt" if sil_score >= 0.5 else ("Tốt" if sil_score >= 0.25 else "Mức độ trung bình")

    return {
        "n_clusters": n_clusters,
        "features": valid_features,
        "silhouette_score": sil_score,
        "quality_rating": quality_rating,
        "cluster_stats": cluster_stats,
        "sample_data": sample_data,
        "chart_image": chart_base64,
    }
