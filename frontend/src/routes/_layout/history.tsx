import { PageHeading } from "@/components/Common/PageHeading"
import { useState, useEffect, useMemo } from "react"
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
import { Checkbox } from "@/components/ui/checkbox"
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

  // Multi-select state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false)
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)

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
      setHistoryItems((prev) => prev.filter((item) => item.id !== id))
      setSelectedIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      toast.success("Đã xóa bản ghi")
      const statRes = await HistoryService.getStats()
      setStats(statRes)
    } catch {
      toast.error("Lỗi khi xóa bản ghi")
    }
  }

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return
    try {
      setIsBulkDeleting(true)
      const res = await HistoryService.bulkDeleteHistory(Array.from(selectedIds))
      toast.success(res.message || `Đã xóa thành công ${selectedIds.size} bản ghi`)
      setSelectedIds(new Set())
      setIsBulkDeleteDialogOpen(false)
      loadData()
    } catch {
      toast.error("Lỗi khi xóa các bản ghi đã chọn")
    } finally {
      setIsBulkDeleting(false)
    }
  }

  const handleClearAll = async () => {
    setIsDeleting(true)
    try {
      await HistoryService.clearAllHistory()
      setHistoryItems([])
      setSelectedIds(new Set())
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

  const isAllSelected = useMemo(() => {
    return (
      historyItems.length > 0 &&
      historyItems.every((item) => selectedIds.has(item.id))
    )
  }, [historyItems, selectedIds])

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(historyItems.map((item) => item.id)))
    }
  }

  const handleToggleSelectRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
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
                <Trash2 className="size-3.5" /> Dọn dẹp tất cả
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

      {/* Multi-Selection Action Strip */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between p-3 rounded-xl border border-primary/30 bg-primary/5 text-xs">
          <div className="flex items-center gap-2">
            <Badge variant="default" className="text-xs px-2.5 py-0.5 font-medium">
              Đã chọn {selectedIds.size} bản ghi
            </Badge>
            <span className="text-muted-foreground hidden sm:inline">
              (trên tổng số {historyItems.length} bản ghi đang hiển thị)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedIds(new Set())}
              className="h-7.5 text-xs text-muted-foreground hover:text-foreground"
            >
              Bỏ chọn
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setIsBulkDeleteDialogOpen(true)}
              className="h-7.5 text-xs gap-1.5 shadow-2xs font-medium"
            >
              <Trash2 className="size-3.5" />
              Xóa {selectedIds.size} bản ghi đã chọn
            </Button>
          </div>
        </div>
      )}

      {/* History Table */}
      <div className="w-full min-w-0 max-w-full rounded-xl border border-border/80 bg-card shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow className="border-border/60 hover:bg-transparent">
                <TableHead className="w-10 pl-4 pr-1">
                  <Checkbox
                    checked={isAllSelected}
                    onCheckedChange={handleToggleSelectAll}
                    aria-label="Chọn tất cả bản ghi"
                  />
                </TableHead>
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
                    <TableCell className="w-10 pl-4 pr-1"><Skeleton className="size-4" /></TableCell>
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
                  <TableCell colSpan={8} className="h-40 text-center">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <HistoryIcon className="size-6 text-muted-foreground/50" />
                      <p className="text-sm font-medium text-foreground">Chưa có bản ghi phân tích nào</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                historyItems.map((item) => {
                  const isSuccess = item.status === "success"
                  const isSelected = selectedIds.has(item.id)

                  return (
                    <TableRow
                      key={item.id}
                      onClick={() => openDetailModal(item)}
                      className={`border-border/60 cursor-pointer transition-colors ${
                        isSelected ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-muted/30"
                      }`}
                    >
                      <TableCell className="w-10 pl-4 pr-1" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => handleToggleSelectRow(item.id)}
                          aria-label="Chọn bản ghi này"
                        />
                      </TableCell>

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
                    {selectedItem.status === "success" ? (
                      <CheckCircle2 className="size-3" />
                    ) : (
                      <AlertCircle className="size-3" />
                    )}
                    {selectedItem.status === "success" ? "Thành công" : "Thất bại"}
                  </Badge>
                  <span className="text-xs text-muted-foreground font-mono">
                    {new Date(selectedItem.created_at).toLocaleString("vi-VN")}
                  </span>
                </div>
                <DialogTitle className="text-sm font-semibold text-foreground pt-1.5 leading-snug">
                  {selectedItem.query}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground flex items-center gap-1.5 pt-0.5">
                  <FileSpreadsheet className="size-3.5 text-primary" />
                  <span>Dataset: <strong>{selectedItem.dataset_name}</strong></span>
                </DialogDescription>
              </DialogHeader>

              {/* Detail Tabs */}
              <Tabs value={activeDetailTab} onValueChange={setActiveDetailTab} className="w-full">
                <TabsList className="grid grid-cols-4 h-8 bg-muted/50 p-0.5 rounded-lg">
                  <TabsTrigger value="overview" className="text-xs gap-1 py-1">
                    <Info className="size-3" /> Tổng quan
                  </TabsTrigger>
                  <TabsTrigger value="chart" disabled={!selectedItem.chart_image} className="text-xs gap-1 py-1">
                    <BarChart3 className="size-3" /> Biểu đồ
                  </TabsTrigger>
                  <TabsTrigger value="code" className="text-xs gap-1 py-1">
                    <Code2 className="size-3" /> Mã Python
                  </TabsTrigger>
                  <TabsTrigger value="output" className="text-xs gap-1 py-1">
                    <Terminal className="size-3" /> Kết quả
                  </TabsTrigger>
                </TabsList>

                {/* Tab: Overview */}
                <TabsContent value="overview" className="space-y-2 pt-2 min-w-0">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                    <div className="p-2.5 rounded-lg border border-border/70 bg-card">
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase">Thời gian thực thi:</span>
                      <p className="font-semibold text-foreground mt-0.5">{selectedItem.execution_time_ms} ms</p>
                    </div>
                    <div className="p-2.5 rounded-lg border border-border/70 bg-card">
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase">Bộ nhớ sử dụng:</span>
                      <p className="font-semibold text-foreground mt-0.5">{selectedItem.memory_mb} MB</p>
                    </div>
                    <div className="p-2.5 rounded-lg border border-border/70 bg-card">
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase">Phạm vi cột:</span>
                      <p className="font-semibold text-foreground mt-0.5 truncate">{selectedItem.scope_columns || "Toàn bộ"}</p>
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg border border-border/70 bg-card min-w-0">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase">Câu hỏi gốc:</span>
                    <p className="text-xs text-foreground break-words">{selectedItem.query}</p>
                  </div>
                </TabsContent>

                {/* Tab: Chart */}
                {selectedItem.chart_image && (
                  <TabsContent value="chart" className="space-y-2 pt-2 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Biểu đồ sinh bởi Matplotlib:</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs gap-1"
                        onClick={() => handleDownloadChart(selectedItem.chart_image!)}
                      >
                        <Download className="size-3" /> Tải ảnh
                      </Button>
                    </div>
                    <div className="rounded-xl border border-border/80 bg-muted/30 p-2 flex items-center justify-center overflow-hidden">
                      <ResultFigure src={selectedItem.chart_image} alt="Biểu đồ phân tích" />
                    </div>
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

                {/* Tab Output */}
                <TabsContent value="output" className="space-y-2 pt-2 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Kết quả tiêu chuẩn (Stdout):</span>
                    {selectedItem.stdout && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopyStdout(selectedItem.stdout!)}
                        className="h-7 text-xs gap-1"
                      >
                        {hasCopiedStdout ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                        {hasCopiedStdout ? "Đã chép" : "Sao chép"}
                      </Button>
                    )}
                  </div>
                  <pre className="p-3 rounded-lg bg-muted/40 text-foreground text-xs font-mono overflow-x-auto leading-relaxed max-h-64 border border-border/80">
                    <code>{selectedItem.stdout || "(Không có kết quả xuất dạng chuỗi)"}</code>
                  </pre>
                </TabsContent>

                {/* Tab Error if any */}
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

      {/* Confirmation Dialog Bulk Delete */}
      <Dialog open={isBulkDeleteDialogOpen} onOpenChange={setIsBulkDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold text-destructive flex items-center gap-2">
              <Trash2 className="size-4" /> Xác nhận xóa hàng loạt
            </DialogTitle>
            <DialogDescription className="text-xs leading-relaxed space-y-1">
              <span>
                Bạn có chắc chắn muốn xóa vĩnh viễn <strong>{selectedIds.size} bản ghi lịch sử</strong> đã chọn?
              </span>
              <span className="block text-destructive font-medium">
                Thao tác này không thể hoàn tác.
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 mt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsBulkDeleteDialogOpen(false)}
              disabled={isBulkDeleting}
            >
              Hủy
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleBulkDelete}
              disabled={isBulkDeleting}
            >
              {isBulkDeleting ? "Đang xóa..." : `Xóa ${selectedIds.size} bản ghi`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
