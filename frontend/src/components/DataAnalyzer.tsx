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
  RefreshCw,
  Sparkles,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { LoadingButton } from "@/components/ui/loading-button"
import { ResultFigure } from "@/components/Common/ResultFigure"
import { DatasetsService, Dataset } from "@/services/datasetsService"

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
  const [isUploading, setIsUploading] = useState(false)
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null)
  const [expandedTraceIds, setExpandedTraceIds] = useState<Record<string, boolean>>({})

  const toggleTraceExpand = (id: string) => {
    setExpandedTraceIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }))
  }

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const chatBottomRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

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

  // Single upload handler
  const handleLocalFileUpload = async (uploadedFile: File) => {
    setIsUploading(true)
    try {
      const newDataset = await DatasetsService.uploadDataset(uploadedFile)
      setDatasets((prev) => [newDataset, ...prev.filter((d) => d.id !== newDataset.id)])
      setSelectedDatasetId(newDataset.id)
      if (onDatasetSaved) {
        onDatasetSaved(newDataset)
      }
      toast.success(`Đã tải lên "${newDataset.filename}"`)
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Không thể tải tệp lên")
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
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
        text: resData.summary,
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
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="h-8 text-xs gap-1.5 font-medium shrink-0"
            title="Tải lên tệp dữ liệu Excel hoặc CSV"
          >
            {isUploading ? (
              <RefreshCw className="size-3.5 animate-spin" />
            ) : (
              <Upload className="size-3.5" />
            )}
            <span>{isUploading ? "Đang tải..." : "Tải lên Dữ liệu"}</span>
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv, .xlsx, .xls"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) handleLocalFileUpload(f)
            }}
          />

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

                      {/* Main Insight */}
                      {msg.stdout && (
                        <div className="text-xs sm:text-sm text-foreground leading-relaxed whitespace-pre-wrap break-words overflow-x-auto">
                          {msg.stdout}
                        </div>
                      )}

                      {/* Chart Visualization */}
                      {msg.chart_image && (
                        <div className="rounded-lg border border-border/70 bg-card p-2 space-y-1.5 overflow-hidden">
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
    </div>
  )
}
