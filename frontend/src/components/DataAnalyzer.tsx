import { useState, useEffect } from "react"
import axios from "axios"
import {
  Sparkles,
  Send,
  FileSpreadsheet,
  Check,
  Copy,
  Code2,
  Database,
  TrendingUp,
  SlidersHorizontal,
  Upload,
  BarChart3,
  PieChart,
  AlertCircle,
  Download,
  CheckCircle2,
  ShieldCheck,
} from "lucide-react"
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
          setSelectedScopeColumns(cols.map((c) => c.name))
          return
        }
      }

      if (datasetItem.sample_data) {
        const samples = JSON.parse(datasetItem.sample_data)
        if (Array.isArray(samples) && samples.length > 0) {
          const keys = Object.keys(samples[0])
          const cols = keys.map((k) => ({ name: k }))
          setAvailableColumns(cols)
          setSelectedScopeColumns(keys)
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

  const handleLocalFileUpload = (uploadedFile: File) => {
    setFile(uploadedFile)
    setSelectedDatasetId("")

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
          setSelectedScopeColumns(cols)
        }
      }
      reader.readAsText(uploadedFile.slice(0, 4096))
    } else {
      setAvailableColumns([])
      setSelectedScopeColumns([])
    }
  }

  const toggleColumnScope = (colName: string) => {
    if (selectedScopeColumns.includes(colName)) {
      if (selectedScopeColumns.length === 1) {
        toast.warning("Cần chọn ít nhất 1 cột trong phạm vi phân tích")
        return
      }
      setSelectedScopeColumns(selectedScopeColumns.filter((c) => c !== colName))
    } else {
      setSelectedScopeColumns([...selectedScopeColumns, colName])
    }
  }

  const selectAllScope = () => {
    setSelectedScopeColumns(availableColumns.map((c) => c.name))
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
    if (selectedScopeColumns.length > 0) {
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
    <div className="mt-6 rounded-2xl border bg-card text-card-foreground shadow-sm overflow-hidden transition-all">
      {/* Header Banner - Enterprise Professional */}
      <div className="bg-gradient-to-r from-blue-600/10 via-indigo-600/10 to-cyan-500/10 p-6 border-b">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="flex size-11 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
              <Sparkles className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-xl font-bold tracking-tight text-foreground">
                  Trợ Lý Phân Tích Dữ Liệu Doanh Nghiệp
                </h2>
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 gap-1.5 text-xs font-semibold py-0.5 px-2.5">
                  <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" /> Sẵn sàng phân tích
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Xử lý ngôn ngữ tự nhiên, tự động suy luận dữ liệu kinh doanh và trực quan hóa báo cáo tài chính.
              </p>
            </div>
          </div>

          <Link to="/datasets">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs font-semibold h-9">
              <Database className="size-3.5" /> Quản Lý Kho Dữ Liệu ({datasets.length})
            </Button>
          </Link>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Step 1: Chọn nguồn dữ liệu */}
        <div className="space-y-2.5">
          <div className="flex items-center gap-2">
            <span className="flex size-5 items-center justify-center rounded-md bg-blue-600/10 text-blue-600 dark:bg-blue-400/10 dark:text-blue-400 text-[11px] font-black">1</span>
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Chọn Nguồn Dữ Liệu Cần Phân Tích</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Cách 1: Chọn từ Kho Dữ Liệu */}
            <div
              className={`rounded-xl border p-3.5 transition-all ${
                selectedDatasetId
                  ? "border-blue-500/60 bg-blue-50/20 dark:bg-blue-950/20 shadow-sm"
                  : "border-border hover:border-muted-foreground/30 bg-muted/20"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Database className="size-3.5 text-blue-500" /> Chọn từ Kho Dữ Liệu Doanh Nghiệp
                </p>
                {selectedDatasetId && (
                  <Badge variant="outline" className="text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 font-medium">
                    Đang chọn
                  </Badge>
                )}
              </div>

              {datasets.length > 0 ? (
                <select
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
              className={`rounded-xl border p-3.5 transition-all ${
                file
                  ? "border-emerald-500/60 bg-emerald-50/20 dark:bg-emerald-950/20 shadow-sm"
                  : "border-border hover:border-muted-foreground/30 bg-muted/20"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <FileSpreadsheet className="size-3.5 text-emerald-500" /> Tải Tệp Mới Từ Máy Tính
                </p>
                {file && (
                  <Badge variant="outline" className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 font-medium">
                    Tệp cục bộ
                  </Badge>
                )}
              </div>

              <label className="flex items-center justify-between gap-3 border border-dashed border-input hover:border-emerald-500 bg-background/60 hover:bg-muted/40 rounded-lg h-9 px-3 text-xs transition-colors cursor-pointer group">
                <div className="flex items-center gap-2 truncate">
                  <Upload className="size-3.5 text-muted-foreground group-hover:text-emerald-500 shrink-0" />
                  <span className="truncate text-foreground font-medium">
                    {file ? file.name : "Nhấp để chọn tệp .xlsx / .csv..."}
                  </span>
                </div>
                <span className="text-[10px] font-semibold bg-muted px-2 py-0.5 rounded text-muted-foreground group-hover:bg-emerald-50 group-hover:text-emerald-700 dark:group-hover:bg-emerald-950 dark:group-hover:text-emerald-300 shrink-0">
                  {file ? "Thay đổi" : "Duyệt tệp"}
                </span>
                <input
                  type="file"
                  accept=".csv, .xlsx, .xls"
                  className="hidden"
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
        {availableColumns.length > 0 && (
          <div className="space-y-3 rounded-xl border bg-muted/20 p-4 transition-all">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="flex size-7 items-center justify-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400">
                  <SlidersHorizontal className="size-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                    Phạm Vi Dữ Liệu Phân Tích (Chọn Cột)
                  </h4>
                  <p className="text-[11px] text-muted-foreground">
                    Thu hẹp ngữ cảnh để hệ thống tập trung phân tích chính xác các chỉ số tài chính bạn quan tâm.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 text-xs font-semibold">
                  Đã chọn: {selectedScopeColumns.length} / {availableColumns.length} cột
                </Badge>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={selectAllScope}
                  className="h-7 text-xs px-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950 font-medium"
                >
                  Chọn tất cả
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              {availableColumns.map((col) => {
                const isSelected = selectedScopeColumns.includes(col.name)
                return (
                  <button
                    key={col.name}
                    type="button"
                    onClick={() => toggleColumnScope(col.name)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                      isSelected
                        ? "border-blue-500 bg-blue-50/80 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 shadow-sm ring-1 ring-blue-500/20"
                        : "border-border bg-card text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground opacity-60"
                    }`}
                  >
                    <div className={`size-3.5 rounded flex items-center justify-center border text-[9px] font-bold ${
                      isSelected ? "border-blue-600 bg-blue-600 text-white" : "border-muted-foreground"
                    }`}>
                      {isSelected && "✓"}
                    </div>
                    <span className="font-mono">{col.name}</span>
                    {col.typeCategory && (
                      <Badge variant="secondary" className="text-[10px] py-0 px-1.5 h-4 font-normal">
                        {col.typeCategory}
                      </Badge>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Step 3: Nhập câu hỏi hoặc chọn câu hỏi mẫu */}
        <div className="space-y-2.5">
          <div className="flex items-center gap-2">
            <span className="flex size-5 items-center justify-center rounded-md bg-blue-600/10 text-blue-600 dark:bg-blue-400/10 dark:text-blue-400 text-[11px] font-black">
              {availableColumns.length > 0 ? "3" : "2"}
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Yêu Cầu Nghiệp Vụ Cần Phân Tích</span>
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
                  className="flex items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-all hover:border-blue-500/50 hover:bg-blue-50/50 hover:text-blue-600 dark:hover:bg-blue-950/40 dark:hover:text-blue-300 shadow-sm"
                >
                  <IconComponent className="size-3.5 text-blue-500/80 shrink-0" />
                  <span>{p.label}</span>
                </button>
              )
            })}
          </div>

          <div className="flex gap-2">
            <input
              placeholder="VD: Vẽ biểu đồ so sánh doanh thu và chi phí theo từng tháng, tính tốc độ tăng trưởng..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
              className="flex-1 h-11 rounded-xl border border-input bg-background px-4 text-sm text-foreground placeholder:text-muted-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            <LoadingButton
              onClick={handleAnalyze}
              loading={isLoading}
              className="h-11 px-5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-md shadow-blue-500/20 gap-2 shrink-0"
            >
              <Send className="size-4" /> Phân Tích Ngay
            </LoadingButton>
          </div>
        </div>

        {/* Step 4: Kết quả phân tích & Biểu đồ trực quan (Module 6 & 7) */}
        {result && (
          <div className="mt-6 rounded-xl border bg-muted/20 p-5 space-y-4 animate-in fade-in-50 duration-300">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
              <div className="flex items-center gap-2">
                <div className="flex size-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                  <TrendingUp className="size-4" />
                </div>
                <h3 className="font-bold text-sm text-foreground">
                  Báo Cáo Phân Tích: <span className="text-blue-600 dark:text-blue-400">{result.file_name}</span>
                </h3>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {result.execution_time_ms !== undefined && result.execution_time_ms > 0 && (
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-400 gap-1 text-[11px] font-medium py-1">
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
            {result.selected_scope && result.selected_scope.length > 0 && (
              <div className="flex items-center gap-2 text-xs p-3 rounded-lg bg-blue-50/70 dark:bg-blue-950/40 text-blue-900 dark:text-blue-300 border border-blue-200 dark:border-blue-900">
                <SlidersHorizontal className="size-4 shrink-0 text-blue-600 dark:text-blue-400" />
                <span>
                  Phạm vi đã áp dụng: <strong>{result.selected_scope.length} cột</strong> ({result.selected_scope.join(", ")})
                </span>
              </div>
            )}

            {/* Các cột dữ liệu nhận diện */}
            {result.columns && result.columns.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="font-semibold text-muted-foreground">Các cột được phân tích:</span>
                {result.columns.map((col, idx) => (
                  <Badge key={idx} variant="secondary" className="font-mono text-[11px]">
                    {col}
                  </Badge>
                ))}
              </div>
            )}

            {/* Tabs hiển thị Kết quả thực thi biểu đồ & Mã nguồn (Module 6 & 7) */}
            <Tabs defaultValue="chart" className="w-full">
              <TabsList className="grid w-full max-w-sm grid-cols-2">
                <TabsTrigger value="chart" className="text-xs font-semibold gap-1.5">
                  <BarChart3 className="size-3.5 text-blue-600 dark:text-blue-400" /> Kết Quả & Biểu Đồ
                </TabsTrigger>
                <TabsTrigger value="code" className="text-xs font-semibold gap-1.5">
                  <Code2 className="size-3.5" /> Mã Nguồn Python
                </TabsTrigger>
              </TabsList>

              {/* Tab 1: Kết Quả & Biểu Đồ Thực Thi */}
              <TabsContent value="chart" className="mt-3 space-y-4">
                {result.chart_image ? (
                  <div className="rounded-xl border bg-card p-4 space-y-3 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
                        <h4 className="font-bold text-xs uppercase tracking-wider text-foreground">
                          Biểu Đồ Trực Quan Hóa Dữ Liệu
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
                      <img
                        src={result.chart_image}
                        alt="Biểu đồ phân tích tài chính"
                        className="max-h-[520px] w-auto object-contain rounded-lg shadow-sm"
                      />
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
                    <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <TrendingUp className="size-3.5 text-blue-500" /> Dữ Liệu Tính Toán & Thống Kê
                    </h4>
                    <pre className="rounded-lg bg-muted/40 p-3 text-xs font-mono overflow-x-auto text-foreground whitespace-pre-wrap leading-relaxed">
                      {result.stdout}
                    </pre>
                  </div>
                )}

                {/* Thông báo lỗi nếu chạy thất bại */}
                {result.execution_status === "error" && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50/70 dark:bg-rose-950/40 p-4 space-y-2 text-rose-900 dark:text-rose-300 text-xs">
                    <div className="flex items-center gap-2 font-bold">
                      <AlertCircle className="size-4 text-rose-600 dark:text-rose-400" />
                      <span>Thông Báo Quá Trình Thực Thi</span>
                    </div>
                    <pre className="font-mono text-[11px] whitespace-pre-wrap bg-background/70 p-2.5 rounded border border-rose-200 dark:border-rose-900">
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