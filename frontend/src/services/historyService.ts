import axios from "axios"

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000"

export interface AnalysisHistoryItem {
  id: string
  user_id: string
  dataset_id?: string | null
  dataset_name: string
  query: string
  ai_code?: string | null
  stdout?: string | null
  status: "success" | "error"
  error_message?: string | null
  execution_time_ms: number
  memory_mb: number
  chart_image?: string | null
  scope_columns?: string | null
  created_at: string
}

export interface HistoryStats {
  total_queries: number
  success_rate_pct: number
  avg_time_ms: number
  avg_memory_mb: number
}

export interface HistoryResponse {
  data: AnalysisHistoryItem[]
  count: number
}

const getAuthHeaders = () => {
  const token = sessionStorage.getItem("access_token")
  return {
    Authorization: token ? `Bearer ${token}` : "",
  }
}

export const HistoryService = {
  async getHistory(
    skip = 0,
    limit = 50,
    search?: string,
    status_filter?: string
  ): Promise<HistoryResponse> {
    const params: Record<string, any> = { skip, limit }
    if (search) params.search = search
    if (status_filter && status_filter !== "all") params.status_filter = status_filter

    const response = await axios.get<HistoryResponse>(`${API_URL}/api/v1/history/`, {
      params,
      headers: getAuthHeaders(),
    })
    return response.data
  },

  async getStats(): Promise<HistoryStats> {
    const response = await axios.get<HistoryStats>(`${API_URL}/api/v1/history/stats`, {
      headers: getAuthHeaders(),
    })
    return response.data
  },

  async getHistoryItem(id: string): Promise<AnalysisHistoryItem> {
    const response = await axios.get<AnalysisHistoryItem>(
      `${API_URL}/api/v1/history/${id}`,
      { headers: getAuthHeaders() }
    )
    return response.data
  },

  async deleteHistoryItem(id: string): Promise<{ message: string }> {
    const response = await axios.delete<{ message: string }>(
      `${API_URL}/api/v1/history/${id}`,
      { headers: getAuthHeaders() }
    )
    return response.data
  },

  async clearAllHistory(): Promise<{ message: string }> {
    const response = await axios.delete<{ message: string }>(
      `${API_URL}/api/v1/history/actions/clear-all`,
      { headers: getAuthHeaders() }
    )
    return response.data
  },
}
