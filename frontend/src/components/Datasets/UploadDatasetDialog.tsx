import { useState, useRef } from "react"
import { UploadCloud, FileSpreadsheet, X, AlertCircle } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { LoadingButton } from "@/components/ui/loading-button"
import { DatasetsService } from "@/services/datasetsService"

interface UploadDatasetDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function UploadDatasetDialog({
  open,
  onOpenChange,
  onSuccess,
}: UploadDatasetDialogProps) {
  const [file, setFile] = useState<File | null>(null)
  const [description, setDescription] = useState("")
  const [isUploading, setIsUploading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (selectedFile: File) => {
    const ext = selectedFile.name.split(".").pop()?.toLowerCase()
    if (!["csv", "xlsx", "xls"].includes(ext || "")) {
      toast.error("Định dạng không hợp lệ. Vui lòng chọn tệp .csv, .xlsx hoặc .xls")
      return
    }
    setFile(selectedFile)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0])
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) {
      toast.error("Vui lòng chọn tệp trước khi tải lên")
      return
    }

    try {
      setIsUploading(true)
      const res = await DatasetsService.uploadDataset(file, description)
      toast.success(`Tải lên thành công tệp ${res.filename} (Phiên bản v${res.version})!`)
      setFile(null)
      setDescription("")
      onOpenChange(false)
      onSuccess()
    } catch (err: any) {
      const msg = err.response?.data?.detail || "Không thể tải lên tệp. Vui lòng thử lại."
      toast.error(msg)
    } finally {
      setIsUploading(false)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-semibold">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/5 text-primary dark:bg-primary/10 dark:text-primary">
              <FileSpreadsheet className="size-5" />
            </div>
            Tải Lên Tệp Dữ Liệu Kinh Doanh
          </DialogTitle>
          <DialogDescription>
            Hỗ trợ bảng tính định dạng <strong>.xlsx, .xls, .csv</strong>. Hệ thống sẽ tự động quét số dòng, số cột và phân tích lược đồ dữ liệu.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".csv, .xlsx, .xls"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleFileSelect(e.target.files[0])
              }
            }}
          />

          {!file ? (
            <div
              onDragOver={(e) => {
                e.preventDefault()
                setIsDragging(true)
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-all cursor-pointer ${
                isDragging
                  ? "border-primary/20 bg-primary/5 dark:bg-primary/10"
                  : "border-border hover:border-blue-400 hover:bg-muted/40"
              }`}
            >
              <div className="flex size-14 items-center justify-center rounded-full bg-primary/5 text-primary dark:bg-primary/10 dark:text-primary mb-3 shadow-inner">
                <UploadCloud className="size-7" />
              </div>
              <p className="text-sm font-semibold text-foreground">
                Kéo thả tệp vào đây hoặc <span className="text-primary dark:text-primary underline">duyệt chọn tệp</span>
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Hỗ trợ tệp tối đa 25MB (.csv, .xlsx, .xls)
              </p>
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 p-4 dark:bg-primary/10">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary text-white shadow-sm">
                  <FileSpreadsheet className="size-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground truncate max-w-[300px]">
                    {file.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(file.size)}
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setFile(null)}
                className="size-8 text-muted-foreground hover:text-destructive"
              >
                <X className="size-4" />
              </Button>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="description" className="text-xs font-semibold">
              Mô tả tệp (Tùy chọn)
            </Label>
            <Input
              id="description"
              placeholder="VD: Dữ liệu doanh thu & chi phí chi nhánh miền Bắc Quý 3/2026"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="text-sm"
            />
          </div>

          <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 p-3 text-amber-700 dark:text-amber-400 text-xs">
            <AlertCircle className="size-4 shrink-0" />
            <span>Nếu tải lên tệp trùng tên, hệ thống sẽ tự động tạo phiên bản mới (v2, v3...) để tiện quản lý.</span>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isUploading}
            >
              Hủy
            </Button>
            <LoadingButton
              type="submit"
              loading={isUploading}
              disabled={!file || isUploading}
              className="bg-primary hover:bg-blue-700 text-white"
            >
              Tải Lên Kho Dữ Liệu
            </LoadingButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
