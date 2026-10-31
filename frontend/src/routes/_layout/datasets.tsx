import { PageHeading } from "@/components/Common/PageHeading"
import { useState, useEffect } from "react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { Plus, Search, FileSpreadsheet, Eye, Download, Trash2, RefreshCw, HardDrive, Rows, Layers, CheckCircle2, AlertCircle, MessageSquareText } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
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
import { DatasetsService, Dataset } from "@/services/datasetsService"
import { UploadDatasetDialog } from "@/components/Datasets/UploadDatasetDialog"
import { DatasetPreviewModal } from "@/components/Datasets/DatasetPreviewModal"

export const Route = createFileRoute("/_layout/datasets")({
  component: DatasetsPage,
  head: () => ({
    meta: [
      {
        title: "Kho Dữ Liệu Kinh Doanh - FinAI",
      },
    ],
  }),
})

function DatasetsPage() {
  const navigate = useNavigate()
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [filterType, setFilterType] = useState<string>("all")

  // Modals state
  const [isUploadOpen, setIsUploadOpen] = useState(false)
  const [previewDataset, setPreviewDataset] = useState<Dataset | null>(null)
  const [deleteDatasetItem, setDeleteDatasetItem] = useState<Dataset | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const fetchDatasets = async () => {
    try {
      setIsLoading(true)
      const res = await DatasetsService.getDatasets()
      setDatasets(res.data)
    } catch {
      toast.error("Không thể tải danh sách tệp dữ liệu")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchDatasets()
  }, [])

  const handleDelete = async () => {
    if (!deleteDatasetItem) return
    try {
      setIsDeleting(true)
      await DatasetsService.deleteDataset(deleteDatasetItem.id)
      toast.success(`Đã xóa tệp "${deleteDatasetItem.filename}"`)
      setDeleteDatasetItem(null)
      fetchDatasets()
    } catch {
      toast.error("Không thể xóa tệp dữ liệu")
    } finally {
      setIsDeleting(false)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    } catch {
      return dateStr
    }
  }

  const filteredDatasets = datasets.filter((d) => {
    const matchesSearch =
      d.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (d.description && d.description.toLowerCase().includes(searchQuery.toLowerCase()))

    const matchesType =
      filterType === "all" ||
      (filterType === "csv" && d.file_type === "csv") ||
      (filterType === "excel" && ["xlsx", "xls"].includes(d.file_type))

    return matchesSearch && matchesType
  })

  // Quick stats
  const totalDatasets = datasets.length
  const totalRows = datasets.reduce((sum, d) => sum + (d.row_count || 0), 0)
  const totalSize = datasets.reduce((sum, d) => sum + (d.size_bytes || 0), 0)

  return (
    <div className="space-y-6 pb-12">
      <PageHeading eyebrow="Các tệp của bạn, cùng một nơi" title="Kho dữ liệu"
        description="Quản lý bảng tính, xem cấu trúc và chọn nguồn cho lần phân tích tiếp theo."
        action={<Button onClick={() => setIsUploadOpen(true)}><Plus className="size-4" /> Tải tệp lên</Button>} />

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border bg-card p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Tổng số tệp dữ liệu</p>
            <h3 className="text-2xl font-semibold text-foreground mt-1">{totalDatasets} tệp</h3>
          </div>
          <div className="flex size-11 items-center justify-center rounded-xl bg-primary/5 text-primary dark:bg-primary/10 dark:text-primary">
            <Layers className="size-6" />
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Tổng dung lượng lưu trữ</p>
            <h3 className="text-2xl font-semibold text-foreground mt-1">{formatFileSize(totalSize)}</h3>
          </div>
          <div className="flex size-11 items-center justify-center rounded-xl bg-primary/5 text-primary dark:bg-primary/10 dark:text-primary">
            <HardDrive className="size-6" />
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Tổng số bản ghi đã nạp</p>
            <h3 className="text-2xl font-semibold text-foreground mt-1">{totalRows.toLocaleString()} dòng</h3>
          </div>
          <div className="flex size-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
            <Rows className="size-6" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Tìm theo tên tệp hoặc mô tả..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border bg-muted/40 p-0.5">
            <button
              onClick={() => setFilterType("all")}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                filterType === "all"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Tất cả ({datasets.length})
            </button>
            <button
              onClick={() => setFilterType("excel")}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                filterType === "excel"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Excel (.xlsx)
            </button>
            <button
              onClick={() => setFilterType("csv")}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                filterType === "csv"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              CSV (.csv)
            </button>
          </div>

          <Button
            variant="outline"
            size="icon"
            onClick={fetchDatasets}
            disabled={isLoading}
            className="size-9 shrink-0"
            title="Làm mới danh sách"
          >
            <RefreshCw className={`size-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Main Datasets Table */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead className="font-semibold">Tên Tệp Dữ Liệu</TableHead>
              <TableHead className="font-semibold">Phiên Bản</TableHead>
              <TableHead className="font-semibold">Kích Thước</TableHead>
              <TableHead className="font-semibold">Quy Mô</TableHead>
              <TableHead className="font-semibold">Trạng Thái</TableHead>
              <TableHead className="font-semibold">Ngày Tải Lên</TableHead>
              <TableHead className="text-right font-semibold pr-6">Thao Tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-40 text-center">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <RefreshCw className="size-6 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Đang tải kho dữ liệu...</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredDatasets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-48 text-center">
                  <div className="flex flex-col items-center justify-center gap-3">
                    <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <FileSpreadsheet className="size-6" />
                    </div>
                    <div>
                      <p className="text-base font-semibold text-foreground">Chưa có tệp dữ liệu nào</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Tải lên tệp Excel hoặc CSV đầu tiên để bắt đầu phân tích với AI
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => setIsUploadOpen(true)}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5"
                    >
                      <Plus className="size-4" /> Tải Tệp Lên Ngay
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredDatasets.map((item) => {
                const isExcel = ["xlsx", "xls"].includes(item.file_type)
                return (
                  <TableRow key={item.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex size-10 shrink-0 items-center justify-center rounded-lg shadow-sm ${
                            isExcel
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-400"
                              : "bg-primary/5 text-primary dark:bg-primary/10 dark:text-primary"
                          }`}
                        >
                          <FileSpreadsheet className="size-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm text-foreground truncate max-w-[240px]">
                            {item.filename}
                          </p>
                          <p className="text-xs text-muted-foreground truncate max-w-[280px]">
                            {item.description || "Không có mô tả"}
                          </p>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <Badge variant="outline" className="bg-muted/40 font-mono text-xs">
                        v{item.version}
                      </Badge>
                    </TableCell>

                    <TableCell className="text-xs font-mono text-muted-foreground">
                      {formatFileSize(item.size_bytes)}
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-1.5 text-xs">
                        <Badge variant="secondary" className="font-medium text-xs">
                          {item.row_count} dòng
                        </Badge>
                        <span className="text-muted-foreground">×</span>
                        <Badge variant="secondary" className="font-medium text-xs">
                          {item.column_count} cột
                        </Badge>
                      </div>
                    </TableCell>

                    <TableCell>
                      {item.status === "ready" ? (
                        <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 gap-1 font-medium text-xs">
                          <CheckCircle2 className="size-3" /> Sẵn sàng
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="gap-1 text-xs">
                          <AlertCircle className="size-3" /> Lỗi đọc file
                        </Badge>
                      )}
                    </TableCell>

                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(item.created_at)}
                    </TableCell>

                    <TableCell className="text-right pr-6">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            sessionStorage.setItem("finai_selected_dataset_id", item.id)
                            navigate({ to: "/" })
                          }}
                          className="size-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/50"
                          title="Phân tích ngay với Trợ lý AI"
                        >
                          <MessageSquareText className="size-4" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setPreviewDataset(item)}
                          className="size-8 text-primary hover:text-primary hover:bg-primary/5 dark:hover:bg-primary/10"
                          title="Xem cấu trúc & dữ liệu mẫu"
                        >
                          <Eye className="size-4" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => window.open(DatasetsService.getDownloadUrl(item.id), "_blank")}
                          className="size-8 text-muted-foreground hover:text-foreground"
                          title="Tải về tệp gốc"
                        >
                          <Download className="size-4" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteDatasetItem(item)}
                          className="size-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          title="Xóa tệp"
                        >
                          <Trash2 className="size-4" />
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

      {/* Upload Dialog */}
      <UploadDatasetDialog
        open={isUploadOpen}
        onOpenChange={setIsUploadOpen}
        onSuccess={fetchDatasets}
      />

      {/* Schema & Sample Data Preview Modal */}
      <DatasetPreviewModal
        dataset={previewDataset}
        open={!!previewDataset}
        onOpenChange={(open) => !open && setPreviewDataset(null)}
        onDatasetUpdated={fetchDatasets}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteDatasetItem} onOpenChange={(open) => !open && setDeleteDatasetItem(null)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-destructive flex items-center gap-2">
              <Trash2 className="size-5" /> Xác Nhận Xóa Tệp
            </DialogTitle>
            <DialogDescription>
              Bạn có chắc chắn muốn xóa tệp <strong>{deleteDatasetItem?.filename}</strong> (phiên bản v{deleteDatasetItem?.version}) khỏi kho dữ liệu? Thao tác này không thể hoàn tác.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setDeleteDatasetItem(null)}
              disabled={isDeleting}
            >
              Hủy
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Đang xóa..." : "Xóa Vĩnh Viễn"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
