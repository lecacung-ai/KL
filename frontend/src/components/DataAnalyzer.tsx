import { useState, useEffect, useRef } from "react"
import axios from "axios"
import {
  Send,
  FileSpreadsheet,
  Check,
  Copy,
  Code2,
  Database,
  Upload,
  BarChart3,
  AlertCircle,
  Download,
  CheckCircle2,
  RotateCcw,
  Bot,
  User as UserIcon,
  ChevronDown,
  ChevronUp,
  Sparkles,
  TrendingUp,
  ArrowRight,
  SlidersHorizontal,
  Play,
  X,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { LoadingButton } from "@/components/ui/loading-button"
import { ResultFigure } from "@/components/Common/ResultFigure"
import { MarkdownRenderer } from "@/components/Common/MarkdownRenderer"
import { DatasetsService, Dataset } from "@/services/datasetsService"
import { InteractiveUploadDialog } from "@/components/Datasets/InteractiveUploadDialog"
import {
  ForecastService,
  RecommendationResponseData,
  AlgorithmRecommendation,
} from "@/services/forecastService"

interface AgentStep {
  step: number
  tool: string
  input: string
  output_summary: string
  duration_ms: number
  success: boolean
}

interface ExportFileInfo {
  filename: string
  row_count: number
  column_count: number
  size_kb: number
  download_url: string
}

interface ChatMessage {
  id: string
  role: "user" | "assistant"
  text?: string
  chart_image?: string | null
  stdout?: string | null
  ai_code?: string
  agent_steps?: AgentStep[]
  export_file?: ExportFileInfo | null
  execution_status?: "success" | "error" | "idle"
  execution_error?: string | null
  execution_time_ms?: number
  security_status?: string
  file_name?: string
  selected_scope?: string[]
  timestamp: string
  recommendation_data?: RecommendationResponseData | null
}

const PROMPT_CHIPS = [
  "Phân tích tổng quan dữ liệu",
  "Phân tích xu hướng doanh thu",
  "Tìm các bất thường trong dữ liệu",
]

export default function DataAnalyzer({
  onDatasetSaved,
}: {
  onDatasetSaved?: (dataset: Dataset) => void
}) {
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>("")
  const [query, setQuery] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null)
  const [expandedTraceIds, setExpandedTraceIds] = useState<Record<string, boolean>>({})

  const toggleTraceExpand = (id: string) => {
    setExpandedTraceIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }))
  }

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false)
  const chatBottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Interactive algorithm config state inside chat
  const [activeConfigAlgoId, setActiveConfigAlgoId] = useState<string | null>(null)
  const [selectedTarget, setSelectedTarget] = useState<string>("")
  const [selectedDateCol, setSelectedDateCol] = useState<string>("")
  const [selectedHorizon, setSelectedHorizon] = useState<number>(3)
  const [selectedK, setSelectedK] = useState<number>(3)
  const [selectedTestSize, setSelectedTestSize] = useState<number>(20)

  useEffect(() => {
    if (!selectedDatasetId) return

    const currentDataset = datasets.find((d) => d.id === selectedDatasetId)
    if (!currentDataset) return

    ForecastService.getRecommendations(selectedDatasetId)
      .then((res) => {
        if (res && res.data) {
          const recData = res.data
          const introMsg: ChatMessage = {
            id: `bot_rec_${selectedDatasetId}`,
            role: "assistant",
            file_name: currentDataset.filename,
            text: `Xin chào! Tôi đã nạp tệp **${currentDataset.filename}** (${recData.total_rows.toLocaleString()} dòng, ${recData.total_columns} cột).\n\n🎯 **Phân loại dữ liệu:** ${recData.type_label}\n📝 ${recData.type_description}\n\nDưới đây là các thuật toán phù hợp nhất với tệp dữ liệu này. Bạn có thể chọn trường và tùy chỉnh chỉ số phân tích trực tiếp ngay trong đoạn chat:`,
            recommendation_data: recData,
            timestamp: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
          }

          setMessages((prev) => {
            const filtered = prev.filter((m) => !m.id.startsWith("bot_rec_"))
            return [introMsg, ...filtered]
          })
        }
      })
      .catch((err) => {
        console.warn("Không thể tải gợi ý thuật toán cho tệp:", err)
      })
  }, [selectedDatasetId, datasets])

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isLoading])

  useEffect(() => {
    DatasetsService.getDatasets()
      .then((res) => {
        setDatasets(res.data)
        const storedId = sessionStorage.getItem("finai_selected_dataset_id")
        if (storedId) {
          const found = res.data.find((d) => d.id === storedId)
          if (found) {
            setSelectedDatasetId(storedId)
          }
          sessionStorage.removeItem("finai_selected_dataset_id")
        } else if (res.data.length > 0 && !selectedDatasetId) {
          setSelectedDatasetId(res.data[0].id)
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const handleCustomSelect = (e: any) => {
      if (e.detail?.id) {
        setSelectedDatasetId(e.detail.id)
        const found = datasets.find((d) => d.id === e.detail.id)
        if (found) {
          toast.success(`Đã chọn "${found.filename}"`)
        }
      }
    }
    window.addEventListener("finai:select-dataset", handleCustomSelect)
    return () => window.removeEventListener("finai:select-dataset", handleCustomSelect)
  }, [datasets])

  const handleSelectExistingDataset = (datasetId: string) => {
    setSelectedDatasetId(datasetId)
    const found = datasets.find((d) => d.id === datasetId)
    if (found) {
      toast.success(`Đã chọn "${found.filename}"`)
    }
  }

  const handleInteractiveUploadSuccess = async () => {
    try {
      const res = await DatasetsService.getDatasets()
      setDatasets(res.data)
      if (res.data.length > 0) {
        setSelectedDatasetId(res.data[0].id)
        sessionStorage.setItem("finai_selected_dataset_id", res.data[0].id)
        if (onDatasetSaved) {
          onDatasetSaved(res.data[0])
        }
      }
    } catch (err) {
      console.error("Lỗi khi cập nhật danh sách dữ liệu sau khi tải lên:", err)
    }
  }

  const handleOpenConfig = (rec: AlgorithmRecommendation, availableFields?: any) => {
    setActiveConfigAlgoId(rec.algorithm_id)
    const numCols = availableFields?.numeric_columns || []
    const binCols = availableFields?.binary_columns || []
    const dateCols = availableFields?.date_columns || []
    const allCols = availableFields?.all_columns || numCols

    if (rec.task_type === "classification") {
      setSelectedTarget(rec.suggested_target || binCols[0] || (numCols.length > 0 ? numCols[0] : ""))
    } else {
      setSelectedTarget(rec.suggested_target || (numCols.length > 0 ? numCols[0] : (allCols.length > 0 ? allCols[0] : "")))
    }

    setSelectedDateCol(rec.suggested_date || (dateCols.length > 0 ? dateCols[0] : ""))
    setSelectedHorizon(rec.suggested_horizon || 3)
    setSelectedK(3)
    setSelectedTestSize(20)
  }

  const handleExecuteConfiguredAlgorithm = (rec: AlgorithmRecommendation) => {
    let generatedPrompt = ""
    if (rec.task_type === "time_series_forecast") {
      const target = selectedTarget || rec.suggested_target || "doanh thu"
      const datePart = selectedDateCol ? ` (theo trục thời gian '${selectedDateCol}')` : ""
      generatedPrompt = `Hãy sử dụng mô hình ${rec.algorithm_name} để dự báo chuỗi thời gian cho biến mục tiêu '${target}'${datePart} trong ${selectedHorizon} kỳ tới. Hãy tính toán các chỉ số thống kê (R², MAE, RMSE), tốc độ tăng trưởng kỳ vọng (%) và vẽ biểu đồ dự phóng xu hướng.`
    } else if (rec.task_type === "clustering") {
      generatedPrompt = `Hãy áp dụng thuật toán ${rec.algorithm_name} để phân cụm dữ liệu thành ${selectedK} nhóm dựa trên các chỉ số tài chính định lượng, chuẩn hóa dữ liệu (StandardScaler), tính Silhouette Score, vẽ biểu đồ phân khúc 2D (PCA) và giải thích ý nghĩa kinh doanh của từng cụm.`
    } else if (rec.task_type === "classification") {
      const target = selectedTarget || rec.suggested_target || "biến mục tiêu"
      generatedPrompt = `Hãy chạy mô hình ${rec.algorithm_name} để dự đoán biến phân loại '${target}' với tỷ lệ kiểm định ${selectedTestSize}%. Hãy tính ma trận nhầm lẫn (Confusion Matrix), tỷ số Odds Ratios (e^β) và phân tích các yếu tố rủi ro tác động mạnh nhất.`
    } else {
      const target = selectedTarget || "chỉ tiêu chính"
      generatedPrompt = `Hãy áp dụng mô hình ${rec.algorithm_name} phân tích chuyên sâu cho chỉ tiêu '${target}' trong ${selectedHorizon} kỳ tới, giải thích kết quả và vẽ biểu đồ phân tích.`
    }

    setActiveConfigAlgoId(null)
    setQuery(generatedPrompt)
    handleSendMessage(generatedPrompt)
  }

  const handleRunAlgorithm = (rec: AlgorithmRecommendation) => {
    let generatedPrompt = ""
    if (rec.task_type === "time_series_forecast") {
      const target = rec.suggested_target || "doanh thu"
      const dateCol = rec.suggested_date ? ` theo mốc thời gian '${rec.suggested_date}'` : ""
      const horizon = rec.suggested_horizon || 3
      generatedPrompt = `Hãy sử dụng mô hình ${rec.algorithm_name} để dự báo chuỗi thời gian cho cột '${target}'${dateCol} trong ${horizon} kỳ tiếp theo, tính toán độ tin cậy và vẽ biểu đồ dự phóng xu hướng.`
    } else if (rec.task_type === "clustering") {
      const feats =
        rec.suggested_features && rec.suggested_features.length > 0
          ? `các đặc trưng [${rec.suggested_features.slice(0, 4).join(", ")}]`
          : "các chỉ số định lượng"
      const k = rec.suggested_horizon || 3
      generatedPrompt = `Hãy áp dụng thuật toán K-Means phân cụm tệp dữ liệu này thành ${k} nhóm dựa trên ${feats}, trực quan hóa phân khúc bằng biểu đồ 2D (PCA) và giải thích ý nghĩa kinh doanh của từng nhóm.`
    } else if (rec.task_type === "classification") {
      const target = rec.suggested_target || "biến mục tiêu"
      generatedPrompt = `Hãy chạy mô hình phân loại Logistic Regression để dự đoán biến '${target}', tính toán tỷ số Odds Ratios (e^β) và phân tích các yếu tố rủi ro tác động mạnh nhất.`
    } else {
      generatedPrompt = `Hãy áp dụng thuật toán ${rec.algorithm_name} phân tích chuyên sâu cho tệp dữ liệu này, giải thích kết quả và vẽ biểu đồ trực quan hóa.`
    }

    setQuery(generatedPrompt)
    handleSendMessage(generatedPrompt)
  }

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code)
    setCopiedCodeId(id)
    toast.success("Đã sao chép mã")
    setTimeout(() => setCopiedCodeId(null), 2000)
  }

  const clearChat = () => {
    setMessages([])
    toast.info("Đã tạo hội thoại mới")
  }

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setQuery(e.target.value)
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`
    }
  }

  const handleSendMessage = async (textToSend?: string) => {
    const messageText = (textToSend || query).trim()
    if (!messageText) return

    if (!selectedDatasetId) {
      toast.error("Vui lòng chọn hoặc tải tệp dữ liệu trước")
      return
    }

    const currentDataset = datasets.find((d) => d.id === selectedDatasetId)
    const currentFilename = currentDataset?.filename || "Dữ liệu"

    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      role: "user",
      text: messageText,
      file_name: currentFilename,
      timestamp: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
    }

    setMessages((prev) => [...prev, userMsg])
    setQuery("")
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
    }
    setIsLoading(true)

    try {
      const token = sessionStorage.getItem("access_token")
      const formData = new FormData()
      formData.append("dataset_id", selectedDatasetId)
      formData.append("query", messageText)

      const response = await axios.post(
        "http://localhost:8000/api/v1/files/analyze-dataset-conversational",
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        }
      )

      const resData = response.data
      const botMsg: ChatMessage = {
        id: `bot_${Date.now()}`,
        role: "assistant",
        text: resData.summary || resData.stdout || resData.message,
        stdout: resData.stdout,
        ai_code: resData.ai_code,
        chart_image: resData.chart_image,
        agent_steps: resData.agent_steps,
        export_file: resData.export_file,
        execution_status: resData.execution_status || "success",
        execution_error: resData.execution_error,
        execution_time_ms: resData.execution_time_ms,
        security_status: resData.security_status,
        timestamp: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
      }

      setMessages((prev) => [...prev, botMsg])

      if (resData.execution_status === "error") {
        toast.error("Quá trình thực thi mã gặp lỗi.")
      }
    } catch (error: any) {
      const errDetail = error.response?.data?.detail || "Lỗi kết nối khi gửi dữ liệu"
      toast.error(errDetail)

      const errorBotMsg: ChatMessage = {
        id: `bot_err_${Date.now()}`,
        role: "assistant",
        execution_status: "error",
        execution_error: errDetail,
        timestamp: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
      }
      setMessages((prev) => [...prev, errorBotMsg])
    } finally {
      setIsLoading(false)
    }
  }

  const activeDataset = selectedDatasetId
    ? datasets.find((d) => d.id === selectedDatasetId)
    : null

  return (
    <div className="finai-analyzer w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-border/80 bg-card text-card-foreground shadow-2xs flex flex-col h-[calc(100vh-10.5rem)] min-h-[480px]">
      {/* ================= TOP TOOLBAR ================= */}
      <div className="border-b border-border/70 bg-card/60 px-3 sm:px-4 py-2 flex flex-wrap items-center justify-between gap-2 shrink-0 min-w-0">
        {/* Left: Product Title */}
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Bot className="size-4" />
          </span>
          <div className="flex items-center gap-1.5 min-w-0">
            <h2 className="text-sm font-semibold text-foreground truncate">
              FinAI Assistant
            </h2>
            <span className="size-1.5 rounded-full bg-emerald-500 shrink-0" />
          </div>
        </div>

        {/* Right: Dataset Selector, ONLY 1 Upload Button, & New Chat */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Dataset Selector */}
          <div className="relative">
            <select
              aria-label="Chọn tệp dữ liệu"
              value={selectedDatasetId}
              onChange={(e) => handleSelectExistingDataset(e.target.value)}
              className="h-8 pl-7 pr-6 text-xs font-medium rounded-lg border border-border/80 bg-background text-foreground hover:bg-muted/40 transition-colors focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer appearance-none max-w-[170px] sm:max-w-[210px] truncate"
            >
              <option value="">-- Chọn dữ liệu --</option>
              {datasets.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.filename} ({d.row_count.toLocaleString()}d)
                </option>
              ))}
            </select>
            <Database className="size-3 text-muted-foreground absolute left-2.5 top-2.5 pointer-events-none" />
            <ChevronDown className="size-3 text-muted-foreground absolute right-2 top-2.5 pointer-events-none" />
          </div>

          {/* THE ONLY UPLOAD BUTTON */}
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={() => setIsUploadDialogOpen(true)}
            className="h-8 text-xs gap-1.5 font-medium shrink-0 cursor-pointer"
            title="Tải lên tệp dữ liệu Excel hoặc CSV (Kiểm tra và tiền xử lý thông minh)"
          >
            <Upload className="size-3.5" />
            <span>Tải lên Dữ liệu</span>
          </Button>

          {/* New Chat Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={clearChat}
            className="h-8 text-xs text-muted-foreground hover:text-foreground gap-1 px-2 shrink-0"
            title="Bắt đầu hội thoại mới"
          >
            <RotateCcw className="size-3.5" />
            <span className="hidden sm:inline">Làm mới</span>
          </Button>
        </div>
      </div>

      {/* ================= CHAT STREAM ================= */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4 min-w-0">
        <div className="max-w-3xl mx-auto w-full space-y-4 min-w-0">
          {/* EMPTY STATE - STREAMLINED */}
          {messages.length === 0 ? (
            <div className="py-8 sm:py-12 space-y-4 text-center min-w-0">
              <div className="inline-flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary mx-auto">
                <Bot className="size-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base sm:text-lg font-semibold tracking-tight text-foreground">
                  Hỏi đáp cùng FinAI
                </h3>
                {activeDataset ? (
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="size-3" />
                    <span>Đang làm việc với: <strong>{activeDataset.filename}</strong></span>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Chọn tệp hoặc nhấn "Tải lên Dữ liệu" ở góc trên để bắt đầu.
                  </p>
                )}
              </div>

              {/* 3 Prompt Chips */}
              <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
                {PROMPT_CHIPS.map((chip, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setQuery(chip)
                      handleSendMessage(chip)
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/80 bg-background hover:bg-muted/60 text-xs text-foreground transition-all shadow-2xs group cursor-pointer"
                  >
                    <Sparkles className="size-3 text-primary group-hover:scale-110 transition-transform" />
                    <span>{chip}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* MESSAGES FEED */
            messages.map((msg) => (
              <div key={msg.id} className="space-y-3 min-w-0">
                {/* USER MESSAGE */}
                {msg.role === "user" && (
                  <div className="flex justify-end min-w-0">
                    <div className="max-w-[85%] rounded-xl bg-primary text-primary-foreground px-3.5 py-2.5 shadow-2xs break-words">
                      <div className="flex items-center gap-1.5 text-[10px] text-primary-foreground/75 mb-1">
                        <UserIcon className="size-3" />
                        <span className="font-medium">Bạn</span>
                        <span>·</span>
                        <span>{msg.timestamp}</span>
                      </div>
                      <p className="text-xs sm:text-sm font-normal leading-relaxed whitespace-pre-wrap break-words">
                        {msg.text}
                      </p>
                    </div>
                  </div>
                )}

                {/* AI MESSAGE */}
                {msg.role === "assistant" && (
                  <div className="flex items-start gap-2.5 min-w-0">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary mt-0.5">
                      <Bot className="size-4" />
                    </span>

                    <div className="flex-1 min-w-0 rounded-xl border border-border/80 bg-card p-3 sm:p-4 space-y-3 shadow-2xs overflow-hidden">
                      {/* Header */}
                      <div className="flex items-center justify-between border-b border-border/60 pb-1.5 text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground text-xs">
                          FinAI
                        </span>
                        <span className="font-mono text-[10px] text-muted-foreground">{msg.timestamp}</span>
                      </div>

                      {/* Main Insight / text formatted via MarkdownRenderer */}
                      {msg.text ? (
                        <MarkdownRenderer content={msg.text} />
                      ) : msg.stdout ? (
                        <MarkdownRenderer content={msg.stdout} />
                      ) : null}

                      {/* Stdout if different from text and both exist */}
                      {msg.stdout && msg.text && msg.stdout !== msg.text && (
                        <div className="pt-2 border-t border-border/50">
                          <MarkdownRenderer content={msg.stdout} />
                        </div>
                      )}

                      {/* Interactive Algorithm Recommendations directly inside Chat Bubble */}
                      {msg.recommendation_data && msg.recommendation_data.recommendations && (
                        <div className="mt-3 space-y-2 pt-2 border-t border-border/60">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                            <Sparkles className="size-3.5" />
                            <span>Gợi ý thuật toán phân tích:</span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                            {msg.recommendation_data.recommendations.map((rec) => {
                              const isConfiguring = activeConfigAlgoId === rec.algorithm_id
                              const availFields = msg.recommendation_data?.available_fields
                              const numCols = availFields?.numeric_columns || []
                              const binCols = availFields?.binary_columns || []
                              const dateCols = availFields?.date_columns || []
                              const allCols = availFields?.all_columns || numCols

                              return (
                                <div
                                  key={rec.algorithm_id}
                                  className={`rounded-lg border bg-muted/20 p-3 space-y-2.5 flex flex-col justify-between shadow-2xs transition-all ${
                                    isConfiguring
                                      ? "col-span-1 sm:col-span-2 border-primary/60 bg-card ring-1 ring-primary/30"
                                      : "border-border/80 hover:border-primary/50"
                                  }`}
                                >
                                  {/* Algorithm Header: Pure English Name + Suitability Badge */}
                                  <div className="space-y-1.5">
                                    <div className="flex items-center justify-between gap-1">
                                      <span className="text-xs font-semibold text-foreground tracking-tight" title={rec.algorithm_name}>
                                        {rec.algorithm_name}
                                      </span>
                                      <span
                                        className="text-[9px] font-semibold px-1.5 py-0.5 rounded shrink-0 whitespace-nowrap"
                                        style={{
                                          backgroundColor: `${rec.badge_color || "#0ea5e9"}18`,
                                          color: rec.badge_color || "#0ea5e9",
                                        }}
                                      >
                                        {rec.suitability}
                                      </span>
                                    </div>

                                    {/* Outcome-oriented summary */}
                                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                                      {rec.reason}
                                    </p>
                                  </div>

                                  {/* Inline Configuration Form inside Chat Bubble */}
                                  {isConfiguring ? (
                                    <div className="rounded-md border border-border/70 bg-muted/30 p-2.5 space-y-2 text-xs">
                                      <div className="text-[11px] font-medium text-foreground flex items-center gap-1 border-b border-border/50 pb-1.5">
                                        <SlidersHorizontal className="size-3 text-primary" />
                                        <span>Thiết lập trường & tham số phân tích</span>
                                      </div>

                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {/* Target Column Selector */}
                                        {rec.task_type !== "clustering" && (
                                          <div className="space-y-1">
                                            <label className="text-[10px] font-medium text-foreground/90 block">
                                              Biến mục tiêu (Target Y):
                                            </label>
                                            <select
                                              value={selectedTarget}
                                              onChange={(e) => setSelectedTarget(e.target.value)}
                                              className="w-full h-7 px-2 text-xs rounded border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                                            >
                                              {(rec.task_type === "classification" && binCols.length > 0
                                                ? binCols
                                                : numCols.length > 0
                                                ? numCols
                                                : allCols
                                              ).map((col) => (
                                                <option key={col} value={col}>
                                                  {col}
                                                </option>
                                              ))}
                                            </select>
                                          </div>
                                        )}

                                        {/* Date Column Selector */}
                                        {rec.task_type === "time_series_forecast" && (
                                          <div className="space-y-1">
                                            <label className="text-[10px] font-medium text-foreground/90 block">
                                              Cột mốc thời gian:
                                            </label>
                                            <select
                                              value={selectedDateCol}
                                              onChange={(e) => setSelectedDateCol(e.target.value)}
                                              className="w-full h-7 px-2 text-xs rounded border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                                            >
                                              <option value="">Tự động nhận diện</option>
                                              {dateCols.map((col) => (
                                                <option key={col} value={col}>
                                                  {col}
                                                </option>
                                              ))}
                                            </select>
                                          </div>
                                        )}

                                        {/* Forecast Horizon Input */}
                                        {rec.task_type === "time_series_forecast" && (
                                          <div className="space-y-1">
                                            <label className="text-[10px] font-medium text-foreground/90 block">
                                              Số kỳ dự báo (Horizon):
                                            </label>
                                            <input
                                              type="number"
                                              min={1}
                                              max={60}
                                              value={selectedHorizon}
                                              onChange={(e) =>
                                                setSelectedHorizon(Math.max(1, parseInt(e.target.value) || 1))
                                              }
                                              className="w-full h-7 px-2 text-xs rounded border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                                              placeholder="Ví dụ: 3 kỳ"
                                            />
                                          </div>
                                        )}

                                        {/* Number of Clusters K */}
                                        {rec.task_type === "clustering" && (
                                          <div className="space-y-1 col-span-1 sm:col-span-2">
                                            <label className="text-[10px] font-medium text-foreground/90 block">
                                              Số nhóm phân cụm (K clusters):
                                            </label>
                                            <input
                                              type="number"
                                              min={2}
                                              max={10}
                                              value={selectedK}
                                              onChange={(e) =>
                                                setSelectedK(Math.max(2, Math.min(10, parseInt(e.target.value) || 2)))
                                              }
                                              className="w-full h-7 px-2 text-xs rounded border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                                              placeholder="Ví dụ: 3 cụm"
                                            />
                                          </div>
                                        )}

                                        {/* Test Size Input */}
                                        {rec.task_type === "classification" && (
                                          <div className="space-y-1">
                                            <label className="text-[10px] font-medium text-foreground/90 block">
                                              Tỷ lệ kiểm định (Test Size %):
                                            </label>
                                            <input
                                              type="number"
                                              min={10}
                                              max={50}
                                              step={5}
                                              value={selectedTestSize}
                                              onChange={(e) =>
                                                setSelectedTestSize(
                                                  Math.max(10, Math.min(50, parseInt(e.target.value) || 20))
                                                )
                                              }
                                              className="w-full h-7 px-2 text-xs rounded border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                                              placeholder="Ví dụ: 20%"
                                            />
                                          </div>
                                        )}
                                      </div>

                                      {/* Action buttons inside configuration form */}
                                      <div className="flex items-center justify-end gap-2 pt-1 border-t border-border/40">
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => setActiveConfigAlgoId(null)}
                                          className="h-7 text-xs px-2.5 text-muted-foreground hover:text-foreground"
                                        >
                                          <X className="size-3 mr-1" />
                                          Đóng
                                        </Button>
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="default"
                                          onClick={() => handleExecuteConfiguredAlgorithm(rec)}
                                          disabled={isLoading}
                                          className="h-7 text-xs gap-1.5 font-medium cursor-pointer"
                                        >
                                          <Play className="size-3 shrink-0" />
                                          <span>Chạy phân tích trong đoạn chat</span>
                                        </Button>
                                      </div>
                                    </div>
                                  ) : (
                                    /* Action buttons when collapsed */
                                    <div className="flex items-center gap-1.5 pt-1">
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={() =>
                                          handleOpenConfig(rec, msg.recommendation_data?.available_fields)
                                        }
                                        disabled={isLoading}
                                        className="h-7 text-xs flex-1 gap-1 font-medium cursor-pointer"
                                        title="Tùy chỉnh cột phân tích và các chỉ số"
                                      >
                                        <SlidersHorizontal className="size-3 shrink-0" />
                                        <span>Chọn trường & Nhập chỉ số</span>
                                      </Button>
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="default"
                                        onClick={() => handleRunAlgorithm(rec)}
                                        disabled={isLoading}
                                        className="h-7 text-xs gap-1 font-medium cursor-pointer shrink-0"
                                        title="Chạy ngay với thiết lập mặc định tối ưu"
                                      >
                                        <TrendingUp className="size-3 shrink-0" />
                                        <span className="hidden xs:inline">Chạy ngay</span>
                                        <ArrowRight className="size-3 shrink-0" />
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {/* Chart Visualization */}
                      {msg.chart_image && (
                        <div className="rounded-lg border border-border/70 bg-card p-2 space-y-2 overflow-hidden">
                          <div className="flex items-center justify-between border-b border-border/60 pb-1">
                            <span className="text-xs font-medium text-foreground flex items-center gap-1.5">
                              <BarChart3 className="size-3.5 text-primary" /> Biểu đồ phân tích
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const link = document.createElement("a")
                                link.href = msg.chart_image!
                                link.download = `finai_chart_${Date.now()}.png`
                                link.click()
                              }}
                              className="h-6 text-xs gap-1 px-2"
                            >
                              <Download className="size-3" /> Tải ảnh
                            </Button>
                          </div>
                          <div className="rounded-md overflow-hidden bg-background flex items-center justify-center p-1">
                            <ResultFigure src={msg.chart_image} alt="Biểu đồ phân tích" />
                          </div>

                          {/* Quick Follow-up Actions directly in Chat */}
                          <div className="pt-2 flex flex-wrap gap-1.5 border-t border-border/40">
                            <span className="text-[10px] text-muted-foreground w-full mb-0.5 font-medium">Thao tác tiếp theo trong đoạn chat:</span>
                            <button
                              type="button"
                              onClick={() => handleSendMessage("Hãy phân tích sâu hơn về các chỉ số thống kê, tỷ lệ tăng trưởng và xu hướng từ biểu đồ vừa vẽ.")}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-border/80 bg-background hover:bg-muted text-[11px] text-foreground transition-all cursor-pointer"
                            >
                              <Sparkles className="size-3 text-primary" />
                              <span>Phân tích thống kê & xu hướng</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSendMessage("Hãy kiểm tra và chỉ ra các điểm bất thường (outliers/anomalies) trong dữ liệu này.")}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-border/80 bg-background hover:bg-muted text-[11px] text-foreground transition-all cursor-pointer"
                            >
                              <AlertCircle className="size-3 text-amber-500" />
                              <span>Tìm điểm bất thường</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSendMessage("Hãy dự phóng kịch bản tương lai và đề xuất lời khuyên kinh doanh cho doanh nghiệp.")}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-border/80 bg-background hover:bg-muted text-[11px] text-foreground transition-all cursor-pointer"
                            >
                              <TrendingUp className="size-3 text-emerald-500" />
                              <span>Lời khuyên kinh doanh SME</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Exported Dataset File */}
                      {msg.export_file && (
                        <div className="rounded-lg border border-primary/30 bg-primary/5 p-2.5 flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <FileSpreadsheet className="size-4 text-primary shrink-0" />
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-foreground truncate">{msg.export_file.filename}</p>
                              <p className="text-[11px] text-muted-foreground">
                                {msg.export_file.row_count.toLocaleString()} dòng • {msg.export_file.size_kb} KB
                              </p>
                            </div>
                          </div>
                          <a
                            href={`http://localhost:8000${msg.export_file.download_url}`}
                            download={msg.export_file.filename}
                            className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
                          >
                            <Download className="size-3" /> Tải tệp
                          </a>
                        </div>
                      )}

                      {/* Error */}
                      {msg.execution_status === "error" && (
                        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive space-y-1">
                          <div className="flex items-center gap-1.5 font-semibold">
                            <AlertCircle className="size-3.5" />
                            <span>Lỗi thực thi</span>
                          </div>
                          <p className="font-mono text-[11px] whitespace-pre-wrap break-words">
                            {msg.execution_error || "Quá trình thực thi gặp sự cố."}
                          </p>
                        </div>
                      )}

                      {/* Technical Execution Accordion */}
                      {((msg.agent_steps && msg.agent_steps.length > 0) || msg.ai_code) && (
                        <div className="pt-1 border-t border-border/50">
                          <button
                            type="button"
                            onClick={() => toggleTraceExpand(msg.id)}
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                          >
                            <Code2 className="size-3" />
                            <span>Mã xử lý AI</span>
                            {expandedTraceIds[msg.id] ? (
                              <ChevronUp className="size-3" />
                            ) : (
                              <ChevronDown className="size-3" />
                            )}
                          </button>

                          {expandedTraceIds[msg.id] && (
                            <div className="mt-2 space-y-2 rounded-lg border border-border/70 bg-muted/20 p-2.5 text-xs overflow-hidden">
                              {msg.agent_steps && msg.agent_steps.length > 0 && (
                                <div className="space-y-1">
                                  {msg.agent_steps.map((st, idx) => (
                                    <div key={idx} className="flex items-center justify-between text-[11px] py-0.5">
                                      <span className="font-mono text-foreground truncate">
                                        #{st.step} <span className="text-primary">{st.tool}</span>
                                      </span>
                                      <span className="text-muted-foreground font-mono text-[10px] shrink-0">
                                        {st.duration_ms}ms
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {msg.ai_code && (
                                <div className="space-y-1 pt-1 border-t border-border/40">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] text-muted-foreground">Python Pandas:</span>
                                    <button
                                      type="button"
                                      onClick={() => copyCode(msg.ai_code!, msg.id)}
                                      className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground cursor-pointer"
                                    >
                                      {copiedCodeId === msg.id ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
                                      {copiedCodeId === msg.id ? "Đã sao chép" : "Sao chép"}
                                    </button>
                                  </div>
                                  <pre className="rounded-md border border-border/50 bg-slate-950 text-slate-100 p-2 text-[11px] font-mono overflow-x-auto leading-relaxed max-h-40">
                                    <code>{msg.ai_code}</code>
                                  </pre>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}

          {isLoading && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground animate-pulse">
              <Bot className="size-4 text-primary" />
              <span>FinAI đang phân tích...</span>
            </div>
          )}

          <div ref={chatBottomRef} />
        </div>
      </div>

      {/* ================= CHAT INPUT BAR ================= */}
      <div className="border-t border-border/70 bg-card p-2.5 sm:p-3 shrink-0 min-w-0">
        <div className="max-w-3xl mx-auto w-full min-w-0">
          <div className="flex items-end gap-2 rounded-xl border border-input bg-background p-1.5 shadow-2xs focus-within:border-primary/80 transition-all min-w-0">
            {/* Auto-growing Textarea - Exactly "Nhập câu hỏi..." */}
            <textarea
              ref={textareaRef}
              rows={1}
              aria-label="Nhập câu hỏi"
              placeholder="Nhập câu hỏi..."
              value={query}
              disabled={isLoading}
              onChange={handleTextareaChange}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  if (!isLoading && query.trim()) {
                    handleSendMessage()
                  }
                }
              }}
              className="flex-1 bg-transparent px-2 py-1 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:outline-none resize-none max-h-28 min-h-[32px] leading-relaxed min-w-0"
            />

            {/* Send Button */}
            <LoadingButton
              onClick={() => handleSendMessage()}
              loading={isLoading}
              disabled={!activeDataset || isLoading || !query.trim()}
              className="h-8 px-3 text-xs font-medium rounded-lg shrink-0 gap-1"
            >
              <Send className="size-3" />
              <span>Gửi</span>
            </LoadingButton>
          </div>
        </div>
      </div>

      {/* Interactive Upload Modal with 4-case handling */}
      <InteractiveUploadDialog
        open={isUploadDialogOpen}
        onOpenChange={setIsUploadDialogOpen}
        onSuccess={handleInteractiveUploadSuccess}
      />
    </div>
  )
}
