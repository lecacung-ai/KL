import { PageHeading } from "@/components/Common/PageHeading"
import { useState, useEffect } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { History as HistoryIcon, Search, RefreshCw, Clock, Cpu, CheckCircle2, AlertCircle, Eye, Trash2, Download, Copy, Check, FileSpreadsheet, Code2, BarChart3, Terminal } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
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

export const Route = createFileRoute("/_layout/history")({
  component: HistoryPage,
  head: () => ({
    meta: [
      {
        title: "Lịch Sử Phân Tích & Giám Sát Tài Nguyên - FinAI",
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

  // Modal xem chi tiết
  const [selectedItem, setSelectedItem] = useState<AnalysisHistoryItem | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [hasCopiedCode, setHasCopiedCode] = useState(false)

  // Dialog xác nhận xóa toàn bộ
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
      toast.error("Không thể tải dữ liệu lịch sử phân tích")
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteItem = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await HistoryService.deleteHistoryItem(id)
      setHistoryItems(historyItems.filter((item) => item.id !== id))
      toast.success("Đã xóa bản ghi lịch sử")
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
      toast.success("Đã dọn dẹp sạch toàn bộ lịch sử phân tích")
    } catch {
      toast.error("Lỗi khi xóa lịch sử")
    } finally {
      setIsDeleting(false)
    }
  }

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code)
    setHasCopiedCode(true)
    toast.success("Đã sao chép mã nguồn vào bộ nhớ tạm")
    setTimeout(() => setHasCopiedCode(false), 2000)
  }

  const handleDownloadChart = (imageSrc: string) => {
    const link = document.createElement("a")
    link.href = imageSrc
    link.download = `ket_qua_phan_tich_${Date.now()}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success("Đã tải biểu đồ xuống máy")
  }

  return (
    <div className="flex min-w-0 flex-col gap-7 pb-8 w-full">
      <PageHeading eyebrow="Mỗi lần khám phá đều có dấu vết" title="Lịch sử phân tích"
        description="Xem lại những câu hỏi, kết quả và thông tin thực thi đã được lưu."
        action={<div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadData} disabled={isLoading} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} /> Làm mới
          </Button>
          {historyItems.length > 0 && (
            <Button variant="destructive" size="sm" onClick={() => setIsClearAllDialogOpen(true)} className="gap-2">
              <Trash2 className="h-4 w-4" /> Dọn dẹp lịch sử
            </Button>
          )}
        </div>} />

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-border bg-card  p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold tracking-normal text-muted-foreground">Tổng Lượt Truy Vấn</span>
            <HistoryIcon className="h-4 w-4 text-primary" />
          </div>
          <div className="text-2xl font-semibold mt-2 text-foreground">{stats.total_queries}</div>
          <span className="text-xs text-muted-foreground">Toàn bộ câu hỏi & tác vụ</span>
        </Card>

        <Card className="border-border bg-card  p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold tracking-normal text-muted-foreground">Tỷ Lệ Thành Công</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-semibold mt-2 text-emerald-500">{stats.success_rate_pct}%</div>
          <span className="text-xs text-muted-foreground">Sandbox xử lý chính xác</span>
        </Card>

        <Card className="border-border bg-card  p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold tracking-normal text-muted-foreground">Thời Gian Phản Hồi TB</span>
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          <div className="text-2xl font-semibold mt-2 text-foreground">
            {stats.avg_time_ms > 1000 ? `${(stats.avg_time_ms / 1000).toFixed(2)}s` : `${stats.avg_time_ms}ms`}
          </div>
          <span className="text-xs text-muted-foreground">Tốc độ sinh mã & chạy Sandbox</span>
        </Card>

        <Card className="border-border bg-card  p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold tracking-normal text-muted-foreground">Dung Lượng Bộ Nhớ TB</span>
            <Cpu className="h-4 w-4 text-primary" />
          </div>
          <div className="text-2xl font-semibold mt-2 text-foreground">{stats.avg_memory_mb} MB</div>
          <span className="text-xs text-muted-foreground">Tiến trình con cô lập an toàn</span>
        </Card>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Tìm kiếm nội dung câu hỏi, tệp dữ liệu..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <span className="text-xs text-muted-foreground shrink-0">Lọc theo trạng thái:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 rounded-md border border-input bg-background text-xs focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="success">Thành công (Passed)</option>
            <option value="error">Có lỗi (Error)</option>
          </select>
        </div>
      </div>

      {/* History Table */}
      <Card className="border-border shadow-sm">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 text-center text-xs text-muted-foreground flex flex-col items-center justify-center gap-2">
              <RefreshCw className="h-5 w-5 animate-spin text-primary" />
              Đang tải danh sách lịch sử phân tích...
            </div>
          ) : historyItems.length === 0 ? (
            <div className="p-12 text-center text-xs text-muted-foreground flex flex-col items-center justify-center gap-2">
              <HistoryIcon className="h-8 w-8 text-muted-foreground/40 mb-1" />
              Chưa có bản ghi phân tích nào được lưu trữ.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="font-semibold text-xs">Thời Gian</TableHead>
                    <TableHead className="font-semibold text-xs">Tệp Dữ Liệu</TableHead>
                    <TableHead className="font-semibold text-xs">Yêu Cầu / Tác Vụ Phân Tích</TableHead>
                    <TableHead className="font-semibold text-xs text-center">Thời Gian Chạy</TableHead>
                    <TableHead className="font-semibold text-xs text-center">Bộ Nhớ</TableHead>
                    <TableHead className="font-semibold text-xs text-center">Trạng Thái</TableHead>
                    <TableHead className="font-semibold text-xs text-right">Thao Tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historyItems.map((item) => {
                    const isSuccess = item.status === "success"
                    return (
                      <TableRow
                        key={item.id}
                        onClick={() => {
                          setSelectedItem(item)
                          setIsDetailOpen(true)
                        }}
                        className="cursor-pointer hover:bg-muted/30 transition-colors"
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
                          <span className="flex items-center gap-1.5 truncate max-w-[160px]">
                            <FileSpreadsheet className="h-3.5 w-3.5 text-primary shrink-0" />
                            {item.dataset_name}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs max-w-xs md:max-w-md truncate text-foreground/90 font-medium">
                          {item.query}
                        </TableCell>
                        <TableCell className="text-xs text-center font-mono">
                          {item.execution_time_ms > 1000
                            ? `${(item.execution_time_ms / 1000).toFixed(2)}s`
                            : `${item.execution_time_ms}ms`}
                        </TableCell>
                        <TableCell className="text-xs text-center font-mono text-muted-foreground">
                          {item.memory_mb} MB
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant="outline"
                            className={`text-xs gap-1 ${
                              isSuccess
                                ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
                                : "bg-destructive/10 text-destructive border-destructive/30"
                            }`}
                          >
                            {isSuccess ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                            {isSuccess ? "Thành công" : "Có lỗi"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-primary hover:text-primary"
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedItem(item)
                                setIsDetailOpen(true)
                              }}
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={(e) => handleDeleteItem(item.id, e)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal Xem Lại Chi Tiết Bản Ghi Phân Tích */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selectedItem && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={`text-xs gap-1 ${
                      selectedItem.status === "success"
                        ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
                        : "bg-destructive/10 text-destructive border-destructive/30"
                    }`}
                  >
                    {selectedItem.status === "success" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
                    {selectedItem.status === "success" ? "Thực thi thành công" : "Lỗi thực thi"}
                  </Badge>
                  <span className="text-xs text-muted-foreground font-mono">
                    {new Date(selectedItem.created_at).toLocaleString("vi-VN")}
                  </span>
                </div>
                <DialogTitle className="text-lg font-semibold mt-2 text-foreground">
                  {selectedItem.query}
                </DialogTitle>
                <DialogDescription className="text-xs flex items-center gap-3 pt-1">
                  <span>Tệp nguồn: <strong>{selectedItem.dataset_name}</strong></span>
                  <span>Thời gian Sandbox: <strong>{selectedItem.execution_time_ms}ms</strong></span>
                  <span>Bộ nhớ: <strong>{selectedItem.memory_mb} MB</strong></span>
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                {/* Ảnh Biểu Đồ (nếu có) */}
                {selectedItem.chart_image && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase">
                      <span className="flex items-center gap-1.5">
                        <BarChart3 className="h-4 w-4 text-primary" />
                        Biểu Đồ Trực Quan Hóa
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1"
                        onClick={() => handleDownloadChart(selectedItem.chart_image!)}
                      >
                        <Download className="h-3 w-3" />
                        Tải ảnh PNG
                      </Button>
                    </div>
                    <div className="rounded-lg border border-border bg-slate-950 p-2 flex items-center justify-center">
                      <img
                        src={selectedItem.chart_image}
                        alt="Biểu đồ phân tích"
                        className="max-h-[380px] w-auto object-contain rounded"
                      />
                    </div>
                  </div>
                )}

                {/* Kết quả số liệu (stdout) */}
                {selectedItem.stdout && (
                  <div className="space-y-1.5">
                    <span className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
                      <Terminal className="h-4 w-4 text-primary" />
                      Kết Quả Tính Toán / Số Liệu (Stdout)
                    </span>
                    <pre className="p-3 rounded-md bg-muted/50 border border-border text-xs font-mono whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                      {selectedItem.stdout}
                    </pre>
                  </div>
                )}

                {/* Mã nguồn Python */}
                {selectedItem.ai_code && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase">
                      <span className="flex items-center gap-1.5">
                        <Code2 className="h-4 w-4 text-primary" />
                        Mã Nguồn Python Đã Chạy
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs gap-1"
                        onClick={() => handleCopyCode(selectedItem.ai_code!)}
                      >
                        {hasCopiedCode ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                        {hasCopiedCode ? "Đã sao chép" : "Sao chép mã"}
                      </Button>
                    </div>
                    <pre className="p-3 rounded-md bg-slate-950 text-slate-100 text-xs font-mono whitespace-pre-wrap leading-relaxed max-h-56 overflow-y-auto border border-slate-800">
                      {selectedItem.ai_code}
                    </pre>
                  </div>
                )}

                {/* Lỗi (nếu có) */}
                {selectedItem.error_message && (
                  <div className="space-y-1.5">
                    <span className="text-xs font-semibold text-destructive uppercase flex items-center gap-1.5">
                      <AlertCircle className="h-4 w-4" />
                      Chi Tiết Lỗi Ghi Nhận
                    </span>
                    <pre className="p-3 rounded-md bg-destructive/10 text-destructive text-xs font-mono whitespace-pre-wrap leading-relaxed border border-destructive/20">
                      {selectedItem.error_message}
                    </pre>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" size="sm" onClick={() => setIsDetailOpen(false)}>
                  Đóng
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog Clear All */}
      <Dialog open={isClearAllDialogOpen} onOpenChange={setIsClearAllDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Xác nhận dọn dẹp lịch sử</DialogTitle>
            <DialogDescription className="text-xs">
              Thao tác này sẽ xóa toàn bộ nhật ký câu hỏi, mã phân tích và ảnh biểu đồ đã lưu. Hành động này không thể hoàn tác.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsClearAllDialogOpen(false)} disabled={isDeleting}>
              Hủy bỏ
            </Button>
            <Button variant="destructive" size="sm" onClick={handleClearAll} disabled={isDeleting}>
              {isDeleting ? "Đang xóa..." : "Xác nhận xóa sạch"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
