import { useState, useEffect, useRef } from "react"
import { createFileRoute } from "@tanstack/react-router"
import axios from "axios"
import {
  TrendingUp,
  BrainCircuit,
  ShieldCheck,
  Download,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Info,
  Table as TableIcon,
  BarChart3,
  Sliders,
  FileSpreadsheet,
  Upload,
  Play,
  Sparkles,
  Send,
  Bot,
  RotateCcw,
  X,
  User as UserIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DatasetsService, Dataset } from "@/services/datasetsService"
import {
  ForecastService,
  ForecastResponseData,
  ClusteringResponseData,
  ClassificationResponseData,
} from "@/services/forecastService"
import { ResultFigure } from "@/components/Common/ResultFigure"
import { PageHeading } from "@/components/Common/PageHeading"

export const Route = createFileRoute("/_layout/forecast")({
  component: ForecastPage,
  head: () => ({
    meta: [
      {
        title: "Dự Báo & Phân Nhóm - FinAI",
      },
    ],
  }),
})

// English Algorithm definitions with 1-line descriptions
const FORECAST_MODELS = [
  {
    id: "linear_regression",
    name: "Linear Regression",
    desc: "Ordinary least squares trend forecasting for continuous time series.",
  },
  {
    id: "exponential_smoothing",
    name: "Exponential Smoothing",
    desc: "Holt-Winters exponential smoothing modeling level and trend patterns.",
  },
  {
    id: "arima",
    name: "ARIMA",
    desc: "Autoregressive integrated moving average for sequential time series.",
  },
  {
    id: "lstm_neural_trend",
    name: "LSTM Neural Network",
    desc: "Deep learning recurrent sequential network for non-linear patterns.",
  },
  {
    id: "polynomial_trend",
    name: "Polynomial Trend",
    desc: "Non-linear 2nd-degree polynomial curve fitting for growth cycles.",
  },
] as const

interface ForecastChatMessage {
  id: string
  role: "user" | "assistant"
  text: string
  timestamp: string
}

