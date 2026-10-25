import axios from "axios"

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000"

export interface ForecastRequest {
  dataset_id: string
  target_column: string
  date_column?: string | null
  horizon: number
  model_type: "linear_regression" | "polynomial_trend" | "exponential_smoothing"
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
}
