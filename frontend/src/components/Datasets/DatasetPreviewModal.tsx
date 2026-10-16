import { useState, useEffect } from "react"
import { useNavigate } from "@tanstack/react-router"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  FileSpreadsheet,
  Download,
  Calendar,
  Rows,
  HardDrive,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Info,
  ShieldCheck,
  Copy,
  Wand2,
  BrainCircuit,
} from "lucide-react"
import { Dataset, DatasetColumnMeta, DatasetQualityProfile, DatasetsService } from "@/services/datasetsService"

interface DatasetPreviewModalProps {
  dataset: Dataset | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onDatasetUpdated?: (updated: Dataset) => void
}

export function DatasetPreviewModal({
  dataset,
  open,
  onOpenChange,
  onDatasetUpdated,
}: DatasetPreviewModalProps) {
  const navigate = useNavigate()
  const [currentDataset, setCurrentDataset] = useState<Dataset | null>(dataset)
  const [isCleaning, setIsCleaning] = useState(false)

  useEffect(() => {
    setCurrentDataset(dataset)
  }, [dataset])

  if (!currentDataset) return null

  let schemaColumns: DatasetColumnMeta[] = []
  let qualityProfile: DatasetQualityProfile | null = null

  try {
    if (currentDataset.schema_info) {
      const parsed = JSON.parse(currentDataset.schema_info)
      if (parsed.columns && Array.isArray(parsed.columns)) {
        qualityProfile = parsed
        schemaColumns = parsed.columns
      } else if (Array.isArray(parsed)) {
        schemaColumns = parsed
      }
    }
  } catch {
    schemaColumns = []
  }

  let sampleRows: Record<string, any>[] = []
  try {
    if (currentDataset.sample_data) {
      sampleRows = JSON.parse(currentDataset.sample_data)
    }
  } catch {
    sampleRows = []
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString("vi-VN")
    } catch {
      return dateStr
    }
  }

  const totalMissing = qualityProfile?.total_missing_cells ?? schemaColumns.reduce((sum, col) => sum + (col.missing_count || 0), 0)
  const duplicateRows = qualityProfile?.duplicate_rows ?? 0
  const healthScore = qualityProfile?.health_score ?? (totalMissing === 0 ? 100 : Math.max(60, 100 - totalMissing * 2))
  const recommendations = qualityProfile?.recommendations ?? (
    totalMissing === 0
      ? ["Dữ liệu đầy đủ và hợp lệ, sẵn sàng để phân tích."]
      : [`Phát hiện ${totalMissing} giá trị bị trống, cần lưu ý khi áp dụng mô hình thống kê.`]
  )

  const handleAutoClean = async () => {
    try {
      setIsCleaning(true)
      const updated = await DatasetsService.cleanDataset(currentDataset.id)
      setCurrentDataset(updated)
      onDatasetUpdated?.(updated)
      toast.success("Đã làm sạch dữ liệu thành công! Loại bỏ trùng lặp và bù đắp các ô trống.")
    } catch {
      toast.error("Không thể tự động làm sạch dữ liệu")
    } finally {
      setIsCleaning(false)
    }
  }

  const handleStartAnalysis = () => {
    onOpenChange(false)
    // Lưu ID tệp được chọn vào sessionStorage để DataAnalyzer tự động tải
    sessionStorage.setItem("finai_selected_dataset_id", currentDataset.id)
    navigate({ to: "/" })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-6">
        <DialogHeader className="pb-3 border-b">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400 shadow-sm">
                <FileSpreadsheet className="size-6" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold flex items-center gap-2">
                  <span>{currentDataset.filename}</span>
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300">
                    v{currentDataset.version}
                  </Badge>
                  {currentDataset.status === "ready" ? (
                    <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 gap-1 font-medium">
                      <CheckCircle2 className="size-3" /> Hợp lệ
                    </Badge>
                  ) : (
                    <Badge variant="destructive" className="gap-1">
                      <AlertTriangle className="size-3" /> Lỗi đọc file
                    </Badge>
                  )}
                </DialogTitle>
                <p className="text-xs text-muted-foreground flex flex-wrap items-center gap-3 mt-1">
                  <span className="flex items-center gap-1">
                    <Calendar className="size-3.5" /> {formatDate(currentDataset.created_at)}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <HardDrive className="size-3.5" /> {formatFileSize(currentDataset.size_bytes)}
                  </span>
                  <span>•</span>
                  <span>{currentDataset.description || "Tệp dữ liệu phân tích kinh doanh"}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="default"
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5 h-9 font-semibold shadow-sm"
                onClick={handleStartAnalysis}
              >
                <BrainCircuit className="size-4" /> Phân Tích Với AI
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 h-9 font-medium"
                onClick={() => window.open(DatasetsService.getDownloadUrl(currentDataset.id), "_blank")}
              >
                <Download className="size-4" /> Tải Tệp Gốc
              </Button>
            </div>
          </div>

          {/* Quick Quality Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
            {/* Health Score */}
            <div className="flex items-center gap-3 rounded-xl border bg-muted/20 p-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
                <ShieldCheck className="size-5" />
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground font-medium">Độ Sạch Dữ Liệu</p>
                <p className="text-base font-black text-emerald-600 dark:text-emerald-400">{healthScore}%</p>
              </div>
            </div>

            {/* Total Rows */}
            <div className="flex items-center gap-3 rounded-xl border bg-muted/20 p-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                <Rows className="size-5" />
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground font-medium">Quy Mô Dòng</p>
                <p className="text-base font-black text-foreground">{currentDataset.row_count.toLocaleString()}</p>
              </div>
            </div>

            {/* Missing Values */}
            <div className="flex items-center gap-3 rounded-xl border bg-muted/20 p-3">
              <div className={`flex size-9 items-center justify-center rounded-lg ${totalMissing > 0 ? "bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400" : "bg-muted text-muted-foreground"}`}>
                <AlertTriangle className="size-5" />
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground font-medium">Ô Thiếu Dữ Liệu</p>
                <p className="text-base font-black text-foreground">
                  {totalMissing} <span className="text-xs font-normal text-muted-foreground">ô</span>
                </p>
              </div>
            </div>

            {/* Duplicates */}
            <div className="flex items-center gap-3 rounded-xl border bg-muted/20 p-3">
              <div className={`flex size-9 items-center justify-center rounded-lg ${duplicateRows > 0 ? "bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-400" : "bg-muted text-muted-foreground"}`}>
                <Copy className="size-5" />
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground font-medium">Dòng Trùng Lặp</p>
                <p className="text-base font-black text-foreground">
                  {duplicateRows} <span className="text-xs font-normal text-muted-foreground">dòng</span>
                </p>
              </div>
            </div>
          </div>

          {/* Alert box if data has missing values or duplicates */}
          {(totalMissing > 0 || duplicateRows > 0) && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border border-amber-200 bg-amber-50/70 text-amber-900 dark:bg-amber-950/40 dark:border-amber-900/50 dark:text-amber-300">
              <div className="flex items-center gap-2.5 text-xs">
                <AlertTriangle className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <span>
                  Phát hiện {totalMissing > 0 ? `${totalMissing} ô bị khuyết thiếu` : ""}
                  {totalMissing > 0 && duplicateRows > 0 ? " và " : ""}
                  {duplicateRows > 0 ? `${duplicateRows} dòng bị trùng lặp` : ""}. Bạn có thể bấm để hệ thống tự động làm sạch.
                </span>
              </div>
              <Button
                size="sm"
                onClick={handleAutoClean}
                disabled={isCleaning}
                className="bg-amber-600 hover:bg-amber-700 text-white text-xs h-7 px-3 font-semibold gap-1.5 shadow-sm shrink-0"
              >
                <Wand2 className="size-3.5" />
                {isCleaning ? "Đang xử lý..." : "Làm Sạch Dữ Liệu Tự Động"}
              </Button>
            </div>
          )}
        </DialogHeader>

        <Tabs defaultValue="schema" className="flex-1 flex flex-col mt-4 min-h-0">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="schema" className="text-xs font-semibold">
              Lược Đồ Cột ({schemaColumns.length})
            </TabsTrigger>
            <TabsTrigger value="insights" className="text-xs font-semibold">
              Khuyến Nghị Làm Sạch ({recommendations.length})
            </TabsTrigger>
            <TabsTrigger value="preview" className="text-xs font-semibold">
              Xem Dữ Liệu Mẫu
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Lược đồ dữ liệu chi tiết */}
          <TabsContent value="schema" className="flex-1 overflow-auto mt-3 border rounded-xl">
            <Table>
              <TableHeader className="bg-muted/50 sticky top-0">
                <TableRow>
                  <TableHead className="w-12 text-center font-bold">#</TableHead>
                  <TableHead className="font-bold">Tên Cột</TableHead>
                  <TableHead className="font-bold">Phân Loại</TableHead>
                  <TableHead className="font-bold">Kiểu Dữ Liệu</TableHead>
                  <TableHead className="font-bold">Giá Trị Duy Nhất</TableHead>
                  <TableHead className="font-bold">Ô Trống (Missing)</TableHead>
                  <TableHead className="font-bold">Thống Kê Cơ Bản (Min / Max / Mean)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schemaColumns.length > 0 ? (
                  schemaColumns.map((col, index) => (
                    <TableRow key={col.name || index}>
                      <TableCell className="text-center text-xs text-muted-foreground font-mono">
                        {index + 1}
                      </TableCell>
                      <TableCell className="font-semibold text-foreground text-xs">
                        {col.name}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-[11px] font-medium">
                          {col.type_category || "Dữ liệu"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-[11px] bg-muted/30">
                          {col.dtype}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs font-mono">
                        {col.unique_count !== undefined ? col.unique_count : "-"}
                      </TableCell>
                      <TableCell>
                        {col.missing_count > 0 ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-amber-600 dark:text-amber-400 font-bold text-xs">
                              {col.missing_count}
                            </span>
                            <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 text-[10px]">
                              {col.missing_percentage}%
                            </Badge>
                          </div>
                        ) : (
                          <span className="text-emerald-600 dark:text-emerald-400 text-xs font-medium">
                            0% (Đầy đủ)
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">
                        {col.min !== undefined && col.max !== undefined ? (
                          <span>Min: {col.min} | Max: {col.max} | TB: {col.mean}</span>
                        ) : (
                          <span className="italic text-[11px]">Không áp dụng</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-6 text-muted-foreground text-sm">
                      Chưa có thông tin lược đồ
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TabsContent>

          {/* Tab 2: Khuyến nghị & Kiểm định cấu trúc dữ liệu */}
          <TabsContent value="insights" className="flex-1 overflow-auto mt-3 border rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="size-5 text-blue-600 dark:text-blue-400" />
                <h3 className="font-bold text-sm text-foreground">
                  Đánh Giá Cấu Trúc & Khuyến Nghị Chuẩn Hóa
                </h3>
              </div>
              {healthScore === 100 && (
                <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 gap-1 text-xs">
                  <CheckCircle2 className="size-3" /> Đạt Tiêu Chuẩn 100%
                </Badge>
              )}
            </div>

            <div className="space-y-2.5">
              {recommendations.map((rec, rIdx) => (
                <div
                  key={rIdx}
                  className="flex items-start gap-3 p-3.5 rounded-xl border bg-card text-xs leading-relaxed"
                >
                  <Info className="size-4.5 text-blue-500 shrink-0 mt-0.5" />
                  <p className="text-foreground">{rec}</p>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* Tab 3: Xem trước 10 dòng đầu dữ liệu */}
          <TabsContent value="preview" className="flex-1 overflow-auto mt-3 border rounded-xl">
            {sampleRows.length > 0 ? (
              <Table>
                <TableHeader className="bg-muted/50 sticky top-0">
                  <TableRow>
                    <TableHead className="w-12 text-center font-bold">#</TableHead>
                    {schemaColumns.map((col) => (
                      <TableHead key={col.name} className="font-bold whitespace-nowrap text-xs">
                        {col.name}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sampleRows.map((row, rIdx) => (
                    <TableRow key={rIdx}>
                      <TableCell className="text-center text-xs text-muted-foreground font-mono">
                        {rIdx + 1}
                      </TableCell>
                      {schemaColumns.map((col) => (
                        <TableCell key={col.name} className="whitespace-nowrap text-xs">
                          {row[col.name] !== undefined && row[col.name] !== null && row[col.name] !== "" ? (
                            String(row[col.name])
                          ) : (
                            <span className="text-muted-foreground/50 italic text-[11px]">null</span>
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
                Không có dữ liệu xem trước
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
