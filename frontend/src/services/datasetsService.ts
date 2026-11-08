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

export interface TableRegionInspection {
  table_id: string
  range: string
  top_row: number
  bottom_row: number
  left_col: number
  right_col: number
  has_header: boolean
  headers?: string[]
}

export interface MissingCellDetail {
  row_index: number
  column_index: number
  column_name: string
  suggested_fixes?: Record<string, any>
  row_context?: Record<string, string>
}

export interface SheetColumnMeta {
  name: string
  index: number
  dtype: string
  type_category: string
  missing_count: number
  missing_percentage: number
  sample_values?: string[]
  suggestions?: string[]
  fill_suggestions?: Record<string, any>
}

export interface MissingSummary {
  total_missing: number
  affected_rows: number
  empty_rows_count: number
  columns_with_missing: SheetColumnMeta[]
}

export interface SheetInspection {
  name: string
  index: number
  is_empty?: boolean
  row_count: number
  column_count: number
  has_header: boolean
  header_type: string
  header_row_index?: number | null
  layout?: string
  is_multi_table: boolean
  table_regions: TableRegionInspection[]
  columns: SheetColumnMeta[]
  empty_rows: number[]
  missing_summary: MissingSummary
  missing_cells: MissingCellDetail[]
  sample_data: Array<Record<string, any>>
}

export interface MergeableSheetGroup {
  sheet_names: string[]
  column_count: number
  columns: string[]
  suggested_name: string
  message: string
}

export interface SpecialCasesSummary {
  has_no_header_sheets: string[]
  has_missing_values_sheets: Array<{
    sheet_name: string
    total_missing: number
    affected_rows: number
    empty_rows_count: number
    columns: string[]
  }>
  is_multi_sheet: boolean
  total_sheets: number
  mergeable_sheet_groups: MergeableSheetGroup[]
  multi_table_sheets: Array<{
    sheet_name: string
    tables_count: number
    regions: string[]
  }>
}

export interface WorkbookInspection {
  filename: string
  file_type: string
  total_sheets: number
  sheets: SheetInspection[]
  mergeable_sheet_groups?: MergeableSheetGroup[]
  special_cases_summary?: SpecialCasesSummary
}

export interface InteractiveUploadConfig {
  selected_sheet?: string
  selected_table_id?: string | null
  header_mode?: "detected" | "custom_row" | "custom_names" | "no_header"
  header_row_index?: number | null
  column_renames?: Record<string, string>
  cell_fixes?: Array<{ row: number; col: string; value: any }>
  column_fills?: Record<string, any>
  drop_empty_rows?: boolean
  drop_any_missing_rows?: boolean
  missing_choice?: "drop_rows" | "fill_zero" | "keep_raw" | "manual_fix" | "default"
  multi_sheet_action?: "single" | "merge" | "split_all"
  sheets_to_merge?: string[]
  allow_no_header?: boolean
  custom_column_names?: string[] | Record<string, string>
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

  async bulkDeleteDatasets(ids: string[]): Promise<{ message: string }> {
    const response = await axios.post<{ message: string }>(
      `${API_URL}/api/v1/datasets/bulk-delete`,
      { ids },
      { headers: getAuthHeaders() }
    )
    return response.data
  },

  async deleteDataset(id: string): Promise<{ message: string }> {
    const response = await axios.delete<{ message: string }>(`${API_URL}/api/v1/datasets/${id}`, {
      headers: getAuthHeaders(),
    })
    return response.data
  },

  async inspectWorkbook(file: File): Promise<WorkbookInspection> {
    const formData = new FormData()
    formData.append("file", file)
    const response = await axios.post<WorkbookInspection>(`${API_URL}/api/v1/datasets/inspect-workbook`, formData, {
      headers: {
        ...getAuthHeaders(),
        "Content-Type": "multipart/form-data",
      },
    })
    return response.data
  },

  async uploadDatasetInteractive(
    file: File,
    config: InteractiveUploadConfig,
    description?: string
  ): Promise<Dataset> {
    const formData = new FormData()
    formData.append("file", file)
    formData.append("config", JSON.stringify(config))
    if (description) {
      formData.append("description", description)
    }
    const response = await axios.post<Dataset>(`${API_URL}/api/v1/datasets/upload-interactive`, formData, {
      headers: {
        ...getAuthHeaders(),
        "Content-Type": "multipart/form-data",
      },
    })
    return response.data
  },

  getDownloadUrl(id: string): string {
    return `${API_URL}/api/v1/datasets/${id}/download`
  },
}
