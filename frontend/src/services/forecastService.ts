import axios from "axios"

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000"

export interface ForecastRequest {
  dataset_id: string
  target_column: string
  date_column?: string | null
  horizon: number
  model_type: "linear_regression" | "polynomial_trend" | "exponential_smoothing" | "arima" | "lstm_neural_trend"
}

export interface ForecastMetrics {
  mae: number
  rmse: number
  mape: number
  r2: number
  growth_rate_pct: number
}

export interface ForecastPoint {
  period: string
  forecast_value: number
  lower_bound: number
  upper_bound: number
}

export interface HistoricalPoint {
  period: string
  actual_value: number
  fitted_value: number
}

export interface ForecastResponseData {
  target_column: string
  date_column?: string | null
  horizon: number
  model_type: string
  model_method_name?: string
  sample_count: number
  metrics: ForecastMetrics
  growth_rate_pct: number
  summary: string
  forecast_table: ForecastPoint[]
  historical_table: HistoricalPoint[]
  chart_image: string
}

export interface ForecastApiResponse {
  status: string
  dataset_name: string
  execution_time_ms: number
  data: ForecastResponseData
}

export interface ClusteringRequest {
  dataset_id: string
  features: string[]
  n_clusters: number
  id_column?: string | null
}

export interface ClusterStat {
  cluster_id: number
  count: number
  percentage: number
  business_label: string
  description: string
  feature_means: Record<string, number>
}

export interface ClusteringResponseData {
  n_clusters: number
  features: string[]
  silhouette_score: number
  quality_rating: string
  cluster_stats: ClusterStat[]
  sample_data: Array<Record<string, any>>
  chart_image: string
}

export interface ClusteringApiResponse {
  status: string
  dataset_name: string
  execution_time_ms: number
  data: ClusteringResponseData
}

export interface AlgorithmRecommendation {
  algorithm_id: string
  algorithm_name: string
  tutorial_title: string
  tutorial_channel: string
  task_type: "time_series_forecast" | "classification" | "clustering"
  suitability: string
  confidence_score: number
  badge_color?: string
  reason: string
  suggested_target?: string
  suggested_features?: string[]
  suggested_date?: string | null
  suggested_horizon?: number
}

export interface RecommendationResponseData {
  detected_type: string
  type_label: string
  type_description: string
  total_rows: number
  total_columns: number
  recommendations: AlgorithmRecommendation[]
  available_fields: {
    numeric_columns: string[]
    date_columns: string[]
    binary_columns: string[]
    categorical_columns: string[]
    priority_numeric_targets: string[]
    priority_binary_targets: string[]
  }
}

export interface RecommendationApiResponse {
  status: string
  dataset_id: string
  dataset_name: string
  data: RecommendationResponseData
}

export interface ClassificationRequest {
  dataset_id: string
  target_column: string
  feature_columns: string[]
  test_size?: number
}

export interface OddsRatioItem {
  feature: string
  coefficient: number
  odds_ratio: number
  pct_impact: string
  interpretation: string
}

export interface ClassificationResponseData {
  target_column: string
  feature_columns: string[]
  sample_count: number
  train_samples: number
  test_samples: number
  classes: {
    negative_class: string
    positive_class: string
  }
  metrics: {
    accuracy: number
    precision: number
    recall: number
    f1_score: number
    roc_auc: number
  }
  confusion_matrix: {
    true_negative: number
    false_positive: number
    false_negative: number
    true_positive: number
  }
  intercept: number
  odds_ratios: OddsRatioItem[]
  summary: string
  chart_image: string
}

export interface ClassificationApiResponse {
  status: string
  dataset_name: string
  execution_time_ms: number
  data: ClassificationResponseData
}

const getAuthHeaders = () => {
  const token = sessionStorage.getItem("access_token")
  return {
    Authorization: token ? `Bearer ${token}` : "",
  }
}

export const ForecastService = {
  async predict(request: ForecastRequest): Promise<ForecastApiResponse> {
    const response = await axios.post<ForecastApiResponse>(
      `${API_URL}/api/v1/forecast/predict`,
      request,
      { headers: getAuthHeaders() }
    )
    return response.data
  },

  async runClustering(request: ClusteringRequest): Promise<ClusteringApiResponse> {
    const response = await axios.post<ClusteringApiResponse>(
      `${API_URL}/api/v1/analytics/clustering`,
      request,
      { headers: getAuthHeaders() }
    )
    return response.data
  },

  async getRecommendations(datasetId: string): Promise<RecommendationApiResponse> {
    const response = await axios.get<RecommendationApiResponse>(
      `${API_URL}/api/v1/forecast/recommendations/${datasetId}`,
      { headers: getAuthHeaders() }
    )
    return response.data
  },

  async runClassification(request: ClassificationRequest): Promise<ClassificationApiResponse> {
    const response = await axios.post<ClassificationApiResponse>(
      `${API_URL}/api/v1/forecast/classification`,
      request,
      { headers: getAuthHeaders() }
    )
    return response.data
  },
}
