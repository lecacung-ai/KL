import { ResultFigure } from "@/components/Common/ResultFigure"
import { useState, useEffect } from "react"
import axios from "axios"
import { Send, FileSpreadsheet, Check, Copy, Code2, Database, TrendingUp, SlidersHorizontal, Upload, BarChart3, PieChart, AlertCircle, Download, CheckCircle2, ShieldCheck, Loader2, RotateCcw } from "lucide-react"
import { toast } from "sonner"
import { Link } from "@tanstack/react-router"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { LoadingButton } from "@/components/ui/loading-button"
import { DatasetsService, Dataset } from "@/services/datasetsService"

const QUICK_PROMPTS = [
  { icon: BarChart3, label: "Xu hướng doanh thu & chi phí", query: "Phân tích xu hướng doanh thu và chi phí theo từng tháng, vẽ biểu đồ đường so sánh" },
  { icon: TrendingUp, label: "Dự báo tăng trưởng kỳ tới", query: "Dựa vào dữ liệu lịch sử, dự báo xu hướng doanh thu cho 3 tháng tiếp theo và vẽ biểu đồ dự báo" },
  { icon: PieChart, label: "Phân tích biên lợi nhuận", query: "Tính toán lợi nhuận và biên lợi nhuận, vẽ biểu đồ cột thể hiện lợi nhuận theo từng giai đoạn" },
  { icon: AlertCircle, label: "Kiểm tra biến động chi phí", query: "Kiểm tra các khoản chi phí biến động bất thường so với mức trung bình và đưa ra cảnh báo" },
]

interface ColumnMetaSimple {
  name: string
  typeCategory?: string
}

interface AnalysisResult {
  file_name: string
  columns: string[]
  selected_scope?: string[]
  ai_code: string
  chart_image?: string | null
  stdout?: string | null
  execution_status?: "success" | "error" | "idle"
  execution_error?: string | null
  execution_time_ms?: number
  security_status?: "passed" | "blocked" | "idle"
}

