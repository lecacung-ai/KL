import { PageHeading } from "@/components/Common/PageHeading"
import { useState, useEffect, useMemo } from "react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import {
  Plus,
  Search,
  FileSpreadsheet,
  Trash2,
  RefreshCw,
  HardDrive,
  Rows,
  Layers,
  CheckCircle2,
  AlertCircle,
  MessageSquareText,
  MoreHorizontal,
  X,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import { DownloadDatasetButton } from "@/components/Datasets/DownloadDatasetButton"

export const Route = createFileRoute("/_layout/datasets")({
  component: DatasetsPage,
  head: () => ({
    meta: [
      {
        title: "Kho Dữ Liệu - FinAI",
      },
    ],
  }),
})

function DatasetsPage() {
  const navigate = useNavigate()
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [filterType, setFilterType] = useState<"all" | "excel" | "csv">("all")

  // Modals state
  const [isUploadOpen, setIsUploadOpen] = useState(false)
  const [deleteDatasetItem, setDeleteDatasetItem] = useState<Dataset | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const fetchDatasets = async () => {
    try {
      setIsLoading(true)
      const res = await DatasetsService.getDatasets(0, 200)
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

  const filteredDatasets = useMemo(() => {
    return datasets.filter((d) => {
      const matchesSearch =
        d.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (d.description && d.description.toLowerCase().includes(searchQuery.toLowerCase()))

      const matchesType =
        filterType === "all" ||
        (filterType === "csv" && d.file_type === "csv") ||
        (filterType === "excel" && ["xlsx", "xls"].includes(d.file_type))

      return matchesSearch && matchesType
    })
  }, [datasets, searchQuery, filterType])

  // Quick stats
  const totalDatasets = datasets.length
  const totalRows = datasets.reduce((sum, d) => sum + (d.row_count || 0), 0)
  const totalSize = datasets.reduce((sum, d) => sum + (d.size_bytes || 0), 0)

  const isFiltering = searchQuery.trim() !== "" || filterType !== "all"

  return (
    <div className="w-full min-w-0 max-w-full space-y-5 pb-10">
      <PageHeading
        title="Kho dữ liệu"
        description="Quản lý và đồng bộ bảng tính tài chính."
        action={
          <Button onClick={() => setIsUploadOpen(true)} className="gap-1.5 shadow-2xs h-8.5 text-xs">
            <Plus className="size-4" /> Tải tệp lên
          </Button>
        }
      />

      {/* 3 KPI Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 min-w-0">
        <div className="rounded-xl border border-border/80 bg-card p-3 sm:p-4 shadow-2xs flex items-center justify-between min-w-0">
          <div className="space-y-0.5 min-w-0">
            <p className="text-xs text-muted-foreground">Tổng số dataset</p>
            <h3 className="text-lg sm:text-xl font-semibold tracking-tight text-foreground">{totalDatasets} tệp</h3>
          </div>
          <div className="flex size-8.5 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
            <Layers className="size-4" />
          </div>
        </div>

        <div className="rounded-xl border border-border/80 bg-card p-3 sm:p-4 shadow-2xs flex items-center justify-between min-w-0">
          <div className="space-y-0.5 min-w-0">
            <p className="text-xs text-muted-foreground">Tổng số dòng</p>
            <h3 className="text-lg sm:text-xl font-semibold tracking-tight text-foreground">{totalRows.toLocaleString()} dòng</h3>
          </div>
          <div className="flex size-8.5 items-center justify-center rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 shrink-0">
            <Rows className="size-4" />
          </div>
        </div>

        <div className="rounded-xl border border-border/80 bg-card p-3 sm:p-4 shadow-2xs flex items-center justify-between min-w-0">
          <div className="space-y-0.5 min-w-0">
            <p className="text-xs text-muted-foreground">Dung lượng lưu trữ</p>
            <h3 className="text-lg sm:text-xl font-semibold tracking-tight text-foreground">{formatFileSize(totalSize)}</h3>
          </div>
          <div className="flex size-8.5 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
            <HardDrive className="size-4" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 min-w-0">
        <div className="relative flex-1 max-w-sm min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Tìm theo tên tệp..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-8.5 text-xs"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <div className="flex rounded-lg border border-border/80 bg-muted/40 p-0.5">
            <button
              onClick={() => setFilterType("all")}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                filterType === "all"
                  ? "bg-background text-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Tất cả ({datasets.length})
            </button>
            <button
              onClick={() => setFilterType("excel")}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                filterType === "excel"
                  ? "bg-background text-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Excel
            </button>
            <button
              onClick={() => setFilterType("csv")}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                filterType === "csv"
                  ? "bg-background text-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              CSV
            </button>
          </div>

          {isFiltering && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchQuery("")
                setFilterType("all")
              }}
              className="h-8 text-xs text-muted-foreground hover:text-foreground gap-1 px-2"
            >
              <X className="size-3.5" /> Xóa lọc
            </Button>
          )}

          <Button
            variant="outline"
            size="icon"
            onClick={fetchDatasets}
            disabled={isLoading}
            className="size-8.5 shrink-0 shadow-2xs"
            title="Làm mới"
          >
            <RefreshCw className={`size-3.5 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Main Datasets Table - No pagination controls as requested */}
      <div className="w-full min-w-0 max-w-full rounded-xl border border-border/80 bg-card shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow className="border-border/60 hover:bg-transparent">
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Tên dataset</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Phiên bản</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Định dạng</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Kích thước</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Số dòng × cột</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Trạng thái</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Ngày tải</TableHead>
                <TableHead className="text-right font-semibold text-xs uppercase tracking-wider text-muted-foreground pr-4">Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 4 }).map((_, idx) => (
                  <TableRow key={idx}>
                    <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell className="text-right pr-4"><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : filteredDatasets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-40 text-center">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <FileSpreadsheet className="size-6 text-muted-foreground/50" />
                      <p className="text-sm font-medium text-foreground">
                        {isFiltering ? "Không tìm thấy dataset phù hợp" : "Chưa có dataset nào"}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredDatasets.map((item) => {
                  const isExcel = ["xlsx", "xls"].includes(item.file_type)
                  return (
                    <TableRow key={item.id} className="border-border/60 hover:bg-muted/30 transition-colors">
                      <TableCell className="min-w-0 max-w-[240px]">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`flex size-7 shrink-0 items-center justify-center rounded-lg ${
                              isExcel
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                : "bg-primary/10 text-primary"
                            }`}
                          >
                            <FileSpreadsheet className="size-3.5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-xs sm:text-sm text-foreground truncate">
                              {item.filename}
                            </p>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        <Badge variant="outline" className="font-mono text-[10px] bg-muted/40">
                          v{item.version}
                        </Badge>
                      </TableCell>

                      <TableCell>
                        <Badge variant="secondary" className="text-[10px] font-medium">
                          {isExcel ? "Excel" : "CSV"}
                        </Badge>
                      </TableCell>

                      <TableCell className="text-xs font-mono text-muted-foreground whitespace-nowrap">
                        {formatFileSize(item.size_bytes)}
                      </TableCell>

                      <TableCell className="whitespace-nowrap">
                        <span className="text-xs text-muted-foreground">
                          <strong className="text-foreground font-medium">{item.row_count.toLocaleString()}</strong> × <strong className="text-foreground font-medium">{item.column_count}</strong>
                        </span>
                      </TableCell>

                      <TableCell className="whitespace-nowrap">
                        {item.status === "ready" ? (
                          <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 gap-1 font-medium text-[10px]">
                            <CheckCircle2 className="size-3" /> Sẵn sàng
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="gap-1 text-[10px]">
                            <AlertCircle className="size-3" /> Lỗi
                          </Badge>
                        )}
                      </TableCell>

                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(item.created_at)}
                      </TableCell>

                      <TableCell className="text-right pr-4 whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              sessionStorage.setItem("finai_selected_dataset_id", item.id)
                              navigate({ to: "/" })
                            }}
                            className="h-7.5 px-2 text-xs text-primary hover:text-primary hover:bg-primary/10 gap-1 font-medium"
                            title="Mở trong Chat AI"
                          >
                            <MessageSquareText className="size-3.5" />
                            <span>Phân tích</span>
                          </Button>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="size-7.5 text-muted-foreground">
                                <MoreHorizontal className="size-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-36">
                              <div className="px-1 py-0.5">
                                <DownloadDatasetButton dataset={item} />
                              </div>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => setDeleteDatasetItem(item)}
                                className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer text-xs"
                              >
                                <Trash2 className="size-3.5 mr-2" />
                                Xóa dataset
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
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

      {/* Upload Dialog */}
      <UploadDatasetDialog
        open={isUploadOpen}
        onOpenChange={setIsUploadOpen}
        onSuccess={fetchDatasets}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteDatasetItem} onOpenChange={(open) => !open && setDeleteDatasetItem(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold text-destructive flex items-center gap-2">
              <Trash2 className="size-4" /> Xác nhận xóa dataset
            </DialogTitle>
            <DialogDescription className="text-xs leading-relaxed">
              Bạn có chắc chắn muốn xóa tệp <strong>{deleteDatasetItem?.filename}</strong>? Thao tác này không thể hoàn tác.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 mt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteDatasetItem(null)}
              disabled={isDeleting}
            >
              Hủy
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Đang xóa..." : "Xóa vĩnh viễn"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
