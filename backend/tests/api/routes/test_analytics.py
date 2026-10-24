import numpy as np
import pandas as pd
from fastapi.testclient import TestClient

from app.analytics.clustering import run_kmeans_clustering
from app.analytics.forecasting import train_and_forecast_series
from app.analytics.metrics import calculate_metrics
from app.core.config import settings


def test_calculate_metrics():
    y_true = [100.0, 150.0, 200.0, 250.0]
    y_pred = [105.0, 145.0, 205.0, 245.0]
    res = calculate_metrics(y_true, y_pred)
    assert res["mae"] == 5.0
    assert res["rmse"] == 5.0
    assert res["r2"] > 0.95
    assert res["mape"] > 0.0


def test_forecast_series_linear():
    df = pd.DataFrame({
        "Thang": ["2026-01-01", "2026-02-01", "2026-03-01", "2026-04-01", "2026-05-01"],
        "Doanh_Thu": [100, 120, 140, 160, 180],
    })
    result = train_and_forecast_series(
        df=df,
        target_column="Doanh_Thu",
        date_column="Thang",
        horizon=3,
        model_type="linear_regression",
    )
    assert result["target_column"] == "Doanh_Thu"
    assert len(result["forecast_table"]) == 3
    assert result["metrics"]["r2"] > 0.99
    assert result["chart_image"].startswith("data:image/png;base64,")
    assert result["growth_rate_pct"] > 0


def test_kmeans_clustering():
    df = pd.DataFrame({
        "So_Luong": [10, 12, 11, 100, 105, 98, 50, 52, 48],
        "Doanh_Thu": [100, 120, 110, 1000, 1050, 980, 500, 520, 480],
    })
    result = run_kmeans_clustering(
        df=df,
        features=["So_Luong", "Doanh_Thu"],
        n_clusters=3,
    )
    assert result["n_clusters"] == 3
    assert len(result["cluster_stats"]) == 3
    assert result["silhouette_score"] > 0.4
    assert result["chart_image"].startswith("data:image/png;base64,")


def test_history_endpoints(
    client: TestClient, superuser_token_headers: dict[str, str]
):
    # Test GET /api/v1/history/stats
    response = client.get(
        f"{settings.API_V1_STR}/history/stats",
        headers=superuser_token_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert "total_queries" in data
    assert "success_rate_pct" in data

    # Test GET /api/v1/history/
    response_list = client.get(
        f"{settings.API_V1_STR}/history/",
        headers=superuser_token_headers,
    )
    assert response_list.status_code == 200
    list_data = response_list.json()
    assert "data" in list_data
    assert "count" in list_data
