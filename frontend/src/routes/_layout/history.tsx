import { PageHeading } from "@/components/Common/PageHeading"
import { useState, useEffect } from "react"
import { createFileRoute } from "@tanstack/react-router"
import {
  History as HistoryIcon,
  Search,
  RefreshCw,
  Clock,
  Cpu,
  CheckCircle2,
  AlertCircle,
  Eye,
  Trash2,
  Download,
  Copy,
  Check,
  FileSpreadsheet,
  Code2,
  BarChart3,
  Terminal,
  Info,
  X,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  HistoryService,
  AnalysisHistoryItem,
  HistoryStats,
} from "@/services/historyService"
import { ResultFigure } from "@/components/Common/ResultFigure"

export const Route = createFileRoute("/_layout/history")({
  component: HistoryPage,
  head: () => ({
    meta: [
      {
        title: "Lịch Sử Phân Tích - FinAI",
      },
    ],
  }),
})

function HistoryPage() {
  const [historyItems, setHistoryItems] = useState<AnalysisHistoryItem[]>([])
  const [stats, setStats] = useState<HistoryStats>({
    total_queries: 0,
    success_rate_pct: 100,
    avg_time_ms: 0,
    avg_memory_mb: 0,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")

  // Modal detail
  const [selectedItem, setSelectedItem] = useState<AnalysisHistoryItem | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [activeDetailTab, setActiveDetailTab] = useState<string>("overview")
  const [hasCopiedCode, setHasCopiedCode] = useState(false)
  const [hasCopiedStdout, setHasCopiedStdout] = useState(false)

  // Clear dialog
  const [isClearAllDialogOpen, setIsClearAllDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    loadData()
  }, [searchQuery, statusFilter])

  const loadData = async () => {
    setIsLoading(true)
    try {
      const [histRes, statRes] = await Promise.all([
        HistoryService.getHistory(0, 100, searchQuery, statusFilter),
        HistoryService.getStats(),
      ])
      setHistoryItems(histRes.data)
      setStats(statRes)
    } catch {
      toast.error("Không thể tải dữ liệu lịch sử")
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteItem = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await HistoryService.deleteHistoryItem(id)
      setHistoryItems(historyItems.filter((item) => item.id !== id))
      toast.success("Đã xóa bản ghi")
      const statRes = await HistoryService.getStats()
      setStats(statRes)
    } catch {
      toast.error("Lỗi khi xóa bản ghi")
    }
  }

  const handleClearAll = async () => {
    setIsDeleting(true)
    try {
      await HistoryService.clearAllHistory()
      setHistoryItems([])
      setStats({
        total_queries: 0,
        success_rate_pct: 100,
        avg_time_ms: 0,
        avg_memory_mb: 0,
      })
      setIsClearAllDialogOpen(false)
      toast.success("Đã dọn dẹp sạch toàn bộ lịch sử")
    } catch {
      toast.error("Lỗi khi xóa lịch sử")
    } finally {
      setIsDeleting(false)
    }
  }

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code)
    setHasCopiedCode(true)
    toast.success("Đã sao chép mã")
    setTimeout(() => setHasCopiedCode(false), 2000)
  }

  const handleCopyStdout = (text: string) => {
    navigator.clipboard.writeText(text)
    setHasCopiedStdout(true)
    toast.success("Đã sao chép kết quả")
    setTimeout(() => setHasCopiedStdout(false), 2000)
  }

  const handleDownloadChart = (imageSrc: string) => {
    const link = document.createElement("a")
    link.href = imageSrc
    link.download = `ket_qua_phan_tich_${Date.now()}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success("Đã tải biểu đồ")
  }

  const openDetailModal = (item: AnalysisHistoryItem) => {
    setSelectedItem(item)
    setActiveDetailTab(item.chart_image ? "chart" : "overview")
    setIsDetailOpen(true)
  }

  return (
    <div className="w-full min-w-0 max-w-full space-y-5 pb-10">
      <PageHeading
        title="Lịch sử phân tích"
        description="Nhật ký các lượt phân tích và mã nguồn AI thực thi."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={loadData} disabled={isLoading} className="gap-1.5 shadow-2xs h-8 text-xs">
              <RefreshCw className={`size-3.5 ${isLoading ? "animate-spin" : ""}`} /> Làm mới
            </Button>
            {historyItems.length > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setIsClearAllDialogOpen(true)}
                className="gap-1.5 shadow-2xs h-8 text-xs"
              >
                <Trash2 className="size-3.5" /> Dọn dẹp
              </Button>
            )}
          </div>
        }
      />

      {/* KPI Metrics Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 min-w-0">
        <div className="rounded-xl border border-border/80 bg-card p-3 sm:p-4 shadow-2xs flex items-center justify-between min-w-0">
          <div className="space-y-0.5 min-w-0">
            <p className="text-xs text-muted-foreground">Tổng truy vấn</p>
            <h3 className="text-lg sm:text-xl font-semibold tracking-tight text-foreground">{stats.total_queries}</h3>
          </div>
          <div className="flex size-8.5 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
            <HistoryIcon className="size-4" />
          </div>
        </div>

        <div className="rounded-xl border border-border/80 bg-card p-3 sm:p-4 shadow-2xs flex items-center justify-between min-w-0">
          <div className="space-y-0.5 min-w-0">
            <p className="text-xs text-muted-foreground">Tỷ lệ thành công</p>
            <h3 className="text-lg sm:text-xl font-semibold tracking-tight text-emerald-600 dark:text-emerald-400">
              {stats.success_rate_pct}%
            </h3>
          </div>
          <div className="flex size-8.5 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
            <CheckCircle2 className="size-4" />
          </div>
        </div>

        <div className="rounded-xl border border-border/80 bg-card p-3 sm:p-4 shadow-2xs flex items-center justify-between min-w-0">
          <div className="space-y-0.5 min-w-0">
            <p className="text-xs text-muted-foreground">Thời gian TB</p>
            <h3 className="text-lg sm:text-xl font-semibold tracking-tight text-foreground">
              {stats.avg_time_ms > 1000 ? `${(stats.avg_time_ms / 1000).toFixed(2)}s` : `${stats.avg_time_ms}ms`}
            </h3>
          </div>
          <div className="flex size-8.5 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
            <Clock className="size-4" />
          </div>
        </div>

        <div className="rounded-xl border border-border/80 bg-card p-3 sm:p-4 shadow-2xs flex items-center justify-between min-w-0">
          <div className="space-y-0.5 min-w-0">
            <p className="text-xs text-muted-foreground">Bộ nhớ TB</p>
            <h3 className="text-lg sm:text-xl font-semibold tracking-tight text-foreground">{stats.avg_memory_mb} MB</h3>
          </div>
          <div className="flex size-8.5 items-center justify-center rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 shrink-0">
            <Cpu className="size-4" />
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 min-w-0">
        <div className="relative flex-1 max-w-sm min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Tìm theo nội dung..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-8.5 text-xs"
          />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="flex rounded-lg border border-border/80 bg-muted/40 p-0.5">
            <button
              onClick={() => setStatusFilter("all")}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                statusFilter === "all"
                  ? "bg-background text-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Tất cả
            </button>
            <button
              onClick={() => setStatusFilter("success")}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                statusFilter === "success"
                  ? "bg-background text-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Thành công
            </button>
            <button
              onClick={() => setStatusFilter("error")}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                statusFilter === "error"
                  ? "bg-background text-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Lỗi
            </button>
          </div>

          {(searchQuery || statusFilter !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchQuery("")
                setStatusFilter("all")
              }}
              className="h-8 text-xs text-muted-foreground hover:text-foreground gap-1 px-2"
            >
              <X className="size-3.5" /> Xóa lọc
            </Button>
          )}
        </div>
      </div>

      {/* History Table - No pagination controls as requested */}
      <div className="w-full min-w-0 max-w-full rounded-xl border border-border/80 bg-card shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow className="border-border/60 hover:bg-transparent">
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Thời gian</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Dataset</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Yêu cầu / Câu hỏi</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground text-center">Thời gian</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground text-center">Bộ nhớ</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground text-center">Trạng thái</TableHead>
                <TableHead className="text-right font-semibold text-xs uppercase tracking-wider text-muted-foreground pr-4">Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <TableRow key={idx}>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-60" /></TableCell>
                    <TableCell className="text-center"><Skeleton className="h-4 w-14 mx-auto" /></TableCell>
                    <TableCell className="text-center"><Skeleton className="h-4 w-14 mx-auto" /></TableCell>
                    <TableCell className="text-center"><Skeleton className="h-4 w-20 mx-auto" /></TableCell>
                    <TableCell className="text-right pr-4"><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : historyItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-40 text-center">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <HistoryIcon className="size-6 text-muted-foreground/50" />
                      <p className="text-sm font-medium text-foreground">Chưa có bản ghi phân tích nào</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                historyItems.map((item) => {
                  const isSuccess = item.status === "success"
                  return (
                    <TableRow
                      key={item.id}
                      onClick={() => openDetailModal(item)}
                      className="border-border/60 cursor-pointer hover:bg-muted/30 transition-colors"
                    >
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(item.created_at).toLocaleString("vi-VN", {
                          hour: "2-digit",
                          minute: "2-digit",
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        })}
                      </TableCell>

                      <TableCell className="text-xs font-medium">
                        <span className="flex items-center gap-1.5 truncate max-w-[140px]">
                          <FileSpreadsheet className="size-3.5 text-primary shrink-0" />
                          <span className="truncate">{item.dataset_name}</span>
                        </span>
                      </TableCell>

                      <TableCell className="text-xs max-w-xs md:max-w-md truncate text-foreground font-medium">
                        {item.query}
                      </TableCell>

                      <TableCell className="text-xs text-center font-mono text-muted-foreground whitespace-nowrap">
                        {item.execution_time_ms > 1000
                          ? `${(item.execution_time_ms / 1000).toFixed(2)}s`
                          : `${item.execution_time_ms}ms`}
                      </TableCell>

                      <TableCell className="text-xs text-center font-mono text-muted-foreground whitespace-nowrap">
                        {item.memory_mb} MB
                      </TableCell>

                      <TableCell className="text-center whitespace-nowrap">
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-medium gap-1 ${
                            isSuccess
                              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
                              : "bg-destructive/10 text-destructive border-destructive/20"
                          }`}
                        >
                          {isSuccess ? <CheckCircle2 className="size-3" /> : <AlertCircle className="size-3" />}
                          {isSuccess ? "Thành công" : "Lỗi"}
                        </Badge>
                      </TableCell>

                      <TableCell className="text-right whitespace-nowrap pr-4">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-primary hover:text-primary hover:bg-primary/10"
                            onClick={(e) => {
                              e.stopPropagation()
                              openDetailModal(item)
                            }}
                            title="Xem chi tiết"
                          >
                            <Eye className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            onClick={(e) => handleDeleteItem(item.id, e)}
                            title="Xóa bản ghi"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Modal Detail */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-3xl p-4 sm:p-5">
          {selectedItem && (
            <div className="space-y-3.5 min-w-0">
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={`text-[10px] font-medium gap-1 ${
                      selectedItem.status === "success"
                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
                        : "bg-destructive/10 text-destructive border-destructive/20"
                    }`}
                  >
                    {selectedItem.status === "success" ? <CheckCircle2 className="size-3" /> : <AlertCircle className="size-3" />}
                    {selectedItem.status === "success" ? "Thành công" : "Lỗi"}
                  </Badge>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    {new Date(selectedItem.created_at).toLocaleString("vi-VN")}
                  </span>
                </div>
                <DialogTitle className="text-sm sm:text-base font-semibold mt-1 text-foreground leading-snug break-words">
                  {selectedItem.query}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Dataset: <strong className="text-foreground">{selectedItem.dataset_name}</strong> • Sandbox: <strong className="text-foreground">{selectedItem.execution_time_ms}ms</strong> • RAM: <strong className="text-foreground">{selectedItem.memory_mb} MB</strong>
                </DialogDescription>
              </DialogHeader>

              {/* Tabs Inside Modal */}
              <Tabs value={activeDetailTab} onValueChange={setActiveDetailTab} className="w-full min-w-0">
                <TabsList className="h-8 bg-muted/60 p-0.5">
                  <TabsTrigger value="overview" className="text-xs h-7 px-2.5 gap-1">
                    <Info className="size-3" /> Tổng quan
                  </TabsTrigger>
                  {selectedItem.chart_image && (
                    <TabsTrigger value="chart" className="text-xs h-7 px-2.5 gap-1">
                      <BarChart3 className="size-3 text-primary" /> Biểu đồ
                    </TabsTrigger>
                  )}
                  {selectedItem.stdout && (
                    <TabsTrigger value="stdout" className="text-xs h-7 px-2.5 gap-1">
                      <Terminal className="size-3" /> Kết quả
                    </TabsTrigger>
                  )}
                  {selectedItem.ai_code && (
                    <TabsTrigger value="code" className="text-xs h-7 px-2.5 gap-1">
                      <Code2 className="size-3" /> Mã Python
                    </TabsTrigger>
                  )}
                  {selectedItem.error_message && (
                    <TabsTrigger value="error" className="text-xs h-7 px-2.5 gap-1 text-destructive">
                      <AlertCircle className="size-3" /> Lỗi
                    </TabsTrigger>
                  )}
                </TabsList>

                {/* Tab: Overview */}
                <TabsContent value="overview" className="space-y-2.5 pt-2 min-w-0">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="p-2.5 rounded-lg border border-border/70 bg-card">
                      <p className="text-[11px] text-muted-foreground">Thời gian</p>
                      <p className="text-sm font-semibold mt-0.5">{selectedItem.execution_time_ms} ms</p>
                    </div>
                    <div className="p-2.5 rounded-lg border border-border/70 bg-card">
                      <p className="text-[11px] text-muted-foreground">Bộ nhớ</p>
                      <p className="text-sm font-semibold mt-0.5">{selectedItem.memory_mb} MB</p>
                    </div>
                    <div className="p-2.5 rounded-lg border border-border/70 bg-card">
                      <p className="text-[11px] text-muted-foreground">Trạng thái</p>
                      <p className="text-sm font-semibold mt-0.5">{selectedItem.status === "success" ? "Thành công" : "Lỗi"}</p>
                    </div>
                    <div className="p-2.5 rounded-lg border border-border/70 bg-card min-w-0">
                      <p className="text-[11px] text-muted-foreground">Tệp dữ liệu</p>
                      <p className="text-xs font-semibold truncate mt-0.5">{selectedItem.dataset_name}</p>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg border border-border/70 bg-muted/20 space-y-1">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase">Câu hỏi gốc:</span>
                    <p className="text-xs text-foreground break-words">{selectedItem.query}</p>
                  </div>
                </TabsContent>

                {/* Tab: Chart */}
                {selectedItem.chart_image && (
                  <TabsContent value="chart" className="space-y-2 pt-2 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Biểu đồ trực quan hóa:</span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1"
                        onClick={() => handleDownloadChart(selectedItem.chart_image!)}
                      >
                        <Download className="size-3" /> Tải ảnh PNG
                      </Button>
                    </div>
                    <div className="rounded-xl border border-border/80 bg-muted/30 p-2 flex items-center justify-center overflow-hidden">
                      <ResultFigure
                        src={selectedItem.chart_image}
                        alt="Biểu đồ phân tích"
                      />
                    </div>
                  </TabsContent>
                )}

                {/* Tab: Stdout */}
                {selectedItem.stdout && (
                  <TabsContent value="stdout" className="space-y-1.5 pt-2 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Kết quả tính toán:</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs gap-1"
                        onClick={() => handleCopyStdout(selectedItem.stdout!)}
                      >
                        {hasCopiedStdout ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                        {hasCopiedStdout ? "Đã sao chép" : "Sao chép"}
                      </Button>
                    </div>
                    <pre className="p-3 rounded-lg bg-muted/40 border border-border/70 text-xs font-mono whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto break-words">
                      {selectedItem.stdout}
                    </pre>
                  </TabsContent>
                )}

                {/* Tab: Python Code */}
                {selectedItem.ai_code && (
                  <TabsContent value="code" className="space-y-1.5 pt-2 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Mã Python thực thi:</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs gap-1"
                        onClick={() => handleCopyCode(selectedItem.ai_code!)}
                      >
                        {hasCopiedCode ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                        {hasCopiedCode ? "Đã sao chép" : "Sao chép mã"}
                      </Button>
                    </div>
                    <pre className="p-3 rounded-lg bg-slate-950 text-slate-100 text-xs font-mono whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto border border-slate-800">
                      {selectedItem.ai_code}
                    </pre>
                  </TabsContent>
                )}

                {/* Tab: Error */}
                {selectedItem.error_message && (
                  <TabsContent value="error" className="space-y-1.5 pt-2 min-w-0">
                    <span className="text-xs text-destructive font-medium">Chi tiết lỗi:</span>
                    <pre className="p-3 rounded-lg bg-destructive/10 text-destructive text-xs font-mono whitespace-pre-wrap leading-relaxed border border-destructive/20 max-h-64 overflow-y-auto break-words">
                      {selectedItem.error_message}
                    </pre>
                  </TabsContent>
                )}
              </Tabs>

              <DialogFooter className="mt-3 pt-2 border-t border-border/60">
                <Button variant="outline" size="sm" onClick={() => setIsDetailOpen(false)}>
                  Đóng
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog Clear All */}
      <Dialog open={isClearAllDialogOpen} onOpenChange={setIsClearAllDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">Xác nhận dọn dẹp</DialogTitle>
            <DialogDescription className="text-xs">
              Thao tác này sẽ xóa toàn bộ nhật ký câu hỏi và biểu đồ đã lưu.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 mt-2">
            <Button variant="outline" size="sm" onClick={() => setIsClearAllDialogOpen(false)} disabled={isDeleting}>
              Hủy
            </Button>
            <Button variant="destructive" size="sm" onClick={handleClearAll} disabled={isDeleting}>
              {isDeleting ? "Đang xóa..." : "Xác nhận xóa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
