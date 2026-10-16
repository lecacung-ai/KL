import axios from "axios"

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000"

export interface DatasetColumnMeta {
  name: string
  dtype: string
  type_category?: string
  missing_count: number
  missing_percentage: number
  unique_count?: number
  is_constant?: boolean
  sample_values?: string[]
  min?: number
  max?: number
  mean?: number
  median?: number
}

export interface DatasetQualityProfile {
  row_count: number
  column_count: number
  duplicate_rows: number
  total_missing_cells: number
  health_score: number
  columns: DatasetColumnMeta[]
  recommendations: string[]
}

export interface Dataset {
  id: string
  filename: string
  file_type: string
  size_bytes: number
  row_count: number
  column_count: number
  version: number
  status: "ready" | "processing" | "error"
  description?: string | null
  schema_info?: string | null
  sample_data?: string | null
  created_at: string
  owner_id: string
}

export interface DatasetsResponse {
  data: Dataset[]
  count: number
}

const getAuthHeaders = () => {
  const token = sessionStorage.getItem("access_token")
  return {
    Authorization: token ? `Bearer ${token}` : "",
  }
}

export const DatasetsService = {
  async getDatasets(skip = 0, limit = 100): Promise<DatasetsResponse> {
    const response = await axios.get<DatasetsResponse>(`${API_URL}/api/v1/datasets/`, {
      params: { skip, limit },
      headers: getAuthHeaders(),
    })
    return response.data
  },

  async getDataset(id: string): Promise<Dataset> {
    const response = await axios.get<Dataset>(`${API_URL}/api/v1/datasets/${id}`, {
      headers: getAuthHeaders(),
    })
    return response.data
  },

  async getQualityReport(id: string): Promise<{
    dataset_id: string
    filename: string
    version: number
    row_count: number
    column_count: number
    size_bytes: number
    status: string
    quality_profile: DatasetQualityProfile
  }> {
    const response = await axios.get(`${API_URL}/api/v1/datasets/${id}/quality-report`, {
      headers: getAuthHeaders(),
    })
    return response.data
  },

  async uploadDataset(file: File, description?: string): Promise<Dataset> {
    const formData = new FormData()
    formData.append("file", file)
    if (description) {
      formData.append("description", description)
    }

    const response = await axios.post<Dataset>(`${API_URL}/api/v1/datasets/upload`, formData, {
      headers: {
        ...getAuthHeaders(),
        "Content-Type": "multipart/form-data",
      },
    })
    return response.data
  },

  async cleanDataset(id: string): Promise<Dataset> {
    const response = await axios.post<Dataset>(`${API_URL}/api/v1/datasets/${id}/clean`, {}, {
      headers: getAuthHeaders(),
    })
    return response.data
  },

  async deleteDataset(id: string): Promise<{ message: string }> {
    const response = await axios.delete<{ message: string }>(`${API_URL}/api/v1/datasets/${id}`, {
      headers: getAuthHeaders(),
    })
    return response.data
  },

  getDownloadUrl(id: string): string {
    return `${API_URL}/api/v1/datasets/${id}/download`
  },
}
