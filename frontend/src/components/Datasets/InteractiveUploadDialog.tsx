import { useState, useRef, useEffect, useMemo } from "react"
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Layers,
  Table as TableIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { LoadingButton } from "@/components/ui/loading-button"
import {
  DatasetsService,
  WorkbookInspection,
  SheetInspection,
  InteractiveUploadConfig,
} from "@/services/datasetsService"

export interface SheetStatusState {
  sheetName: string
  skipSheet: boolean
  tableAction: "split_tables" | "merge_tables" // Hỗ trợ gộp & tách bảng trong 1 sheet
}

interface InteractiveUploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  initialFile?: File | null
}

export function InteractiveUploadDialog({
  open,
  onOpenChange,
  onSuccess,
  initialFile,
}: InteractiveUploadDialogProps) {
  const [file, setFile] = useState<File | null>(null)
  const [description, setDescription] = useState("")
  const [isInspecting, setIsInspecting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Inspection data
  const [inspection, setInspection] = useState<WorkbookInspection | null>(null)
  const [selectedSheetName, setSelectedSheetName] = useState<string>("")
  const [sheetStatuses, setSheetStatuses] = useState<Record<string, SheetStatusState>>({})
  
  // Multi-sheet merge action: "split" (tách riêng) | "merge" (gộp các sheet có cùng cấu trúc)
  const [multiSheetAction, setMultiSheetAction] = useState<"split" | "merge">("split")
  
  // Data preview toggle
  const [showPreview, setShowPreview] = useState<boolean>(false)

  // Reset when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setFile(null)
      setDescription("")
      setInspection(null)
      setSelectedSheetName("")
      setSheetStatuses({})
      setMultiSheetAction("split")
      setShowPreview(false)
    } else if (initialFile) {
      handleFileSelect(initialFile)
    }
  }, [open, initialFile])

  // Multi-sheet merge group if detected
  const mergeGroup = useMemo(() => {
    if (!inspection?.mergeable_sheet_groups || inspection.mergeable_sheet_groups.length === 0) {
      return null
    }
    return inspection.mergeable_sheet_groups[0]
  }, [inspection])

  // Active sheet object
  const currentSheet: SheetInspection | null = useMemo(() => {
    if (!inspection || !inspection.sheets || inspection.sheets.length === 0) return null
    return inspection.sheets.find((s) => s.name === selectedSheetName) || inspection.sheets[0]
  }, [inspection, selectedSheetName])

  // Active sheet index
  const activeSheetIndex = useMemo(() => {
    if (!inspection?.sheets || !currentSheet) return 0
    return inspection.sheets.findIndex((s) => s.name === currentSheet.name)
  }, [inspection, currentSheet])

  const isLastSheet = useMemo(() => {
    if (!inspection?.sheets || inspection.sheets.length === 0) return true
    return activeSheetIndex === inspection.sheets.length - 1
  }, [inspection, activeSheetIndex])

  // Initialize sheet statuses when inspection finishes
  useEffect(() => {
    if (inspection && inspection.sheets) {
      const initialMap: Record<string, SheetStatusState> = {}

      inspection.sheets.forEach((s) => {
        initialMap[s.name] = {
          sheetName: s.name,
          skipSheet: false,
          tableAction: "split_tables", // Mặc định: tách các bảng riêng biệt
        }
      })

      setSheetStatuses(initialMap)
      setSelectedSheetName(inspection.sheets[0].name)
      setMultiSheetAction("split")
    }
  }, [inspection])

  // Current sheet status
  const currentStatus: SheetStatusState = useMemo(() => {
    if (!currentSheet) {
      return {
        sheetName: "",
        skipSheet: false,
        tableAction: "split_tables",
      }
    }
    return (
      sheetStatuses[currentSheet.name] || {
        sheetName: currentSheet.name,
        skipSheet: false,
        tableAction: "split_tables",
      }
    )
  }, [sheetStatuses, currentSheet])

  // Update current sheet status
  const updateCurrentStatus = (updates: Partial<SheetStatusState>) => {
    if (!currentSheet) return
    setSheetStatuses((prev) => ({
      ...prev,
      [currentSheet.name]: {
        ...(prev[currentSheet.name] || currentStatus),
        ...updates,
      },
    }))
  }

  // Calculate overall error statistics across sheets
  const stats = useMemo(() => {
    if (!inspection?.sheets) return { totalErrors: 0, invalidSheetsCount: 0, validSheetsCount: 0 }

    let totalErrors = 0
    let invalidSheetsCount = 0
    let validSheetsCount = 0

    inspection.sheets.forEach((s) => {
      const isHeaderMissing = !s.has_header && !s.is_empty
      const isDataMissing = (s.missing_summary?.affected_rows || 0) > 0
      const sheetHasError = isHeaderMissing || isDataMissing

      if (isHeaderMissing) totalErrors++
      if (isDataMissing) totalErrors++

      if (sheetHasError) {
        invalidSheetsCount++
      } else if (!s.is_empty) {
        validSheetsCount++
      }
    })

    return { totalErrors, invalidSheetsCount, validSheetsCount }
  }, [inspection])

  // File Select Handler
  const handleFileSelect = async (selectedFile: File) => {
    const ext = selectedFile.name.split(".").pop()?.toLowerCase()
    if (!["csv", "xlsx", "xls"].includes(ext || "")) {
      toast.error("Định dạng không hợp lệ. Vui lòng chọn tệp .xlsx, .xls hoặc .csv")
      return
    }

    setFile(selectedFile)
    setIsInspecting(true)

    try {
      const res = await DatasetsService.inspectWorkbook(selectedFile)
      setInspection(res)
      toast.success(`Đã quét tệp "${selectedFile.name}".`)
    } catch (err: any) {
      const msg = err.response?.data?.detail || "Không thể phân tích tệp dữ liệu. Vui lòng thử lại."
      toast.error(msg)
      setFile(null)
    } finally {
      setIsInspecting(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0])
    }
  }

  // Next Sheet navigation
  const handleNextSheet = () => {
    if (!inspection?.sheets) return
    if (activeSheetIndex < inspection.sheets.length - 1) {
      setSelectedSheetName(inspection.sheets[activeSheetIndex + 1].name)
    }
  }

  // Submit Handler: Only upload clean sheets, blocking error sheets unless user skipped them
  const handleFinalSubmit = async (uploadOnlyValid: boolean = false) => {
    if (!file || !inspection) {
      toast.error("Chưa chọn tệp dữ liệu.")
      return
    }

    try {
      setIsSaving(true)

      // 1. CASE: USER CHOSE MULTI-SHEET MERGE
      if (multiSheetAction === "merge" && mergeGroup) {
        // Check if sheets to merge have blocking errors
        const errorSheetsInGroup = mergeGroup.sheet_names.filter((name) => {
          const s = inspection.sheets.find((sh) => sh.name === name)
          return !s || !s.has_header || s.missing_summary.affected_rows > 0
        })

        if (errorSheetsInGroup.length > 0 && !uploadOnlyValid) {
          toast.error(
            `Không thể gộp: Các sheet [${errorSheetsInGroup.join(
              ", "
            )}] có lỗi dữ liệu. Vui lòng tự hiệu chỉnh trong file Excel trước khi tải lên!`
          )
          setIsSaving(false)
          return
        }

        const validGroupSheets = mergeGroup.sheet_names.filter((name) => {
          const s = inspection.sheets.find((sh) => sh.name === name)
          return s && s.has_header && s.missing_summary.affected_rows === 0
        })

        if (validGroupSheets.length < 2) {
          toast.error("Không đủ số lượng sheet hợp lệ (không lỗi) để thực hiện gộp.")
          setIsSaving(false)
          return
        }

        const config: InteractiveUploadConfig = {
          multi_sheet_action: "merge",
          sheets_to_merge: validGroupSheets,
          drop_empty_rows: true,
          drop_any_missing_rows: false,
          missing_choice: "keep_raw",
        }

        const res = await DatasetsService.uploadDatasetInteractive(
          file,
          config,
          description || `Gộp các sheet: ${validGroupSheets.join(", ")}`
        )
        toast.success(`Đã gộp thành công ${validGroupSheets.length} sheet thành tệp "${res.filename}"!`)
        onOpenChange(false)
        onSuccess()
        return
      }

      // 2. CASE: PROCESS VALID SHEETS INDIVIDUALLY (SPLIT)
      let count = 0
      for (const s of inspection.sheets) {
        if (s.is_empty) continue
        const status = sheetStatuses[s.name]
        if (status?.skipSheet) continue

        const hasError = !s.has_header || s.missing_summary.affected_rows > 0
        if (hasError) {
          if (!uploadOnlyValid) {
            toast.error(
              `Sheet "${s.name}" có lỗi chưa được sửa trong file Excel. Vui lòng tự hiệu chỉnh hoặc đánh dấu bỏ qua sheet này.`
            )
            setIsSaving(false)
            return
          }
          continue // Skip this error sheet when user chose uploadOnlyValid
        }

        const uploadConfig: InteractiveUploadConfig = {
          selected_sheet: s.name,
          selected_table_id: status?.tableAction === "merge_tables" ? "merge_tables" : undefined,
          header_mode: "detected",
          drop_empty_rows: true,
          drop_any_missing_rows: false,
          missing_choice: "keep_raw",
          allow_no_header: false,
        }

        await DatasetsService.uploadDatasetInteractive(
          file,
          uploadConfig,
          description || `Nhập từ sheet ${s.name}`
        )
        count++
      }

      if (count > 0) {
        toast.success(`Đã tải lên thành công ${count} tập dữ liệu vào kho!`)
        onOpenChange(false)
        onSuccess()
      } else {
        toast.error("Không có sheet nào hợp lệ để tải lên. Vui lòng tự hiệu chỉnh các lỗi trong file Excel.")
      }
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Không thể tải tệp lên. Vui lòng thử lại.")
    } finally {
      setIsSaving(false)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  // Helper flags for active sheet
  const activeSheetHasHeaderError = Boolean(currentSheet && !currentSheet.has_header && !currentSheet.is_empty)
  const activeSheetHasMissingData = Boolean(currentSheet && (currentSheet.missing_summary?.affected_rows || 0) > 0)
  const activeSheetHasAnyError = activeSheetHasHeaderError || activeSheetHasMissingData

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-4xl w-[95vw] sm:w-[90vw] md:w-[85vw] max-h-[88vh] h-[88vh] flex flex-col p-0 gap-0 !overflow-hidden sm:rounded-2xl shadow-2xl bg-card border border-border">
        {/* ============================================================ */}
        {/* VIEW 1: FILE PICKER (CHƯA CHỌN TỆP)                          */}
        {/* ============================================================ */}
        {!file && (
          <div className="p-6 sm:p-8 space-y-6 flex flex-col justify-center my-auto">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold flex items-center gap-2">
                <FileSpreadsheet className="size-5 text-primary" />
                Tải Lên Tệp Dữ Liệu Kinh Doanh
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
                Hệ thống sẽ kiểm tra tính toàn vẹn dữ liệu từng sheet, thông báo các lỗi cần tự hiệu chỉnh trong file Excel và hỗ trợ tùy chọn gộp/tách dữ liệu.
              </DialogDescription>
            </DialogHeader>

            <div
              onDragOver={(e) => {
                e.preventDefault()
                setIsDragging(true)
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3.5 ${
                isDragging
                  ? "border-primary bg-primary/5 scale-[1.01]"
                  : "border-muted-foreground/25 hover:border-primary/60 hover:bg-muted/30"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileSelect(e.target.files[0])
                  }
                }}
              />
              <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-inner">
                <UploadCloud className="size-7" />
              </div>
              <div className="space-y-1">
                <p className="font-semibold text-sm text-foreground">
                  Kéo và thả tệp dữ liệu vào đây, hoặc click để duyệt tệp
                </p>
                <p className="text-xs text-muted-foreground">
                  Tối đa 50MB • Tự động nhận diện cấu trúc, nhiều Sheet & nhiều Bảng
                </p>
              </div>

              <div className="flex gap-2 pt-1">
                <Badge variant="outline" className="text-[11px] font-medium bg-background">
                  .xlsx (Nhiều Sheet)
                </Badge>
                <Badge variant="outline" className="text-[11px] font-medium bg-background">
                  .xls
                </Badge>
                <Badge variant="outline" className="text-[11px] font-medium bg-background">
                  .csv
                </Badge>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* VIEW 2: LOADING / SCANNING                                   */}
        {/* ============================================================ */}
        {file && isInspecting && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-4">
            <div className="size-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
            <div className="text-center space-y-1">
              <p className="font-semibold text-base text-foreground">
                Đang quét cấu trúc tệp "{file.name}"...
              </p>
              <p className="text-xs text-muted-foreground">
                Đang kiểm tra tiêu đề, dòng rỗng và các bảng dữ liệu
              </p>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* VIEW 3: MAIN WORKFLOW                                        */}
        {/* ============================================================ */}
        {file && !isInspecting && inspection && currentSheet && (
          <>
            {/* 1. MODAL HEADER (LOCKED AT TOP) */}
            <div className="shrink-0 flex-shrink-0 px-6 py-4 border-b border-border bg-card flex items-start justify-between">
              <div className="space-y-1 min-w-0 pr-4">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="size-5 text-primary shrink-0" />
                  <h2 className="text-base font-bold text-foreground truncate">
                    {file.name}
                  </h2>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{formatFileSize(file.size)}</span>
                  <span>•</span>
                  <span>{inspection.sheets.length} sheets</span>
                  <span>•</span>
                  {stats.invalidSheetsCount > 0 ? (
                    <span className="text-destructive font-semibold flex items-center gap-1">
                      <AlertCircle className="size-3.5" />
                      {stats.invalidSheetsCount} sheet cần tự hiệu chỉnh trong Excel
                    </span>
                  ) : (
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="size-3.5" />
                      Tất cả sheet hợp lệ
                    </span>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-md transition-colors"
                title="Đóng"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* 2. SHEET NAVIGATION TABS (HORIZONTAL BAR) */}
            <div className="shrink-0 flex-shrink-0 px-6 pt-2 bg-muted/20 border-b border-border flex items-center gap-1 overflow-x-auto no-scrollbar">
              {inspection.sheets.map((s) => {
                const isActive = s.name === currentSheet.name
                const hasHeaderErr = !s.has_header && !s.is_empty
                const hasMissingErr = (s.missing_summary?.affected_rows || 0) > 0
                const hasAnyErr = hasHeaderErr || hasMissingErr
                const isStatusSkipped = sheetStatuses[s.name]?.skipSheet

                return (
                  <button
                    key={s.name}
                    type="button"
                    onClick={() => setSelectedSheetName(s.name)}
                    className={`px-3.5 py-2.5 text-xs sm:text-sm font-medium transition-all border-b-2 flex items-center gap-2 whitespace-nowrap rounded-t-md ${
                      isActive
                        ? "border-primary text-primary font-semibold bg-background shadow-xs"
                        : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40"
                    } ${isStatusSkipped ? "opacity-60 line-through" : ""}`}
                  >
                    {hasAnyErr ? (
                      <span className="size-2 rounded-full bg-destructive shrink-0" title="Cần tự sửa trong Excel" />
                    ) : (
                      <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                    )}
                    <span>{s.name}</span>
                  </button>
                )
              })}
            </div>

            {/* 3. MAIN BODY (SINGLE UNIFIED SCROLLBAR) */}
            <div className="flex-1 overflow-y-auto px-6 sm:px-8 py-6 space-y-6 bg-background">
              {/* SECTION A: THÔNG BÁO TÌNH TRẠNG DỮ LIỆU & HƯỚNG DẪN TỰ HIỆU CHỈNH */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    TÌNH TRẠNG DỮ LIỆU (TỰ HIỆU CHỈNH TRONG EXCEL)
                  </h3>
                  {activeSheetHasAnyError ? (
                    <Badge variant="destructive" className="text-[11px] font-medium">
                      Chưa thể tải lên • Cần hiệu chỉnh file
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-emerald-600 bg-emerald-500/10 border-emerald-200 text-[11px]">
                      <Check className="size-3 mr-1" /> Hợp lệ để tải lên
                    </Badge>
                  )}
                </div>

                {/* 1. Header Validation Notice */}
                {!activeSheetHasHeaderError ? (
                  <div className="flex items-start gap-3 p-3.5 rounded-xl border border-emerald-200/80 dark:border-emerald-900/60 bg-emerald-50/40 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-200">
                    <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <div className="text-xs space-y-0.5">
                      <p className="font-semibold text-sm">Tiêu đề cột hợp lệ</p>
                      <p className="text-muted-foreground">
                        Đã nhận diện đủ {currentSheet.columns.length} tên cột:{" "}
                        <span className="font-mono text-foreground font-medium">
                          {currentSheet.columns.map((c) => c.name).slice(0, 6).join(", ")}
                          {currentSheet.columns.length > 6 ? "..." : ""}
                        </span>
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3 p-4 rounded-xl border border-destructive/40 bg-destructive/5 text-destructive">
                    <AlertCircle className="size-5 shrink-0 mt-0.5 text-destructive" />
                    <div className="space-y-1.5 text-xs">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-sm text-destructive">
                          Thiếu dòng tiêu đề cột (Header)
                        </p>
                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                          Bắt buộc sửa
                        </Badge>
                      </div>
                      <p className="text-foreground/90 leading-relaxed">
                        Bảng tính bắt đầu trực tiếp bằng các hàng số liệu hoặc tiêu đề bị khuyết thiếu. Hệ thống không tự ý gán tên cột mặc định để tránh làm sai lệch ngữ nghĩa số liệu.
                      </p>
                      <p className="font-semibold text-destructive mt-1">
                        📌 Hướng dẫn xử lý: Vui lòng mở file Excel, thêm một dòng tiêu đề ở hàng đầu tiên của sheet "{currentSheet.name}" rồi lưu và tải lại tệp. Nếu không bổ sung, sheet này sẽ không được phép tải lên.
                      </p>
                    </div>
                  </div>
                )}

                {/* 2. Missing Data Validation Notice */}
                {!activeSheetHasMissingData ? (
                  <div className="flex items-start gap-3 p-3.5 rounded-xl border border-emerald-200/80 dark:border-emerald-900/60 bg-emerald-50/40 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-200">
                    <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <div className="text-xs space-y-0.5">
                      <p className="font-semibold text-sm">Dữ liệu đầy đủ và nguyên vẹn</p>
                      <p className="text-muted-foreground">
                        Không phát hiện ô trống hoặc dòng rỗng nào trong sheet này.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3 p-4 rounded-xl border border-destructive/40 bg-destructive/5 text-destructive">
                    <AlertCircle className="size-5 shrink-0 mt-0.5 text-destructive" />
                    <div className="space-y-2 text-xs w-full">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-sm text-destructive">
                            Phát hiện {currentSheet.missing_summary.affected_rows} dòng chứa dữ liệu rỗng
                          </p>
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                            Bắt buộc sửa
                          </Badge>
                        </div>
                        <span className="font-mono text-[11px] text-muted-foreground">
                          {currentSheet.missing_summary.total_missing} ô trống
                        </span>
                      </div>

                      <p className="text-foreground/90 leading-relaxed">
                        Các cột bị khuyết thiếu:{" "}
                        <strong className="text-destructive font-semibold">
                          {currentSheet.missing_summary.columns_with_missing.map((c) => c.name).join(", ")}
                        </strong>.
                      </p>
                      <p className="font-semibold text-destructive">
                        📌 Hướng dẫn xử lý: Vui lòng mở file Excel, tự điền dữ liệu bổ sung vào các ô thiếu hoặc xóa hẳn các dòng trống này rồi lưu và tải lại tệp. Nếu không hiệu chỉnh, sheet này sẽ không được phép tải lên.
                      </p>

                      {/* Detailed table of missing cells to guide user in Excel */}
                      {currentSheet.missing_cells && currentSheet.missing_cells.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-destructive/20 space-y-1.5">
                          <p className="text-[11px] font-semibold text-foreground">
                            Vị trí cụ thể các ô cần hiệu chỉnh trong Excel:
                          </p>
                          <div className="max-h-40 overflow-y-auto rounded-lg border border-border bg-background p-1">
                            <table className="w-full text-left text-[11px]">
                              <thead>
                                <tr className="border-b text-muted-foreground">
                                  <th className="py-1 px-2 font-medium">Vị trí dòng</th>
                                  <th className="py-1 px-2 font-medium">Cột bị trống</th>
                                  <th className="py-1 px-2 font-medium">Ngữ cảnh dòng</th>
                                </tr>
                              </thead>
                              <tbody>
                                {currentSheet.missing_cells.slice(0, 15).map((mc, mIdx) => (
                                  <tr key={mIdx} className="border-b last:border-0 hover:bg-muted/30">
                                    <td className="py-1 px-2 font-mono text-destructive font-semibold">
                                      Dòng {mc.row_index + (typeof currentSheet.header_row_index === "number" ? currentSheet.header_row_index + 2 : 1)}
                                    </td>
                                    <td className="py-1 px-2 font-medium text-foreground">
                                      {mc.column_name}
                                    </td>
                                    <td className="py-1 px-2 text-muted-foreground font-mono truncate max-w-[240px]">
                                      {Object.entries(mc.row_context || {}).map(([k, v]) => `${k}: ${v}`).join(", ") || "(dòng trống)"}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            {currentSheet.missing_cells.length > 15 && (
                              <p className="text-[10px] text-muted-foreground text-center py-1 font-medium">
                                ... và còn {currentSheet.missing_cells.length - 15} ô trống khác
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <hr className="border-border/60" />

              {/* SECTION B: HỖ TRỢ GỘP VÀ TÁCH (TÍNH NĂNG XỬ LÝ DUY NHẤT) */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  HỖ TRỢ GỘP VÀ TÁCH DỮ LIỆU
                </h3>

                <div className="space-y-3">
                  {/* Case 1: Multi-sheet mergeable group */}
                  {mergeGroup && (
                    <div className="p-4 rounded-xl border border-border bg-muted/10 space-y-3">
                      <div className="flex items-center gap-2">
                        <Layers className="size-4 text-primary" />
                        <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                          Gộp & Tách Các Sheet Cùng Cấu Trúc
                        </h4>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Phát hiện <strong>{mergeGroup.sheet_names.length} sheet</strong> có cùng cấu trúc ({mergeGroup.column_count} cột):{" "}
                        <span className="font-mono text-foreground font-medium">
                          {mergeGroup.sheet_names.join(", ")}
                        </span>.
                      </p>

                      <div className="space-y-2 pt-1">
                        {/* Option: Split */}
                        <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          multiSheetAction === "split"
                            ? "border-primary/60 bg-primary/5"
                            : "border-border hover:bg-muted/40"
                        }`}>
                          <input
                            type="radio"
                            name="multi_sheet_action"
                            checked={multiSheetAction === "split"}
                            onChange={() => setMultiSheetAction("split")}
                            className="mt-0.5 size-4 accent-primary"
                          />
                          <div className="text-xs leading-snug">
                            <span className="font-semibold text-foreground">
                              Tách riêng (Lưu mỗi sheet thành một tập dữ liệu độc lập)
                            </span>
                            <span className="text-muted-foreground ml-1.5">(Mặc định an toàn)</span>
                          </div>
                        </label>

                        {/* Option: Merge */}
                        <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          multiSheetAction === "merge"
                            ? "border-primary/60 bg-primary/5"
                            : "border-border hover:bg-muted/40"
                        }`}>
                          <input
                            type="radio"
                            name="multi_sheet_action"
                            checked={multiSheetAction === "merge"}
                            onChange={() => setMultiSheetAction("merge")}
                            className="mt-0.5 size-4 accent-primary"
                          />
                          <div className="text-xs leading-snug">
                            <span className="font-semibold text-foreground">
                              Gộp các sheet lại thành một tập dữ liệu duy nhất
                            </span>
                            <span className="text-muted-foreground ml-1.5">
                              (Tự động gộp dữ liệu và đánh dấu nguồn gốc từng sheet)
                            </span>
                          </div>
                        </label>
                      </div>
                    </div>
                  )}

                  {/* Case 2: Multi-table inside current sheet */}
                  {currentSheet.is_multi_table && (
                    <div className="p-4 rounded-xl border border-border bg-muted/10 space-y-3">
                      <div className="flex items-center gap-2">
                        <TableIcon className="size-4 text-primary" />
                        <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                          Gộp & Tách Các Bảng Trong Sheet Này
                        </h4>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Sheet "{currentSheet.name}" chứa <strong>{currentSheet.table_regions.length} bảng dữ liệu riêng biệt</strong>.
                      </p>

                      <div className="space-y-2 pt-1">
                        {/* Option: Split tables */}
                        <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          currentStatus.tableAction === "split_tables"
                            ? "border-primary/60 bg-primary/5"
                            : "border-border hover:bg-muted/40"
                        }`}>
                          <input
                            type="radio"
                            name={`table_action_${currentSheet.name}`}
                            checked={currentStatus.tableAction === "split_tables"}
                            onChange={() => updateCurrentStatus({ tableAction: "split_tables" })}
                            className="mt-0.5 size-4 accent-primary"
                          />
                          <div className="text-xs leading-snug">
                            <span className="font-semibold text-foreground">
                              Tách thành các tập dữ liệu riêng biệt
                            </span>
                            <span className="text-muted-foreground ml-1.5">
                              (Khuyến nghị: Mỗi bảng lưu thành một tệp dữ liệu độc lập)
                            </span>
                          </div>
                        </label>

                        {/* Option: Merge tables */}
                        <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          currentStatus.tableAction === "merge_tables"
                            ? "border-primary/60 bg-primary/5"
                            : "border-border hover:bg-muted/40"
                        }`}>
                          <input
                            type="radio"
                            name={`table_action_${currentSheet.name}`}
                            checked={currentStatus.tableAction === "merge_tables"}
                            onChange={() => updateCurrentStatus({ tableAction: "merge_tables" })}
                            className="mt-0.5 size-4 accent-primary"
                          />
                          <div className="text-xs leading-snug">
                            <span className="font-semibold text-foreground">
                              Gộp {currentSheet.table_regions.length} bảng này lại thành một tập dữ liệu chung
                            </span>
                          </div>
                        </label>
                      </div>
                    </div>
                  )}

                  {/* Case 3: Skip sheet option */}
                  <label className="flex items-start gap-3 p-3.5 rounded-xl border border-dashed border-border/80 hover:bg-muted/20 cursor-pointer transition-colors">
                    <Checkbox
                      checked={currentStatus.skipSheet}
                      onCheckedChange={(checked) =>
                        updateCurrentStatus({ skipSheet: Boolean(checked) })
                      }
                      className="mt-0.5"
                    />
                    <div className="text-xs space-y-0.5">
                      <p className="font-medium text-foreground">
                        Bỏ qua sheet "{currentSheet.name}"
                      </p>
                      <p className="text-muted-foreground">
                        Không lưu sheet này vào kho dữ liệu khi tải lên.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* SECTION C: COLLAPSIBLE SAMPLE PREVIEW */}
              {currentSheet.sample_data && currentSheet.sample_data.length > 0 && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setShowPreview(!showPreview)}
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 font-medium transition-colors"
                  >
                    <TableIcon className="size-3.5" />
                    {showPreview ? "Thu gọn xem trước dữ liệu" : "Xem trước dữ liệu mẫu (15 dòng đầu)"}
                    {showPreview ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                  </button>

                  {showPreview && (
                    <div className="mt-2.5 rounded-xl border border-border overflow-x-auto max-h-56">
                      <Table className="text-xs">
                        <TableHeader className="bg-muted/50">
                          <TableRow>
                            {currentSheet.columns.map((col, idx) => (
                              <TableHead key={idx} className="font-semibold text-foreground px-3 py-2 whitespace-nowrap">
                                {col.name}
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {currentSheet.sample_data.slice(0, 10).map((row, rIdx) => (
                            <TableRow key={rIdx} className="hover:bg-muted/20">
                              {currentSheet.columns.map((col, cIdx) => (
                                <TableCell key={cIdx} className="px-3 py-1.5 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                                  {String(row[col.name] ?? "")}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 4. MODAL FOOTER (LOCKED AT BOTTOM) */}
            <div className="shrink-0 flex-shrink-0 px-6 py-4 border-t border-border bg-card flex items-center justify-between">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                className="text-muted-foreground hover:text-foreground font-medium"
              >
                Hủy
              </Button>

              <div className="flex items-center gap-3">
                {!isLastSheet ? (
                  <>
                    {stats.invalidSheetsCount > 0 && stats.validSheetsCount > 0 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleFinalSubmit(true)}
                        disabled={isSaving}
                        className="text-xs text-muted-foreground hover:text-foreground hidden sm:inline-flex"
                      >
                        Chỉ tải lên {stats.validSheetsCount} sheet hợp lệ
                      </Button>
                    )}
                    <LoadingButton
                      type="button"
                      variant="default"
                      onClick={handleNextSheet}
                      loading={isSaving}
                      className="font-medium"
                    >
                      Tiếp tục với sheet sau →
                    </LoadingButton>
                  </>
                ) : (
                  <>
                    {stats.invalidSheetsCount > 0 ? (
                      <div className="flex items-center gap-2">
                        {stats.validSheetsCount > 0 ? (
                          <LoadingButton
                            type="button"
                            variant="default"
                            onClick={() => handleFinalSubmit(true)}
                            loading={isSaving}
                            className="font-medium"
                          >
                            <Check className="size-4 mr-1.5" />
                            Tải lên {stats.validSheetsCount} sheet hợp lệ
                          </LoadingButton>
                        ) : (
                          <Button
                            type="button"
                            variant="secondary"
                            disabled
                            className="font-medium cursor-not-allowed opacity-80"
                          >
                            <AlertCircle className="size-4 mr-1.5 text-destructive" />
                            Cần tự sửa lỗi trong Excel để tải lên
                          </Button>
                        )}
                      </div>
                    ) : (
                      <LoadingButton
                        type="button"
                        variant="default"
                        onClick={() => handleFinalSubmit(false)}
                        loading={isSaving}
                        className="font-medium"
                      >
                        <Check className="size-4 mr-1.5" />
                        Hoàn tất & Tải lên ({inspection.sheets.length} Sheet)
                      </LoadingButton>
                    )}
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