export default function DataAnalyzer() {
  const [file, setFile] = useState<File | null>(null)
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>("")
  const [query, setQuery] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isCopied, setIsCopied] = useState(false)

  // Scope selection state (Module 4)
  const [availableColumns, setAvailableColumns] = useState<ColumnMetaSimple[]>([])
  const [selectedScopeColumns, setSelectedScopeColumns] = useState<string[]>([])
  const [isInspecting, setIsInspecting] = useState(false)

  // Result state (Module 5, 6, 7)
  const [result, setResult] = useState<AnalysisResult | null>(null)

  // Load user's existing datasets and auto-pick dataset if passed from Data Hub
  useEffect(() => {
    DatasetsService.getDatasets()
      .then((res) => {
        setDatasets(res.data)
        const storedId = sessionStorage.getItem("finai_selected_dataset_id")
        if (storedId) {
          const found = res.data.find((d) => d.id === storedId)
          if (found) {
            setSelectedDatasetId(storedId)
            extractColumnsFromDataset(found)
          }
          sessionStorage.removeItem("finai_selected_dataset_id")
        }
      })
      .catch(() => {})
  }, [])

  const extractColumnsFromDataset = (datasetItem: Dataset) => {
    try {
      if (datasetItem.schema_info) {
        const parsed = JSON.parse(datasetItem.schema_info)
        const cols: ColumnMetaSimple[] = []
        if (parsed.columns && Array.isArray(parsed.columns)) {
          parsed.columns.forEach((c: any) => {
            cols.push({
              name: c.name,
              typeCategory: c.type_category || c.dtype,
            })
          })
        }
        if (cols.length > 0) {
          setAvailableColumns(cols)
          // Mặc định: Không chọn cụ thể = phân tích toàn bộ tất cả các cột
          setSelectedScopeColumns([])
          return
        }
      }

      if (datasetItem.sample_data) {
        const samples = JSON.parse(datasetItem.sample_data)
        if (Array.isArray(samples) && samples.length > 0) {
          const keys = Object.keys(samples[0])
          const cols = keys.map((k) => ({ name: k }))
          setAvailableColumns(cols)
          setSelectedScopeColumns([])
          return
        }
      }
    } catch {
      // fallback
    }
    setAvailableColumns([])
    setSelectedScopeColumns([])
  }

  const handleSelectExistingDataset = (datasetId: string) => {
    setSelectedDatasetId(datasetId)
    setFile(null)
    const found = datasets.find((d) => d.id === datasetId)
    if (found) {
      extractColumnsFromDataset(found)
    } else {
      setAvailableColumns([])
      setSelectedScopeColumns([])
    }
  }

  // Tự động quét cấu trúc cột cho cả Excel (.xlsx, .xls) và CSV thông qua smart loader
  const handleLocalFileUpload = async (uploadedFile: File) => {
    setFile(uploadedFile)
    setSelectedDatasetId("")
    setAvailableColumns([])
    setSelectedScopeColumns([])
    setIsInspecting(true)

    try {
      const token = sessionStorage.getItem("access_token")
      const formData = new FormData()
      formData.append("file", uploadedFile)

      const response = await axios.post("http://localhost:8000/api/v1/files/inspect-columns", formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      })

      if (response.data?.columns && Array.isArray(response.data.columns)) {
        const cols: ColumnMetaSimple[] = response.data.columns.map((c: any) => ({
          name: c.name,
          typeCategory: c.type_category,
        }))
        setAvailableColumns(cols)
        setSelectedScopeColumns([]) // Mặc định không tick cột cụ thể = Phân tích toàn bộ dữ liệu
        toast.success(`Đã nhận diện ${cols.length} cột từ tệp "${uploadedFile.name}"! Mặc định phân tích toàn bộ các cột.`)
      }
    } catch (err: any) {
      console.warn("Inspect API error, falling back to local csv reader if applicable:", err)
      if (uploadedFile.name.endsWith(".csv")) {
        const reader = new FileReader()
        reader.onload = (e) => {
          const text = e.target?.result as string
          if (text) {
            const firstLine = text.split("\n")[0]
            const delimiter = firstLine.includes(";") ? ";" : (firstLine.includes("\t") ? "\t" : ",")
            const cols = firstLine.split(delimiter).map((c) => c.trim().replace(/^["']|["']$/g, "")).filter(Boolean)
            const colsObj = cols.map((c) => ({ name: c }))
            setAvailableColumns(colsObj)
            setSelectedScopeColumns([])
          }
        }
        reader.readAsText(uploadedFile.slice(0, 4096))
      } else {
        toast.error("Không thể đọc danh sách cột từ tệp Excel. Vui lòng thử lại.")
      }
    } finally {
      setIsInspecting(false)
    }
  }

  // Toggle chọn / bỏ chọn từng cột
  const toggleColumnScope = (colName: string) => {
    // Nếu đang ở trạng thái mặc định (toàn bộ cột, mảng rỗng)
    // Người dùng bấm vào 1 cột tức là họ muốn CHỈ phân tích cột này
    if (selectedScopeColumns.length === 0) {
      setSelectedScopeColumns([colName])
      return
    }

    if (selectedScopeColumns.includes(colName)) {
      const next = selectedScopeColumns.filter((c) => c !== colName)
      setSelectedScopeColumns(next)
      if (next.length === 0) {
        toast.info("Đã bỏ chọn tất cả: Sẽ phân tích TOÀN BỘ các cột dữ liệu (Mặc định).")
      }
    } else {
      setSelectedScopeColumns([...selectedScopeColumns, colName])
    }
  }

  // Chọn tất cả các cột
  const selectAllScope = () => {
    setSelectedScopeColumns(availableColumns.map((c) => c.name))
    toast.success(`Đã chọn toàn bộ ${availableColumns.length} cột.`)
  }

  // Đặt lại về mặc định (Toàn bộ dữ liệu)
  const resetToDefaultScope = () => {
    setSelectedScopeColumns([])
    toast.info("Đã chuyển về mặc định: Phân tích toàn bộ dữ liệu.")
  }

  const handleAnalyze = async () => {
    if (!file && !selectedDatasetId) {
      toast.error("Vui lòng chọn tệp từ Kho Dữ Liệu hoặc tải tệp mới lên")
      return
    }

    if (!query.trim()) {
      toast.error("Vui lòng nhập câu hỏi hoặc chọn câu hỏi gợi ý nghiệp vụ")
      return
    }

    const token = sessionStorage.getItem("access_token")
    if (!token) {
      toast.error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.")
      return
    }

    const formData = new FormData()
    formData.append("query", query)

    // Module 4: Gửi phạm vi cột chỉ định cho AI
    // Nếu người dùng chọn một tập hợp cột cụ thể (khác toàn bộ), gửi scope_columns
    // Nếu không chọn cột nào (hoặc chọn tất cả), không gửi scope_columns để AI phân tích toàn bộ dữ liệu
    if (selectedScopeColumns.length > 0 && selectedScopeColumns.length < availableColumns.length) {
      formData.append("scope_columns", selectedScopeColumns.join(","))
    }

    if (file) {
      formData.append("file", file)
    } else {
      const selected = datasets.find((d) => d.id === selectedDatasetId)
      if (!selected) {
        toast.error("Không tìm thấy tệp đã chọn")
        return
      }
      try {
        const blobRes = await axios.get(DatasetsService.getDownloadUrl(selected.id), {
          responseType: "blob",
          headers: { Authorization: `Bearer ${token}` },
        })
        const fetchedFile = new File([blobRes.data], selected.filename, {
          type: blobRes.data.type || "application/octet-stream",
        })
        formData.append("file", fetchedFile)
      } catch {
        toast.error("Không thể tải tệp từ kho dữ liệu")
        return
      }
    }

    try {
      setIsLoading(true)
      const response = await axios.post("http://localhost:8000/api/v1/files/upload", formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      })

      setResult({
        file_name: response.data.file_name,
        columns: response.data.columns || [],
        selected_scope: response.data.selected_scope || [],
        ai_code: response.data.ai_code || "",
        chart_image: response.data.chart_image || null,
        stdout: response.data.stdout || null,
        execution_status: response.data.execution_status || "idle",
        execution_error: response.data.execution_error || null,
        execution_time_ms: response.data.execution_time_ms,
        security_status: response.data.security_status,
      })

      if (response.data.chart_image) {
        toast.success("Đã hoàn tất phân tích và vẽ biểu đồ thành công!")
      } else {
        toast.success("Đã thực thi phân tích dữ liệu thành công!")
      }
    } catch (error: any) {
      const errDetail = error.response?.data?.detail || "Lỗi kết nối khi gửi dữ liệu phân tích"
      toast.error(errDetail)
    } finally {
      setIsLoading(false)
    }
  }

  const copyCode = () => {
    if (result?.ai_code) {
      navigator.clipboard.writeText(result.ai_code)
      setIsCopied(true)
      toast.success("Đã sao chép mã Python vào Clipboard!")
      setTimeout(() => setIsCopied(false), 2000)
    }
  }

  return (
    <div className="finai-analyzer min-w-0 overflow-hidden rounded-[26px] text-card-foreground">
      <div className="finai-analyzer-intro flex flex-wrap items-start justify-between gap-4 p-6 sm:p-8">
        <div className="min-w-0 max-w-2xl">
          <p className="finai-eyebrow text-[#f5c579]">Bắt đầu khám phá</p>
          <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Bạn muốn tìm hiểu điều gì?</h2>
          <p className="mt-3 max-w-xl text-sm leading-7 text-white/70">Đi theo ba bước: chọn nguồn dữ liệu, xác định phạm vi và đặt câu hỏi. Kết quả sẽ được giữ ngay trong không gian này.</p>
        </div>
        <Button asChild variant="outline" size="sm" className="border-white/25 bg-white/10 text-white hover:bg-white/20 hover:text-white"><Link to="/datasets"><Database className="size-4" /> Kho dữ liệu ({datasets.length})</Link></Button>
      </div>

      <div className="finai-analyzer-workflow space-y-8 bg-card p-4 sm:p-7">
        {/* Step 1: Chọn nguồn dữ liệu */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="flex size-5 items-center justify-center rounded-md bg-blue-600/10 text-primary dark:bg-blue-400/10 dark:text-primary text-xs font-semibold">1</span>
            <span className="text-xs font-semibold tracking-normal text-muted-foreground">Chọn dữ liệu</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Cách 1: Chọn từ Kho Dữ Liệu */}
            <div
              className={`finai-source-option rounded-2xl border p-5 transition-colors ${
                selectedDatasetId
                  ? "border-primary/20 bg-primary/5 dark:bg-primary/10 shadow-sm"
                  : "border-border hover:border-muted-foreground/30 bg-muted/20"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Database className="size-3.5 text-primary" /> Chọn tệp đã lưu
                </p>
                {selectedDatasetId && (
                  <Badge variant="outline" className="text-xs bg-primary/5 text-primary dark:bg-primary/10 dark:text-blue-300 font-medium">
                    Đang chọn
                  </Badge>
                )}
              </div>

              {datasets.length > 0 ? (
                <select
                  aria-label="Chọn tệp đã lưu"
                  value={selectedDatasetId}
                  onChange={(e) => handleSelectExistingDataset(e.target.value)}
                  className="w-full h-9 rounded-lg border border-input bg-background px-3 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                >
                  <option value="">-- Bấm chọn tệp trong kho dữ liệu --</option>
                  {datasets.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.filename} (v{d.version} • {d.row_count} dòng • {d.column_count} cột)
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-xs text-muted-foreground italic">
                  Chưa có tệp nào trong kho. Hãy tải tệp mới từ máy tính.
                </p>
              )}
            </div>

            {/* Cách 2: Tải file mới trực tiếp */}
            <div
              className={`finai-source-option rounded-2xl border p-5 transition-colors ${
                file
                  ? "border-emerald-500/60 bg-emerald-50/20 dark:bg-emerald-950/20 shadow-sm"
                  : "border-border hover:border-muted-foreground/30 bg-muted/20"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <FileSpreadsheet className="size-3.5 text-emerald-500" /> Chọn tệp từ máy tính
                </p>
                {file && (
                  <Badge variant="outline" className="text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 font-medium">
                    Tệp cục bộ
                  </Badge>
                )}
              </div>

              <label className="flex min-h-12 items-center justify-between gap-3 border border-dashed border-input hover:border-emerald-500 bg-background/60 hover:bg-muted/40 rounded-lg h-9 px-3 text-xs transition-colors cursor-pointer group">
                <div className="flex items-center gap-2 truncate">
                  <Upload className="size-3.5 text-muted-foreground group-hover:text-emerald-500 shrink-0" />
                  <span className="truncate text-foreground font-medium">
                    {file ? file.name : "Nhấp để chọn tệp .xlsx / .csv..."}
                  </span>
                </div>
                <span className="text-xs font-semibold bg-muted px-2 py-0.5 rounded text-muted-foreground group-hover:bg-emerald-50 group-hover:text-emerald-700 dark:group-hover:bg-emerald-950 dark:group-hover:text-emerald-300 shrink-0">
                  {file ? "Thay đổi" : "Duyệt tệp"}
                </span>
                <input
                  type="file"
                  accept=".csv, .xlsx, .xls"
                  className="sr-only"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleLocalFileUpload(e.target.files[0])
                    }
                  }}
                />
              </label>
            </div>
          </div>
        </div>

        {/* Step 2 (Module 4): Chọn phạm vi phân tích theo cột */}
        {availableColumns.length === 0 ? (
          <div className="space-y-3 rounded-xl border border-dashed bg-muted/10 p-4 transition-all">
            <div className="flex items-center gap-3">
              <div className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground shrink-0">
                {isInspecting ? (
                  <Loader2 className="size-4 animate-spin text-primary" />
                ) : (
                  <SlidersHorizontal className="size-4" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="flex size-5 items-center justify-center rounded-md bg-blue-600/10 text-primary dark:bg-blue-400/10 dark:text-primary text-xs font-semibold shrink-0">2</span>
                  <h4 className="text-xs font-semibold tracking-normal text-foreground flex items-center gap-2">
                    Phạm Vi Dữ Liệu Phân Tích (Chọn Cột)
                    {isInspecting && (
                      <Badge variant="outline" className="text-xs bg-primary/5 text-primary border-primary/20 ">
                        Đang quét cấu trúc cột...
                      </Badge>
                    )}
                  </h4>
                </div>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  {isInspecting
                    ? "Đang tự động quét và phân loại các cột trong tệp..."
                    : "Chưa có nguồn dữ liệu. Hãy chọn tệp trong Kho dữ liệu hoặc tải tệp Excel/CSV lên ở Bước 1. Hệ thống sẽ hiển thị danh sách cột để bạn chọn lựa (mặc định phân tích toàn bộ nếu không chọn cụ thể)."}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3 rounded-xl border bg-muted/20 p-4 transition-all">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
              <div className="flex items-center gap-2">
                <span className="flex size-5 items-center justify-center rounded-md bg-blue-600/10 text-primary dark:bg-blue-400/10 dark:text-primary text-xs font-semibold">2</span>
                <div className="flex size-7 items-center justify-center rounded-lg bg-primary/5 text-primary dark:bg-primary/10 dark:text-primary">
                  <SlidersHorizontal className="size-4" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold tracking-normal text-foreground">
                    Phạm Vi Dữ Liệu Phân Tích (Chọn Cột)
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Bấm chọn các cột bạn cần AI tập trung phân tích. Mặc định sẽ phân tích trên toàn bộ các cột nếu không chọn cụ thể.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {selectedScopeColumns.length === 0 ? (
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-400 text-xs font-semibold gap-1 py-1">
                    <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                    Mặc định: Toàn bộ {availableColumns.length} cột
                  </Badge>
                ) : selectedScopeColumns.length === availableColumns.length ? (
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-400 text-xs font-semibold gap-1 py-1">
                    <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                    Đã chọn tất cả ({availableColumns.length} cột)
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 dark:bg-primary/10 dark:text-blue-300 text-xs font-semibold gap-1 py-1">
                    <SlidersHorizontal className="size-3.5 text-primary" />
                    Đã chọn: {selectedScopeColumns.length} / {availableColumns.length} cột
                  </Badge>
                )}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={selectAllScope}
                  className="h-7 text-xs px-2.5 text-primary hover:text-primary hover:bg-primary/5 dark:hover:bg-primary/10 font-medium"
                >
                  Chọn tất cả
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={resetToDefaultScope}
                  className="h-7 text-xs px-2.5 text-muted-foreground hover:text-foreground hover:bg-muted font-medium gap-1"
                >
                  <RotateCcw className="size-3" /> Mặc định (Tất cả cột)
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-1 max-h-48 overflow-y-auto">
              {availableColumns.map((col) => {
                const isExplicitlyFiltered = selectedScopeColumns.length > 0
                const isSelected = selectedScopeColumns.includes(col.name)
                const isDefaultActive = !isExplicitlyFiltered

                return (
                  <button
                    key={col.name}
                    type="button"
                    onClick={() => toggleColumnScope(col.name)}
                    title={isDefaultActive ? "Đang áp dụng trong toàn bộ dữ liệu. Bấm để chỉ chọn cột này." : (isSelected ? "Bấm để bỏ chọn cột này." : "Bấm để thêm cột này.")}
                    className={`flex min-h-10 max-w-full items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium transition-colors ${
                      isDefaultActive
                        ? "border-border/80 bg-card hover:border-blue-400 hover:bg-primary/5 dark:hover:bg-primary/10 text-foreground"
                        : isSelected
                        ? "border-primary/20 bg-primary/5 text-blue-900 dark:bg-primary/10 dark:text-blue-200 shadow-sm ring-1 ring-blue-500/20"
                        : "border-border/50 bg-muted/20 text-muted-foreground/60 hover:border-muted-foreground/40 hover:text-foreground opacity-50"
                    }`}
                  >
                    <div className={`size-3.5 rounded flex items-center justify-center border text-[9px] font-semibold ${
                      isDefaultActive
                        ? "border-emerald-500 bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400"
                        : isSelected
                        ? "border-blue-600 bg-primary text-primary-foreground"
                        : "border-muted-foreground/40"
                    }`}>
                      {(isDefaultActive || isSelected) && "✓"}
                    </div>
                    <span className="min-w-0 max-w-[220px] break-all font-mono">{col.name}</span>
                    {col.typeCategory && (
                      <Badge variant="secondary" className="text-xs py-0 px-1.5 h-4 font-normal">
                        {col.typeCategory}
                      </Badge>
                    )}
                  </button>
                )
              })}
            </div>

            <p className="text-xs text-muted-foreground flex items-center gap-1.5 pt-1 border-t">
              <span>💡 <strong>Quy tắc phạm vi:</strong> Bấm vào từng cột để chọn chỉ phân tích cột đó. Nếu không chọn cột nào (hoặc bấm nút "Mặc định"), AI sẽ phân tích trên toàn bộ bảng dữ liệu.</span>
            </p>
          </div>
        )}

        {/* Step 3: Nhập câu hỏi hoặc chọn câu hỏi mẫu */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="flex size-5 items-center justify-center rounded-md bg-blue-600/10 text-primary dark:bg-blue-400/10 dark:text-primary text-xs font-semibold">
              3
            </span>
            <span className="text-xs font-semibold tracking-normal text-muted-foreground">Đặt câu hỏi của bạn</span>
          </div>

          {/* Quick Prompt Pills with modern icons */}
          <div className="flex flex-wrap gap-2">
            {QUICK_PROMPTS.map((p, idx) => {
              const IconComponent = p.icon
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setQuery(p.query)}
                  className="flex items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-all hover:border-primary/20 hover:bg-primary/5 hover:text-primary dark:hover:bg-primary/10 dark:hover:text-blue-300 shadow-sm"
                >
                  <IconComponent className="size-3.5 text-primary shrink-0" />
                  <span>{p.label}</span>
                </button>
              )
            })}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              aria-label="Câu hỏi phân tích"
              placeholder="VD: Vẽ biểu đồ so sánh doanh thu và chi phí theo từng tháng, tính tốc độ tăng trưởng..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
              className="flex-1 h-11 rounded-xl border border-input bg-background px-4 text-sm text-foreground placeholder:text-muted-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            <LoadingButton
              onClick={handleAnalyze}
              loading={isLoading}
              className="h-11 px-5 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl shadow-none gap-2 shrink-0"
            >
              <Send className="size-4" /> Phân Tích Ngay
            </LoadingButton>
          </div>
        </div>

        {/* Step 4: Kết quả phân tích & Biểu đồ trực quan (Module 6 & 7) */}
        {result && (
          <div className="finai-result mt-6 rounded-xl border bg-muted/20 p-5 space-y-4 animate-in fade-in-50 duration-300">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
              <div className="flex items-center gap-2">
                <div className="flex size-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                  <TrendingUp className="size-4" />
                </div>
                <h3 className="font-semibold text-sm text-foreground">
                  Kết quả phân tích: <span className="text-primary dark:text-primary">{result.file_name}</span>
                </h3>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {result.execution_time_ms !== undefined && result.execution_time_ms > 0 && (
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-400 gap-1 text-xs font-medium py-1">
                    <ShieldCheck className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                    Sandbox an toàn ({result.execution_time_ms}ms)
                  </Badge>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyCode}
                  className="gap-1.5 h-8 text-xs font-medium"
                >
                  {isCopied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
                  {isCopied ? "Đã chép" : "Sao chép mã Python"}
                </Button>
              </div>
            </div>

            {/* Phạm vi áp dụng thực tế */}
            {result.selected_scope && result.selected_scope.length > 0 ? (
              <div className="flex items-center gap-2 text-xs p-3 rounded-lg bg-primary/5 dark:bg-primary/10 text-blue-900 dark:text-blue-300 border border-primary/20 dark:border-blue-900">
                <SlidersHorizontal className="size-4 shrink-0 text-primary dark:text-primary" />
                <span>
                  Phạm vi đã áp dụng: <strong>{result.selected_scope.length} cột</strong> ({result.selected_scope.join(", ")})
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs p-3 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900">
                <CheckCircle2 className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span>
                  Phạm vi đã áp dụng: <strong>Toàn bộ dữ liệu</strong> ({result.columns?.length || 0} cột)
                </span>
              </div>
            )}

            {/* Các cột dữ liệu nhận diện */}
            {result.columns && result.columns.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="font-semibold text-muted-foreground">Các cột được phân tích:</span>
                {result.columns.map((col, idx) => (
                  <Badge key={idx} variant="secondary" className="font-mono text-xs">
                    {col}
                  </Badge>
                ))}
              </div>
            )}

            {/* Tabs hiển thị Kết quả thực thi biểu đồ & Mã nguồn (Module 6 & 7) */}
            <Tabs defaultValue="chart" className="w-full">
              <TabsList className="grid w-full max-w-sm grid-cols-2">
                <TabsTrigger value="chart" className="text-xs font-semibold gap-1.5">
                  <BarChart3 className="size-3.5 text-primary dark:text-primary" /> Kết quả & biểu đồ
                </TabsTrigger>
                <TabsTrigger value="code" className="text-xs font-semibold gap-1.5">
                  <Code2 className="size-3.5" /> Mã Python
                </TabsTrigger>
              </TabsList>

              {/* Tab 1: Kết Quả & Biểu Đồ Thực Thi */}
              <TabsContent value="chart" className="mt-3 space-y-4">
                {result.chart_image ? (
                  <div className="rounded-xl border bg-card p-4 space-y-3 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
                        <h4 className="font-semibold text-xs tracking-normal text-foreground">
                          Biểu đồ kết quả
                        </h4>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const link = document.createElement("a")
                          link.href = result.chart_image!
                          link.download = `finai_chart_${Date.now()}.png`
                          link.click()
                        }}
                        className="h-8 text-xs gap-1.5 font-medium"
                      >
                        <Download className="size-3.5" /> Tải Ảnh Biểu Đồ
                      </Button>
                    </div>

                    <div className="rounded-xl overflow-hidden border bg-background/60 flex items-center justify-center p-3">
                      <ResultFigure src={result.chart_image} alt="Biểu đồ phân tích tài chính" />
                    </div>
                  </div>
                ) : (
                  result.execution_status === "success" && !result.stdout && (
                    <div className="rounded-xl border bg-card p-6 text-center text-xs text-muted-foreground space-y-1">
                      <CheckCircle2 className="size-6 text-emerald-600 mx-auto" />
                      <p className="font-semibold text-foreground">Mã nguồn đã được thực thi thành công!</p>
                      <p>Không có hình ảnh biểu đồ hoặc văn bản xuất ra.</p>
                    </div>
                  )
                )}

                {/* Kết quả tính toán bằng lệnh in (stdout) */}
                {result.stdout && (
                  <div className="rounded-xl border bg-card p-4 space-y-2 shadow-sm">
                    <h4 className="font-semibold text-xs tracking-normal text-muted-foreground flex items-center gap-1.5">
                      <TrendingUp className="size-3.5 text-primary" /> Số liệu & diễn giải
                    </h4>
                    <pre className="rounded-lg bg-muted/40 p-3 text-xs font-mono overflow-x-auto text-foreground whitespace-pre-wrap leading-relaxed">
                      {result.stdout}
                    </pre>
                  </div>
                )}

                {/* Thông báo lỗi nếu chạy thất bại */}
                {result.execution_status === "error" && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50/70 dark:bg-rose-950/40 p-4 space-y-2 text-rose-900 dark:text-rose-300 text-xs">
                    <div className="flex items-center gap-2 font-semibold">
                      <AlertCircle className="size-4 text-rose-600 dark:text-rose-400" />
                      <span>Thông Báo Quá Trình Thực Thi</span>
                    </div>
                    <pre className="font-mono text-xs whitespace-pre-wrap bg-background/70 p-2.5 rounded border border-rose-200 dark:border-rose-900">
                      {result.execution_error || "Mã nguồn gặp lỗi trong quá trình thực thi trên máy chủ."}
                    </pre>
                  </div>
                )}
              </TabsContent>

              {/* Tab 2: Mã nguồn Python */}
              <TabsContent value="code" className="mt-3">
                <pre className="rounded-xl border bg-slate-950 text-slate-100 p-4 text-xs font-mono overflow-x-auto leading-relaxed shadow-inner max-h-[380px]">
                  <code>{result.ai_code}</code>
                </pre>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>
    </div>
  )
}