function ForecastPage() {
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [isLoadingDatasets, setIsLoadingDatasets] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Active Tab
  const [activeTab, setActiveTab] = useState<string>("forecast")

  // Selected Dataset & Columns
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>("")
  const [numericColumns, setNumericColumns] = useState<string[]>([])
  const [dateColumns, setDateColumns] = useState<string[]>([])
  const [allColumns, setAllColumns] = useState<string[]>([])

  // Forecasting State
  const [targetColumn, setTargetColumn] = useState<string>("")
  const [dateColumn, setDateColumn] = useState<string>("")
  const [horizon, setHorizon] = useState<number>(3)
  const [modelType, setModelType] = useState<
    "linear_regression" | "polynomial_trend" | "exponential_smoothing" | "arima" | "lstm_neural_trend"
  >("linear_regression")
  const [isForecasting, setIsForecasting] = useState(false)
  const [forecastResult, setForecastResult] = useState<ForecastResponseData | null>(null)

  // Clustering State
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([])
  const [nClusters, setNClusters] = useState<number>(3)
  const [idColumn, setIdColumn] = useState<string>("")
  const [isClustering, setIsClustering] = useState(false)
  const [clusteringResult, setClusteringResult] = useState<ClusteringResponseData | null>(null)

  // Classification State
  const [classificationTarget, setClassificationTarget] = useState<string>("")
  const [classificationFeatures, setClassificationFeatures] = useState<string[]>([])
  const [testSize, setTestSize] = useState<number>(0.25)
  const [isClassifying, setIsClassifying] = useState(false)
  const [classificationResult, setClassificationResult] = useState<ClassificationResponseData | null>(null)

  // Mini AI Chatbox for Forecasting State
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [chatMessages, setChatMessages] = useState<ForecastChatMessage[]>([])
  const [chatInput, setChatInput] = useState("")
  const [isChatLoading, setIsChatLoading] = useState(false)
  const chatScrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isChatOpen) {
      chatScrollRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [chatMessages, isChatOpen, isChatLoading])

  useEffect(() => {
    loadDatasets()
  }, [])

  const loadDatasets = async () => {
    setIsLoadingDatasets(true)
    try {
      const res = await DatasetsService.getDatasets(0, 100)
      const ready = res.data.filter((d) => d.status === "ready")
      setDatasets(ready)
      if (ready.length > 0 && !selectedDatasetId) {
        handleSelectDataset(ready[0])
      }
    } catch {
      toast.error("Không thể tải danh sách dữ liệu")
    } finally {
      setIsLoadingDatasets(false)
    }
  }

  const handleSelectDataset = (dataset: Dataset) => {
    setSelectedDatasetId(dataset.id)
    setForecastResult(null)
    setClusteringResult(null)
    setClassificationResult(null)

    try {
      if (dataset.schema_info) {
        const profile = JSON.parse(dataset.schema_info)
        const cols = profile.columns || []
        const numCols: string[] = []
        const dtCols: string[] = []
        const names: string[] = []

        cols.forEach((col: any) => {
          names.push(col.name)
          if (col.type_category?.includes("Số") || col.dtype.includes("int") || col.dtype.includes("float")) {
            numCols.push(col.name)
          }
          if (
            col.type_category?.includes("Thời gian") ||
            col.name.toLowerCase().includes("date") ||
            col.name.toLowerCase().includes("ngay") ||
            col.name.toLowerCase().includes("thang")
          ) {
            dtCols.push(col.name)
          }
        })

        setNumericColumns(numCols)
        setDateColumns(dtCols)
        setAllColumns(names)

        if (numCols.length > 0) {
          setTargetColumn(numCols[0])
          setSelectedFeatures(numCols.slice(0, 3))
          setClassificationFeatures(numCols.slice(0, 3))
        }
        if (dtCols.length > 0) {
          setDateColumn(dtCols[0])
        } else {
          setDateColumn("")
        }
      }
    } catch {
      setNumericColumns([])
      setDateColumns([])
      setAllColumns([])
    }
  }

  // Upload file directly on this page
  const handleFileUpload = async (file: File) => {
    setIsUploading(true)
    try {
      const newDataset = await DatasetsService.uploadDataset(file)
      setDatasets((prev) => [newDataset, ...prev])
      handleSelectDataset(newDataset)
      toast.success(`Đã tải lên và nạp "${newDataset.filename}"`)
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Không thể tải file lên")
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  // Run Forecast
  const handleRunForecast = async () => {
    if (!selectedDatasetId) {
      toast.error("Vui lòng chọn tệp dữ liệu")
      return
    }
    if (!targetColumn) {
      toast.error("Vui lòng chọn chỉ tiêu cần dự báo")
      return
    }

    setIsForecasting(true)
    try {
      const res = await ForecastService.predict({
        dataset_id: selectedDatasetId,
        target_column: targetColumn,
        date_column: dateColumn || null,
        horizon: Math.max(1, Number(horizon) || 1),
        model_type: modelType,
      })
      setForecastResult(res.data)
      toast.success(`Dự báo thành công ${horizon} kỳ cho '${targetColumn}'`)
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Lỗi khi huấn luyện mô hình dự báo")
    } finally {
      setIsForecasting(false)
    }
  }

  // Run Clustering
  const handleRunClustering = async () => {
    if (!selectedDatasetId) {
      toast.error("Vui lòng chọn tệp dữ liệu")
      return
    }
    if (selectedFeatures.length < 2) {
      toast.error("Vui lòng chọn tối thiểu 2 đặc trưng để phân cụm")
      return
    }

    setIsClustering(true)
    try {
      const res = await ForecastService.runClustering({
        dataset_id: selectedDatasetId,
        features: selectedFeatures,
        n_clusters: Math.max(2, Number(nClusters) || 2),
        id_column: idColumn || null,
      })
      setClusteringResult(res.data)
      toast.success(`Phân cụm thành công (${nClusters} cụm)`)
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Lỗi khi thực hiện phân cụm")
    } finally {
      setIsClustering(false)
    }
  }

  // Run Classification
  const handleRunClassification = async () => {
    if (!selectedDatasetId) {
      toast.error("Vui lòng chọn tệp dữ liệu")
      return
    }
    if (!classificationTarget) {
      toast.error("Vui lòng chọn biến mục tiêu nhị phân")
      return
    }
    if (classificationFeatures.length < 1) {
      toast.error("Vui lòng chọn tối thiểu 1 biến đặc trưng")
      return
    }

    setIsClassifying(true)
    try {
      const res = await ForecastService.runClassification({
        dataset_id: selectedDatasetId,
        target_column: classificationTarget,
        feature_columns: classificationFeatures,
        test_size: Number(testSize) || 0.25,
      })
      setClassificationResult(res.data)
      toast.success("Huấn luyện mô hình phân loại thành công")
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Lỗi khi chạy phân loại")
    } finally {
      setIsClassifying(false)
    }
  }

  // Export CSV Helper
  const downloadCSV = (rows: any[], filename: string) => {
    if (!rows || rows.length === 0) return
    const headers = Object.keys(rows[0])
    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        headers
          .map((h) => {
            const val = row[h]
            if (val === null || val === undefined) return '""'
            const str = String(val).replace(/"/g, '""')
            return `"${str}"`
          })
          .join(",")
      ),
    ].join("\r\n")

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success(`Đã xuất ${filename}`)
  }

  // Send message from mini Forecast Chatbox
  const handleSendChatMessage = async (questionText?: string) => {
    const queryToSend = (questionText || chatInput).trim()
    if (!queryToSend || isChatLoading) return

    const userMsg: ForecastChatMessage = {
      id: `u_${Date.now()}`,
      role: "user",
      text: queryToSend,
      timestamp: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
    }
    setChatMessages((prev) => [...prev, userMsg])
    setChatInput("")
    setIsChatLoading(true)

    try {
      const token = sessionStorage.getItem("access_token")
      const formData = new FormData()
      if (selectedDatasetId) {
        formData.append("dataset_id", selectedDatasetId)
      }

      // Contextual prompt based on active tab and result
      let contextualPrompt = queryToSend
      if (activeTab === "forecast" && forecastResult) {
        contextualPrompt = `[Ngữ cảnh trang: Dự báo mô hình ${forecastResult.model_type} cho biến '${forecastResult.target_column}', R²=${forecastResult.metrics.r2}, MAE=${forecastResult.metrics.mae}, tăng trưởng kỳ vọng=${forecastResult.growth_rate_pct}%, dự báo ${horizon} kỳ]. Hãy giải thích ngắn gọn, dễ hiểu: ${queryToSend}`
      } else if (activeTab === "clustering" && clusteringResult) {
        contextualPrompt = `[Ngữ cảnh trang: Phân cụm K-Means ${clusteringResult.n_clusters} cụm, Silhouette Score=${clusteringResult.silhouette_score}]. Hãy giải thích ngắn gọn, dễ hiểu: ${queryToSend}`
      } else if (activeTab === "classification" && classificationResult) {
        contextualPrompt = `[Ngữ cảnh trang: Phân loại rủi ro Logistic Regression cho biến '${classificationResult.target_column}', Accuracy=${classificationResult.metrics.accuracy}, ROC-AUC=${classificationResult.metrics.roc_auc}]. Hãy giải thích ngắn gọn, dễ hiểu: ${queryToSend}`
      } else {
        contextualPrompt = `[Ngữ cảnh trang: Dự báo và phân nhóm dữ liệu kinh doanh]. Hãy giải thích ngắn gọn: ${queryToSend}`
      }

      formData.append("query", contextualPrompt)

      const res = await axios.post("http://localhost:8000/api/v1/files/analyze-dataset-conversational", formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      })

      const botText = res.data.stdout || res.data.summary || "Đã xử lý câu hỏi của bạn."
      const botMsg: ForecastChatMessage = {
        id: `b_${Date.now()}`,
        role: "assistant",
        text: botText,
        timestamp: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
      }
      setChatMessages((prev) => [...prev, botMsg])
    } catch (err: any) {
      const errorText = err.response?.data?.detail || "Không thể gửi câu hỏi lúc này."
      setChatMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          role: "assistant",
          text: `Lỗi: ${errorText}`,
          timestamp: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
        },
      ])
    } finally {
      setIsChatLoading(false)
    }
  }

  // Quick question chips tailored to active tab
  const getQuickQuestions = () => {
    if (activeTab === "forecast") {
      return [
        "Dự báo chuỗi thời gian dùng để làm gì?",
        "Chỉ số R² và sai số MAE có ý nghĩa gì?",
        "Khi nào nên dùng ARIMA thay vì Linear Regression?",
      ]
    }
    if (activeTab === "clustering") {
      return [
        "Phân cụm K-Means dùng để làm gì?",
        "Chỉ số Silhouette Score đánh giá điều gì?",
        "Làm thế nào để chọn số cụm K tốt nhất?",
      ]
    }
    return [
      "Mô hình Logistic Regression dùng để làm gì?",
      "Tỷ số tỷ cược Odds Ratio (e^β) có ý nghĩa gì?",
      "Độ chính xác (Accuracy) và ROC-AUC là gì?",
    ]
  }

  const selectedModelInfo = FORECAST_MODELS.find((m) => m.id === modelType) || FORECAST_MODELS[0]

  return (
    <div className="w-full min-w-0 max-w-full space-y-5 pb-10">
      <PageHeading
        title="Dự báo & Phân nhóm"
        description="Mô hình hóa chuỗi thời gian, phân cụm và phân loại dữ liệu định lượng."
      />

      {/* ================= COMPACT FILE SELECTOR & UPLOADER ================= */}
      <div className="w-full min-w-0 rounded-xl border border-border/80 bg-card p-3 sm:p-4 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Dataset Selection */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <FileSpreadsheet className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium text-muted-foreground">Tệp dữ liệu đang chọn</p>
            <select
              aria-label="Chọn tệp dữ liệu"
              value={selectedDatasetId}
              onChange={(e) => {
                const ds = datasets.find((d) => d.id === e.target.value)
                if (ds) handleSelectDataset(ds)
              }}
              className="w-full bg-transparent font-semibold text-xs sm:text-sm text-foreground focus:outline-none cursor-pointer truncate"
            >
              {isLoadingDatasets ? (
                <option value="">Đang tải danh sách tệp...</option>
              ) : datasets.length === 0 ? (
                <option value="">Chưa có tệp nào - Hãy upload file</option>
              ) : (
                datasets.map((ds) => (
                  <option key={ds.id} value={ds.id} className="bg-popover text-foreground">
                    {ds.filename} ({ds.row_count.toLocaleString()} dòng)
                  </option>
                ))
              )}
            </select>
          </div>
        </div>

        {/* Upload File Button */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="h-8 text-xs gap-1.5 font-medium shrink-0"
          >
            {isUploading ? (
              <RefreshCw className="size-3.5 animate-spin text-primary" />
            ) : (
              <Upload className="size-3.5 text-muted-foreground" />
            )}
            <span>{isUploading ? "Đang tải..." : "Upload file"}</span>
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv, .xlsx, .xls"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) handleFileUpload(f)
            }}
          />

          <Badge variant="secondary" className="text-[11px] font-mono shrink-0">
            {numericColumns.length} cột số
          </Badge>
        </div>
      </div>

      {/* ================= ALGORITHM TABS ================= */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-4 min-w-0">
        <TabsList className="grid grid-cols-3 max-w-lg bg-muted/60 p-0.5 h-9">
          <TabsTrigger value="forecast" className="text-xs gap-1.5 h-8">
            <TrendingUp className="size-3.5" />
            <span className="truncate">Forecasting</span>
          </TabsTrigger>
          <TabsTrigger value="clustering" className="text-xs gap-1.5 h-8">
            <BrainCircuit className="size-3.5" />
            <span className="truncate">Clustering</span>
          </TabsTrigger>
          <TabsTrigger value="classification" className="text-xs gap-1.5 h-8">
            <ShieldCheck className="size-3.5" />
            <span className="truncate">Classification</span>
          </TabsTrigger>
        </TabsList>

        {/* ================= TAB 1: FORECASTING ================= */}
        <TabsContent value="forecast" className="space-y-5 min-w-0">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Controls */}
            <Card className="border-border/80 shadow-2xs lg:col-span-1">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Sliders className="size-4 text-primary" />
                  Forecasting Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3.5 text-xs">
                {/* Algorithm Selection */}
                <div className="space-y-1">
                  <label className="font-medium text-foreground">Algorithm</label>
                  <select
                    value={modelType}
                    onChange={(e) => setModelType(e.target.value as any)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-input bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {FORECAST_MODELS.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-muted-foreground pt-0.5 leading-snug">
                    {selectedModelInfo.desc}
                  </p>
                </div>

                {/* Target Column Y */}
                <div className="space-y-1">
                  <label className="font-medium text-foreground">Target Metric (Y)</label>
                  <select
                    value={targetColumn}
                    onChange={(e) => setTargetColumn(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-input bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {numericColumns.map((col) => (
                      <option key={col} value={col}>
                        {col}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Date Column X */}
                <div className="space-y-1">
                  <label className="font-medium text-foreground">Time / Date Column (X)</label>
                  <select
                    value={dateColumn}
                    onChange={(e) => setDateColumn(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-input bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">Auto sequence (Period 1, 2, ...)</option>
                    {dateColumns.map((col) => (
                      <option key={col} value={col}>
                        {col}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Number Input: Horizon */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="font-medium text-foreground">Forecast Horizon (Periods)</label>
                    <span className="text-[11px] text-muted-foreground">Nhập số kỳ</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={1}
                      max={60}
                      value={horizon}
                      onChange={(e) => setHorizon(Math.max(1, parseInt(e.target.value) || 1))}
                      className="h-8 text-xs font-mono"
                    />
                    <div className="flex items-center gap-1 shrink-0">
                      {[3, 6, 12].map((h) => (
                        <button
                          key={h}
                          type="button"
                          onClick={() => setHorizon(h)}
                          className={`px-2 py-1 text-[10px] font-medium rounded border transition-colors ${
                            horizon === h ? "bg-primary text-primary-foreground border-primary" : "border-border/80 hover:bg-muted/60"
                          }`}
                        >
                          +{h}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <Button
                  onClick={handleRunForecast}
                  disabled={isForecasting || !selectedDatasetId || !targetColumn}
                  className="w-full h-8.5 text-xs font-medium gap-1.5 shadow-2xs mt-2"
                >
                  {isForecasting ? (
                    <>
                      <RefreshCw className="size-3.5 animate-spin" />
                      <span>Đang huấn luyện mô hình...</span>
                    </>
                  ) : (
                    <>
                      <Play className="size-3.5" />
                      <span>Chạy dự báo</span>
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Results or Empty */}
            <div className="lg:col-span-2 min-w-0 space-y-4">
              {!forecastResult && !isForecasting && (
                <div className="rounded-xl border border-dashed border-border/80 p-8 text-center text-xs text-muted-foreground bg-muted/10 h-full flex flex-col items-center justify-center">
                  <TrendingUp className="size-8 text-muted-foreground/40 mb-2" />
                  <p className="font-medium text-foreground">Sẵn sàng dự báo chuỗi thời gian</p>
                  <p className="mt-1 text-[11px] max-w-sm">
                    Chọn thuật toán, chỉ tiêu mục tiêu và nhấn "Chạy dự báo" để sinh biểu đồ và khoảng tin cậy 95%.
                  </p>
                </div>
              )}

              {forecastResult && !isForecasting && (
                <div className="space-y-4 min-w-0">
                  {/* Metrics */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div className="rounded-lg border border-border/80 bg-card p-3 shadow-2xs">
                      <p className="text-[11px] text-muted-foreground font-medium">Hệ số R²</p>
                      <p className="text-base font-bold text-foreground mt-0.5">{Math.round(forecastResult.metrics.r2 * 100)}%</p>
                    </div>
                    <div className="rounded-lg border border-border/80 bg-card p-3 shadow-2xs">
                      <p className="text-[11px] text-muted-foreground font-medium">Tăng trưởng</p>
                      <p className={`text-base font-bold mt-0.5 flex items-center ${forecastResult.growth_rate_pct >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                        {forecastResult.growth_rate_pct >= 0 ? <ArrowUpRight className="size-4" /> : <ArrowDownRight className="size-4" />}
                        {Math.abs(forecastResult.growth_rate_pct)}%
                      </p>
                    </div>
                    <div className="rounded-lg border border-border/80 bg-card p-3 shadow-2xs">
                      <p className="text-[11px] text-muted-foreground font-medium">Sai số MAE</p>
                      <p className="text-base font-bold text-foreground mt-0.5">{forecastResult.metrics.mae.toLocaleString()}</p>
                    </div>
                    <div className="rounded-lg border border-border/80 bg-card p-3 shadow-2xs">
                      <p className="text-[11px] text-muted-foreground font-medium">Sai số RMSE</p>
                      <p className="text-base font-bold text-foreground mt-0.5">{forecastResult.metrics.rmse.toLocaleString()}</p>
                    </div>
                  </div>

                  {/* Summary */}
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs flex gap-2">
                    <Info className="size-4 text-primary shrink-0 mt-0.5" />
                    <p className="text-foreground leading-relaxed">{forecastResult.summary}</p>
                  </div>

                  {/* Integrated Chart */}
                  <div className="rounded-xl border border-border/80 bg-card p-3 shadow-2xs space-y-2 overflow-hidden">
                    <div className="flex items-center justify-between border-b border-border/60 pb-1.5">
                      <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <BarChart3 className="size-3.5 text-primary" />
                        Biểu đồ đường xu hướng & Khoảng tin cậy 95%
                      </span>
                    </div>
                    <div className="bg-muted/20 rounded-lg p-2 flex items-center justify-center">
                      <ResultFigure src={forecastResult.chart_image} alt="Biểu đồ dự báo" />
                    </div>
                  </div>

                  {/* Table with Export CSV */}
                  <div className="rounded-xl border border-border/80 bg-card shadow-2xs overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/60 bg-muted/20">
                      <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <TableIcon className="size-3.5 text-primary" />
                        Dữ liệu các kỳ dự phóng
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => downloadCSV(forecastResult.forecast_table, `forecast_${targetColumn}_${Date.now()}.csv`)}
                        className="h-7 text-xs gap-1 px-2.5"
                      >
                        <Download className="size-3" /> Xuất CSV
                      </Button>
                    </div>
                    <Table>
                      <TableHeader className="bg-muted/30">
                        <TableRow>
                          <TableHead className="text-xs font-semibold">Kỳ</TableHead>
                          <TableHead className="text-xs font-semibold text-right">Dự báo</TableHead>
                          <TableHead className="text-xs font-semibold text-right text-muted-foreground">Min (95%)</TableHead>
                          <TableHead className="text-xs font-semibold text-right text-muted-foreground">Max (95%)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {forecastResult.forecast_table.map((row, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="text-xs font-medium">{row.period}</TableCell>
                            <TableCell className="text-xs font-semibold text-primary text-right font-mono">{row.forecast_value.toLocaleString()}</TableCell>
                            <TableCell className="text-xs text-muted-foreground text-right font-mono">{row.lower_bound.toLocaleString()}</TableCell>
                            <TableCell className="text-xs text-muted-foreground text-right font-mono">{row.upper_bound.toLocaleString()}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ================= TAB 2: CLUSTERING (K-MEANS) ================= */}
        <TabsContent value="clustering" className="space-y-5 min-w-0">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <Card className="border-border/80 shadow-2xs lg:col-span-1">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <BrainCircuit className="size-4 text-primary" />
                  K-Means Clustering
                </CardTitle>
                <CardDescription className="text-[11px] leading-snug">
                  Partitions observations into K clusters using feature similarity and PCA projection.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3.5 text-xs">
                {/* Number Input: Clusters K */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="font-medium text-foreground">Number of Clusters (K)</label>
                    <span className="text-[11px] text-muted-foreground">Nhập số cụm</span>
                  </div>
                  <Input
                    type="number"
                    min={2}
                    max={15}
                    value={nClusters}
                    onChange={(e) => setNClusters(Math.max(2, parseInt(e.target.value) || 2))}
                    className="h-8 text-xs font-mono"
                  />
                </div>

                {/* ID Column */}
                <div className="space-y-1">
                  <label className="font-medium text-foreground">Identifier Column (Optional)</label>
                  <select
                    value={idColumn}
                    onChange={(e) => setIdColumn(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-input bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">Auto row index</option>
                    {allColumns.map((col) => (
                      <option key={col} value={col}>
                        {col}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Features Selection */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="font-medium text-foreground">Features (Min 2)</label>
                    <span className="text-primary font-mono text-[11px]">{selectedFeatures.length} đã chọn</span>
                  </div>
                  <div className="flex flex-wrap gap-1 max-h-40 overflow-y-auto p-2 rounded-lg border border-border/70 bg-muted/20">
                    {numericColumns.map((col) => {
                      const isSel = selectedFeatures.includes(col)
                      return (
                        <button
                          key={col}
                          type="button"
                          onClick={() => {
                            if (isSel) {
                              setSelectedFeatures(selectedFeatures.filter((f) => f !== col))
                            } else {
                              setSelectedFeatures([...selectedFeatures, col])
                            }
                          }}
                          className={`text-[11px] px-2 py-0.5 rounded transition-colors ${
                            isSel
                              ? "bg-primary text-primary-foreground font-medium"
                              : "bg-background text-muted-foreground border border-border/80 hover:bg-muted"
                          }`}
                        >
                          {col}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <Button
                  onClick={handleRunClustering}
                  disabled={isClustering || !selectedDatasetId || selectedFeatures.length < 2}
                  className="w-full h-8.5 text-xs font-medium gap-1.5 shadow-2xs mt-2"
                >
                  {isClustering ? (
                    <>
                      <RefreshCw className="size-3.5 animate-spin" />
                      <span>Đang phân cụm...</span>
                    </>
                  ) : (
                    <>
                      <Play className="size-3.5" />
                      <span>Chạy phân cụm K-Means</span>
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Results */}
            <div className="lg:col-span-2 min-w-0 space-y-4">
              {!clusteringResult && !isClustering && (
                <div className="rounded-xl border border-dashed border-border/80 p-8 text-center text-xs text-muted-foreground bg-muted/10 h-full flex flex-col items-center justify-center">
                  <BrainCircuit className="size-8 text-muted-foreground/40 mb-2" />
                  <p className="font-medium text-foreground">Sẵn sàng phân cụm dữ liệu</p>
                  <p className="mt-1 text-[11px] max-w-sm">
                    Chọn tối thiểu 2 đặc trưng số học và số cụm K để phân tích phân khúc khách hàng hoặc danh mục.
                  </p>
                </div>
              )}

              {clusteringResult && !isClustering && (
                <div className="space-y-4 min-w-0">
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="rounded-lg border border-border/80 bg-card p-3 shadow-2xs">
                      <p className="text-[11px] text-muted-foreground font-medium">Silhouette Score</p>
                      <p className="text-base font-bold text-primary mt-0.5">{clusteringResult.silhouette_score} <span className="text-xs font-normal text-muted-foreground">/ 1.0</span></p>
                    </div>
                    <div className="rounded-lg border border-border/80 bg-card p-3 shadow-2xs">
                      <p className="text-[11px] text-muted-foreground font-medium">Chất lượng phân tách</p>
                      <Badge variant="secondary" className="mt-1 text-xs">{clusteringResult.quality_rating}</Badge>
                    </div>
                  </div>

                  {/* Chart */}
                  <div className="rounded-xl border border-border/80 bg-card p-3 shadow-2xs space-y-2 overflow-hidden">
                    <span className="text-xs font-semibold text-foreground flex items-center gap-1.5 border-b border-border/60 pb-1.5">
                      <BarChart3 className="size-3.5 text-primary" />
                      Biểu đồ không gian phân cụm PCA 2D
                    </span>
                    <div className="bg-muted/20 rounded-lg p-2 flex items-center justify-center">
                      <ResultFigure src={clusteringResult.chart_image} alt="Biểu đồ phân cụm" />
                    </div>
                  </div>

                  {/* Sample Records Table */}
                  <div className="rounded-xl border border-border/80 bg-card shadow-2xs overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/60 bg-muted/20">
                      <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <TableIcon className="size-3.5 text-primary" />
                        Dữ liệu mẫu kèm nhãn phân khúc
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => downloadCSV(clusteringResult.sample_data, `clustering_kmeans_${Date.now()}.csv`)}
                        className="h-7 text-xs gap-1 px-2.5"
                      >
                        <Download className="size-3" /> Xuất CSV
                      </Button>
                    </div>
                    <div className="overflow-x-auto max-h-60">
                      <Table>
                        <TableHeader className="bg-muted/30">
                          <TableRow>
                            {clusteringResult.sample_data.length > 0 &&
                              Object.keys(clusteringResult.sample_data[0]).map((key) => (
                                <TableHead key={key} className="text-xs font-semibold whitespace-nowrap">
                                  {key === "cluster_id" ? "Cụm" : key === "cluster_label" ? "Phân khúc" : key}
                                </TableHead>
                              ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {clusteringResult.sample_data.map((row, idx) => (
                            <TableRow key={idx}>
                              {Object.entries(row).map(([k, val]: any) => (
                                <TableCell key={k} className="text-xs whitespace-nowrap">
                                  {k === "cluster_label" ? (
                                    <Badge variant="outline" className="text-[11px]">{val}</Badge>
                                  ) : (
                                    String(val)
                                  )}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ================= TAB 3: CLASSIFICATION (LOGISTIC REGRESSION) ================= */}
        <TabsContent value="classification" className="space-y-5 min-w-0">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <Card className="border-border/80 shadow-2xs lg:col-span-1">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <ShieldCheck className="size-4 text-primary" />
                  Logistic Regression
                </CardTitle>
                <CardDescription className="text-[11px] leading-snug">
                  Models binary outcome probability (0 or 1) with sigmoid odds ratios.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3.5 text-xs">
                {/* Target Column Y */}
                <div className="space-y-1">
                  <label className="font-medium text-foreground">Binary Target (Y - 0/1)</label>
                  <select
                    value={classificationTarget}
                    onChange={(e) => setClassificationTarget(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-input bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">-- Chọn biến nhị phân --</option>
                    {allColumns.map((col) => (
                      <option key={col} value={col}>
                        {col}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Features Selection */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="font-medium text-foreground">Explanatory Features (X)</label>
                    <span className="text-primary font-mono text-[11px]">{classificationFeatures.length} đã chọn</span>
                  </div>
                  <div className="flex flex-wrap gap-1 max-h-40 overflow-y-auto p-2 rounded-lg border border-border/70 bg-muted/20">
                    {numericColumns
                      .filter((col) => col !== classificationTarget)
                      .map((col) => {
                        const isSel = classificationFeatures.includes(col)
                        return (
                          <button
                            key={col}
                            type="button"
                            onClick={() => {
                              if (isSel) {
                                setClassificationFeatures(classificationFeatures.filter((f) => f !== col))
                              } else {
                                setClassificationFeatures([...classificationFeatures, col])
                              }
                            }}
                            className={`text-[11px] px-2 py-0.5 rounded transition-colors ${
                              isSel
                                ? "bg-primary text-primary-foreground font-medium"
                                : "bg-background text-muted-foreground border border-border/80 hover:bg-muted"
                            }`}
                          >
                            {col}
                          </button>
                        )
                      })}
                  </div>
                </div>

                {/* Number Input: Test Size Ratio */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="font-medium text-foreground">Test Size Ratio</label>
                    <span className="text-[11px] text-muted-foreground">Nhập tỷ lệ kiểm định</span>
                  </div>
                  <Input
                    type="number"
                    min={0.05}
                    max={0.5}
                    step={0.05}
                    value={testSize}
                    onChange={(e) => setTestSize(parseFloat(e.target.value) || 0.25)}
                    className="h-8 text-xs font-mono"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Ví dụ: 0.25 = 25% tập dữ liệu dùng để kiểm định độ chính xác.
                  </p>
                </div>

                <Button
                  onClick={handleRunClassification}
                  disabled={isClassifying || !selectedDatasetId || !classificationTarget || classificationFeatures.length < 1}
                  className="w-full h-8.5 text-xs font-medium gap-1.5 shadow-2xs mt-2"
                >
                  {isClassifying ? (
                    <>
                      <RefreshCw className="size-3.5 animate-spin" />
                      <span>Đang huấn luyện Logistic...</span>
                    </>
                  ) : (
                    <>
                      <Play className="size-3.5" />
                      <span>Chạy Logistic Regression</span>
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Results */}
            <div className="lg:col-span-2 min-w-0 space-y-4">
              {!classificationResult && !isClassifying && (
                <div className="rounded-xl border border-dashed border-border/80 p-8 text-center text-xs text-muted-foreground bg-muted/10 h-full flex flex-col items-center justify-center">
                  <ShieldCheck className="size-8 text-muted-foreground/40 mb-2" />
                  <p className="font-medium text-foreground">Sẵn sàng phân loại rủi ro</p>
                  <p className="mt-1 text-[11px] max-w-sm">
                    Chọn biến mục tiêu nhị phân và các biến đặc trưng để huấn luyện đường cong xác suất Sigmoid.
                  </p>
                </div>
              )}

              {classificationResult && !isClassifying && (
                <div className="space-y-4 min-w-0">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div className="rounded-lg border border-border/80 bg-card p-3 shadow-2xs">
                      <p className="text-[11px] text-muted-foreground font-medium">Accuracy</p>
                      <p className="text-base font-bold text-foreground mt-0.5">{Math.round(classificationResult.metrics.accuracy * 100)}%</p>
                    </div>
                    <div className="rounded-lg border border-border/80 bg-card p-3 shadow-2xs">
                      <p className="text-[11px] text-muted-foreground font-medium">ROC-AUC</p>
                      <p className="text-base font-bold text-primary mt-0.5">{classificationResult.metrics.roc_auc}</p>
                    </div>
                    <div className="rounded-lg border border-border/80 bg-card p-3 shadow-2xs">
                      <p className="text-[11px] text-muted-foreground font-medium">Recall</p>
                      <p className="text-base font-bold text-foreground mt-0.5">{Math.round(classificationResult.metrics.recall * 100)}%</p>
                    </div>
                    <div className="rounded-lg border border-border/80 bg-card p-3 shadow-2xs">
                      <p className="text-[11px] text-muted-foreground font-medium">F1-Score</p>
                      <p className="text-base font-bold text-foreground mt-0.5">{classificationResult.metrics.f1_score}</p>
                    </div>
                  </div>

                  {/* Summary */}
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs flex gap-2">
                    <Info className="size-4 text-primary shrink-0 mt-0.5" />
                    <p className="text-foreground leading-relaxed">{classificationResult.summary}</p>
                  </div>

                  {/* Chart */}
                  <div className="rounded-xl border border-border/80 bg-card p-3 shadow-2xs space-y-2 overflow-hidden">
                    <span className="text-xs font-semibold text-foreground flex items-center gap-1.5 border-b border-border/60 pb-1.5">
                      <BarChart3 className="size-3.5 text-primary" />
                      Đường cong xác suất Sigmoid & Phân loại rủi ro
                    </span>
                    <div className="bg-muted/20 rounded-lg p-2 flex items-center justify-center">
                      <ResultFigure src={classificationResult.chart_image} alt="Biểu đồ Logistic Regression" />
                    </div>
                  </div>

                  {/* Odds Ratios Table */}
                  <div className="rounded-xl border border-border/80 bg-card shadow-2xs overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/60 bg-muted/20">
                      <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <TableIcon className="size-3.5 text-primary" />
                        Hệ số Odds Ratios (e^β)
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => downloadCSV(classificationResult.odds_ratios, `odds_ratios_${Date.now()}.csv`)}
                        className="h-7 text-xs gap-1 px-2.5"
                      >
                        <Download className="size-3" /> Xuất CSV
                      </Button>
                    </div>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader className="bg-muted/30">
                          <TableRow>
                            <TableHead className="text-xs font-semibold">Biến (Feature)</TableHead>
                            <TableHead className="text-xs font-semibold text-right">Odds Ratio</TableHead>
                            <TableHead className="text-xs font-semibold text-right">Tác động</TableHead>
                            <TableHead className="text-xs font-semibold">Ý nghĩa kinh doanh</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {classificationResult.odds_ratios.map((row, idx) => (
                            <TableRow key={idx}>
                              <TableCell className="text-xs font-medium">{row.feature}</TableCell>
                              <TableCell className="text-xs font-bold text-right font-mono">
                                <span className={row.odds_ratio >= 1.0 ? "text-rose-600" : "text-emerald-600"}>
                                  {row.odds_ratio}x
                                </span>
                              </TableCell>
                              <TableCell className="text-xs font-semibold text-right font-mono">{row.pct_impact}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">{row.interpretation}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* ================= COMPACT FLOATING AI CHATBOX ================= */}
      {/* Closed State: Sleek pill button */}
      {!isChatOpen && (
        <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40">
          <Button
            onClick={() => setIsChatOpen(true)}
            className="h-9 px-3.5 rounded-full shadow-lg gap-2 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-medium cursor-pointer"
          >
            <Sparkles className="size-3.5" />
            <span>Hỏi AI về dự báo</span>
          </Button>
        </div>
      )}

      {/* Open State: Floating Chatbox Window */}
      {isChatOpen && (
        <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 w-[350px] sm:w-[380px] h-[450px] max-h-[82vh] flex flex-col rounded-xl border border-border/80 bg-card shadow-2xl overflow-hidden animate-in fade-in-50 slide-in-from-bottom-3 duration-150">
          {/* Header */}
          <div className="p-2.5 px-3 border-b border-border/70 bg-muted/40 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Bot className="size-3.5" />
              </span>
              <span className="text-xs font-semibold text-foreground truncate">Hỏi đáp AI về dự báo</span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setChatMessages([])}
                className="size-6 text-muted-foreground hover:text-foreground"
                title="Xóa cuộc trò chuyện"
              >
                <RotateCcw className="size-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsChatOpen(false)}
                className="size-6 text-muted-foreground hover:text-foreground"
                title="Thu gọn"
              >
                <X className="size-3.5" />
              </Button>
            </div>
          </div>

          {/* Messages Feed */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 min-w-0 text-xs">
            {chatMessages.length === 0 ? (
              <div className="py-4 space-y-3 text-center min-w-0">
                <p className="text-xs text-muted-foreground">
                  Đặt bất kỳ câu hỏi nào về thuật toán, chỉ số hoặc cách hiểu kết quả:
                </p>
                <div className="space-y-1.5 text-left">
                  {getQuickQuestions().map((q, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSendChatMessage(q)}
                      className="w-full p-2 text-[11px] rounded-lg border border-border/70 bg-background hover:bg-muted/50 text-foreground transition-colors cursor-pointer text-left leading-snug"
                    >
                      💡 {q}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              chatMessages.map((m) => (
                <div key={m.id} className="space-y-1 min-w-0">
                  {m.role === "user" ? (
                    <div className="flex justify-end">
                      <div className="max-w-[85%] rounded-lg bg-primary text-primary-foreground p-2 text-[11px] break-words leading-relaxed">
                        <div className="flex items-center gap-1 text-[9px] text-primary-foreground/75 mb-0.5">
                          <UserIcon className="size-2.5" />
                          <span>Bạn</span>
                        </div>
                        {m.text}
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-start">
                      <div className="max-w-[88%] rounded-lg border border-border/70 bg-muted/30 p-2 text-[11px] text-foreground break-words leading-relaxed">
                        <div className="flex items-center gap-1 text-[9px] text-muted-foreground mb-0.5 font-semibold">
                          <Bot className="size-2.5 text-primary" />
                          <span>FinAI Assistant</span>
                        </div>
                        <div className="whitespace-pre-wrap">{m.text}</div>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}

            {isChatLoading && (
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground animate-pulse">
                <Bot className="size-3 text-primary" />
                <span>AI đang phân tích câu hỏi...</span>
              </div>
            )}
            <div ref={chatScrollRef} />
          </div>

          {/* Input Box */}
          <div className="p-2 border-t border-border/70 bg-card shrink-0">
            <div className="flex items-center gap-1.5 rounded-lg border border-input bg-background p-1 focus-within:border-primary/80 transition-all">
              <Input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    handleSendChatMessage()
                  }
                }}
                disabled={isChatLoading}
                placeholder="Hỏi về dự báo, mô hình..."
                className="h-7 text-xs border-0 shadow-none px-2 focus-visible:ring-0 focus-visible:ring-offset-0"
              />
              <Button
                size="icon"
                onClick={() => handleSendChatMessage()}
                disabled={isChatLoading || !chatInput.trim()}
                className="size-7 shrink-0 rounded-md"
              >
                <Send className="size-3" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
