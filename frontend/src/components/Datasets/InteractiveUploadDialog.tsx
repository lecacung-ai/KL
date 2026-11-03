import { useState, useRef, useEffect, useMemo } from "react"
import {
  UploadCloud,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  Layers,
  Table as TableIcon,
  Wand2,
  RotateCcw,
  Check,
  ChevronRight,
  ArrowRight,
  ArrowLeft,
  Type,
  Edit3,
  ShieldCheck,
  AlertCircle,
  FileCheck,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
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

export type UploadWorkflowStep = "upload" | "detect_report" | "fixing" | "completed"

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

  // 4-Stage Workflow: Tải lên -> Phát hiện lỗi -> Sửa lỗi -> Hoàn thành & Cho phép tải lên
  const [currentStep, setCurrentStep] = useState<UploadWorkflowStep>("upload")

  // Inspection result
  const [inspection, setInspection] = useState<WorkbookInspection | null>(null)
  const [selectedSheetName, setSelectedSheetName] = useState<string>("")
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null)

  // Interactive configurations
  const [headerMode, setHeaderMode] = useState<"detected" | "custom_row" | "custom_names" | "no_header">("detected")
  const [customHeaderRow, setCustomHeaderRow] = useState<number | null>(null)
  const [columnRenames, setColumnRenames] = useState<Record<string, string>>({})
  const [cellFixes, setCellFixes] = useState<Record<string, any>>({}) // key: `${row}_${col}`
  const [columnFills, setColumnFills] = useState<Record<string, any>>({}) // key: col, val: 'mean'|'median'|...
  const [dropEmptyRows, setDropEmptyRows] = useState(true)
  const [dropAnyMissingRows, setDropAnyMissingRows] = useState(false)

  // Fixing sub-tab
  const [fixSubTab, setFixSubTab] = useState<"headers" | "cleaning">("headers")

  // Reset when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setFile(null)
      setDescription("")
      setInspection(null)
      setSelectedSheetName("")
      setSelectedTableId(null)
      setColumnRenames({})
      setCellFixes({})
      setColumnFills({})
      setHeaderMode("detected")
      setCustomHeaderRow(null)
      setDropEmptyRows(true)
      setDropAnyMissingRows(false)
      setCurrentStep("upload")
      setFixSubTab("headers")
    } else if (initialFile) {
      handleFileSelect(initialFile)
    }
  }, [open, initialFile])

  // Get active sheet object
  const currentSheet: SheetInspection | null = useMemo(() => {
    if (!inspection || !inspection.sheets || inspection.sheets.length === 0) return null
    return inspection.sheets.find((s) => s.name === selectedSheetName) || inspection.sheets[0]
  }, [inspection, selectedSheetName])

  // When sheet changes, initialize header mode & sub-table
  useEffect(() => {
    if (currentSheet) {
      if (!currentSheet.has_header) {
        setHeaderMode("no_header")
      } else {
        setHeaderMode("detected")
      }
      if (currentSheet.is_multi_table && currentSheet.table_regions.length > 0) {
        setSelectedTableId(currentSheet.table_regions[0].table_id)
      } else {
        setSelectedTableId(null)
      }
      setColumnRenames({})
      setCellFixes({})
      setColumnFills({})
    }
  }, [currentSheet?.name])

  // Step 1: Handle File Selection & Fast Diagnostic Scan
  const handleFileSelect = async (selectedFile: File) => {
    const ext = selectedFile.name.split(".").pop()?.toLowerCase()
    if (!["csv", "xlsx", "xls"].includes(ext || "")) {
      toast.error("Định dạng không hợp lệ. Vui lòng chọn tệp .csv, .xlsx hoặc .xls")
      return
    }

    setFile(selectedFile)
    setIsInspecting(true)

    try {
      const res = await DatasetsService.inspectWorkbook(selectedFile)
      setInspection(res)
      if (res.sheets && res.sheets.length > 0) {
        setSelectedSheetName(res.sheets[0].name)
      }
      // Move to Step 2: Diagnostic & Error Detection Report
      setCurrentStep("detect_report")
      toast.success(`Đã quét xong tệp "${selectedFile.name}". Hãy xem báo cáo lỗi phát hiện!`)
    } catch (err: any) {
      const msg = err.response?.data?.detail || "Không thể phân tích tệp dữ liệu. Vui lòng thử lại."
      toast.error(msg)
      setFile(null)
      setCurrentStep("upload")
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

  // Handle smart column suggestion click
  const applyColumnSuggestion = (oldColName: string, suggestedName: string) => {
    setColumnRenames((prev) => ({
      ...prev,
      [oldColName]: suggestedName,
    }))
    toast.success(`Đã đổi tên cột "${oldColName}" thành "${suggestedName}"`)
  }

  // Handle cell inline correction
  const handleCellEdit = (rowIdx: number, colName: string, value: string) => {
    const key = `${rowIdx}_${colName}`
    setCellFixes((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

  // Apply batch column fill
  const applyColumnFill = (colName: string, strategy: string, displayLabel: string) => {
    setColumnFills((prev) => ({
      ...prev,
      [colName]: strategy,
    }))
    toast.success(`Đã thiết lập điền "${displayLabel}" cho cột ${colName}`)
  }

  // Calculate remaining missing count considering applied fills & fixes
  const remainingMissingCount = useMemo(() => {
    if (!currentSheet) return 0
    let count = 0
    for (const cell of currentSheet.missing_cells) {
      const fixKey = `${cell.row_index}_${cell.column_name}`
      const hasDirectFix = cellFixes[fixKey] !== undefined && cellFixes[fixKey] !== ""
      const hasColumnFill = columnFills[cell.column_name] !== undefined
      if (!hasDirectFix && !hasColumnFill) {
        count++
      }
    }
    return count
  }, [currentSheet, cellFixes, columnFills])

  // Count detected issues in current sheet
  const sheetIssuesSummary = useMemo(() => {
    if (!currentSheet) return { totalIssues: 0, missingCells: 0, hasHeaderIssue: false, isMultiTable: false, isMultiSheet: false }
    const missingCells = currentSheet.missing_summary.total_missing
    const hasHeaderIssue = !currentSheet.has_header
    const isMultiTable = currentSheet.is_multi_table
    const isMultiSheet = (inspection?.total_sheets || 0) > 1

    let totalIssues = 0
    if (missingCells > 0) totalIssues++
    if (hasHeaderIssue) totalIssues++
    if (isMultiTable) totalIssues++
    if (isMultiSheet) totalIssues++

    return { totalIssues, missingCells, hasHeaderIssue, isMultiTable, isMultiSheet }
  }, [currentSheet, inspection])

  // Step 4: Final Submit & Upload Cleaned Dataset
  const handleSaveDataset = async () => {
    if (!file || !currentSheet) {
      toast.error("Vui lòng chọn tệp và cấu hình trước khi lưu.")
      return
    }

    try {
      setIsSaving(true)

      const fixesArray = Object.entries(cellFixes).map(([key, val]) => {
        const parts = key.split("_")
        const row = parseInt(parts[0], 10)
        const col = parts.slice(1).join("_")
        return { row, col, value: val }
      })

      const config: InteractiveUploadConfig = {
        selected_sheet: currentSheet.name,
        selected_table_id: selectedTableId,
        header_mode: headerMode,
        header_row_index: customHeaderRow,
        column_renames: columnRenames,
        cell_fixes: fixesArray,
        column_fills: columnFills,
        drop_empty_rows: dropEmptyRows,
        drop_any_missing_rows: dropAnyMissingRows,
      }

      const res = await DatasetsService.uploadDatasetInteractive(
        file,
        config,
        description || `Nhập từ ${currentSheet.name} (${file.name})`
      )

      toast.success(`Hoàn thành xuất sắc! Đã tải lên tệp "${res.filename}" (v${res.version}) sạch 100%!`)
      onOpenChange(false)
      onSuccess()
    } catch (err: any) {
      const msg = err.response?.data?.detail || "Không thể lưu tệp dữ liệu đã chuẩn hóa."
      toast.error(msg)
    } finally {
      setIsSaving(false)
    }
  }

  // Upload original without remediation (bypass)
  const handleUploadOriginal = async () => {
    if (!file) return
    try {
      setIsSaving(true)
      const res = await DatasetsService.uploadDataset(file, description)
      toast.success(`Đã tải lên tệp gốc "${res.filename}"!`)
      onOpenChange(false)
      onSuccess()
    } catch (err: any) {
      const msg = err.response?.data?.detail || "Không thể tải lên tệp."
      toast.error(msg)
    } finally {
      setIsSaving(false)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={
          currentStep !== "upload"
            ? "max-w-5xl w-full h-[90vh] flex flex-col p-0 gap-0 overflow-hidden"
            : "sm:max-w-[540px]"
        }
      >
        {/* WORKFLOW PROGRESS STEPPER (When a file is loaded) */}
        {inspection && (
          <div className="border-b bg-muted/40 px-6 py-2.5 flex items-center justify-between text-xs shrink-0">
            <div className="flex items-center gap-1.5 md:gap-3">
              <span className="font-semibold text-foreground flex items-center gap-1">
                <FileSpreadsheet className="size-4 text-emerald-600" /> Luồng Xử Lý:
              </span>

              {/* Step 1 Pill */}
              <div className="flex items-center gap-1 text-muted-foreground">
                <span className="flex size-4.5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-600 text-[10px] font-bold">
                  ✓
                </span>
                <span>1. Tải Lên</span>
                <ChevronRight className="size-3 text-muted-foreground" />
              </div>

              {/* Step 2 Pill */}
              <button
                type="button"
                onClick={() => setCurrentStep("detect_report")}
                className={`flex items-center gap-1 transition-colors ${
                  currentStep === "detect_report"
                    ? "font-bold text-amber-600 dark:text-amber-400"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span className={`flex size-4.5 items-center justify-center rounded-full text-[10px] font-bold ${
                  currentStep === "detect_report" ? "bg-amber-500 text-white" : "bg-muted text-muted-foreground"
                }`}>
                  2
                </span>
                <span>2. Phát Hiện Lỗi</span>
                <ChevronRight className="size-3 text-muted-foreground" />
              </button>

              {/* Step 3 Pill */}
              <button
                type="button"
                onClick={() => setCurrentStep("fixing")}
                className={`flex items-center gap-1 transition-colors ${
                  currentStep === "fixing"
                    ? "font-bold text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span className={`flex size-4.5 items-center justify-center rounded-full text-[10px] font-bold ${
                  currentStep === "fixing" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}>
                  3
                </span>
                <span>3. Sửa Lỗi Excel</span>
                <ChevronRight className="size-3 text-muted-foreground" />
              </button>

              {/* Step 4 Pill */}
              <button
                type="button"
                onClick={() => setCurrentStep("completed")}
                className={`flex items-center gap-1 transition-colors ${
                  currentStep === "completed"
                    ? "font-bold text-emerald-600 dark:text-emerald-400"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span className={`flex size-4.5 items-center justify-center rounded-full text-[10px] font-bold ${
                  currentStep === "completed" ? "bg-emerald-600 text-white" : "bg-muted text-muted-foreground"
                }`}>
                  4
                </span>
                <span>4. Hoàn Thành & Tải Lên</span>
              </button>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setInspection(null)
                setCurrentStep("upload")
              }}
              className="text-xs text-muted-foreground hover:text-foreground h-7 gap-1"
            >
              <RotateCcw className="size-3" /> Chọn lại tệp
            </Button>
          </div>
        )}

        {/* ============================================================ */}
        {/* STEP 1: CHỌN & TẢI TỆP LÊN                                    */}
        {/* ============================================================ */}
        {currentStep === "upload" && !inspection && (
          <div className="p-6 space-y-4">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl font-semibold">
                <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <FileSpreadsheet className="size-5" />
                </div>
                Tải Lên Tệp Dữ Liệu Kinh Doanh
              </DialogTitle>
              <DialogDescription>
                Hỗ trợ bảng tính <strong>.xlsx, .xls, .csv</strong>. Hệ thống sẽ tự động quét, phát hiện các lỗi
                thiếu ô dữ liệu, nhận diện tiêu đề, hỗ trợ đa Sheet và bóc tách nhiều bảng độc lập.
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
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 ${
                isDragging
                  ? "border-primary bg-primary/5 scale-[1.01]"
                  : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30"
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
              <div>
                <p className="font-semibold text-sm text-foreground">
                  Kéo và thả tệp dữ liệu vào đây, hoặc click để chọn
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Hệ thống sẽ kiểm tra lỗi và mở Trợ Lý Sửa Lỗi Tương Tác ngay sau khi quét
                </p>
              </div>

              <div className="flex gap-2 mt-2">
                <Badge variant="outline" className="text-xs">
                  .xlsx (Nhiều Sheet / Nhiều Bảng)
                </Badge>
                <Badge variant="outline" className="text-xs">
                  .xls
                </Badge>
                <Badge variant="outline" className="text-xs">
                  .csv
                </Badge>
              </div>
            </div>

            {isInspecting && (
              <div className="flex items-center justify-center gap-3 p-4 rounded-xl border bg-muted/30">
                <div className="size-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-xs font-medium text-foreground">
                  Đang quét và kiểm tra lỗi tệp Excel...
                </p>
              </div>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* STEP 2: BÁO CÁO PHÁT HIỆN LỖI (DETECTION & HEALTH REPORT)   */}
        {/* ============================================================ */}
        {currentStep === "detect_report" && inspection && currentSheet && (
          <div className="flex flex-col h-full overflow-hidden">
            <div className="p-6 border-b bg-muted/20 shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                    <AlertCircle className="size-5 text-amber-500" />
                    Báo Cáo Phát Hiện Lỗi & Cấu Trúc Tệp
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Tệp: <strong>{inspection.filename}</strong> ({formatFileSize(file?.size || 0)}) • {inspection.total_sheets} Sheet
                  </p>
                </div>

                {sheetIssuesSummary.totalIssues > 0 ? (
                  <Badge variant="secondary" className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 text-xs px-3 py-1 gap-1.5 font-semibold">
                    <AlertTriangle className="size-3.5" /> Phát Hiện {sheetIssuesSummary.totalIssues} Vấn Đề Cần Xử Lý
                  </Badge>
                ) : (
                  <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-xs px-3 py-1 gap-1.5 font-semibold">
                    <CheckCircle2 className="size-3.5" /> Dữ Liệu Hoàn Hảo (Không có lỗi)
                  </Badge>
                )}
              </div>

              {/* Sheet tabs if multiple */}
              {inspection.sheets.length > 1 && (
                <div className="flex items-center gap-2 mt-4 overflow-x-auto pb-1">
                  <span className="text-xs font-semibold text-muted-foreground shrink-0">Chọn Sheet kiểm tra:</span>
                  {inspection.sheets.map((s) => (
                    <button
                      key={s.name}
                      onClick={() => setSelectedSheetName(s.name)}
                      className={`px-3 py-1 rounded-lg text-xs font-medium border transition-all shrink-0 ${
                        s.name === currentSheet.name
                          ? "bg-primary text-primary-foreground border-primary shadow-sm"
                          : "bg-background hover:bg-muted text-muted-foreground border-border"
                      }`}
                    >
                      {s.name} ({s.row_count} dòng)
                      {s.missing_summary.total_missing > 0 && (
                        <span className="ml-1.5 px-1 py-0.2 rounded-full bg-amber-500/20 text-amber-600 text-[10px]">
                          {s.missing_summary.total_missing} ô thiếu
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Checklist of detected items */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Kết Quả Chẩn Đoán Chi Tiết Cho Sheet: <span className="text-foreground">{currentSheet.name}</span>
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Lỗi thiếu ô / dòng khuyết */}
                <div className={`p-4 rounded-xl border transition-all ${
                  currentSheet.missing_summary.total_missing > 0
                    ? "border-amber-300 bg-amber-50/40 dark:bg-amber-950/20 dark:border-amber-800"
                    : "border-border bg-card"
                }`}>
                  <div className="flex items-start gap-3">
                    <div className={`flex size-9 items-center justify-center rounded-lg shrink-0 ${
                      currentSheet.missing_summary.total_missing > 0
                        ? "bg-amber-500/20 text-amber-600"
                        : "bg-emerald-500/20 text-emerald-600"
                    }`}>
                      {currentSheet.missing_summary.total_missing > 0 ? (
                        <AlertTriangle className="size-5" />
                      ) : (
                        <CheckCircle2 className="size-5" />
                      )}
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-foreground">
                        {currentSheet.missing_summary.total_missing > 0
                          ? `Lỗi Ô Dữ Liệu Bị Khuyết (${currentSheet.missing_summary.total_missing} ô)`
                          : "Dữ Liệu Đầy Đủ (Không thiếu ô)"}
                      </p>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {currentSheet.missing_summary.total_missing > 0
                          ? `Phát hiện ${currentSheet.missing_summary.total_missing} ô bị trống rải rác trên ${currentSheet.missing_summary.affected_rows} dòng bản ghi và ${currentSheet.empty_rows.length} dòng trống hoàn toàn.`
                          : "Tất cả các dòng bản ghi đều có đầy đủ giá trị, không có ô rỗng."}
                      </p>
                      {currentSheet.missing_summary.columns_with_missing.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1.5">
                          {currentSheet.missing_summary.columns_with_missing.map((c) => (
                            <Badge key={c.name} variant="outline" className="text-[10px] bg-background">
                              Cột {c.name}: {c.missing_count} ô
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* 2. Tiêu đề cột (Header) */}
                <div className={`p-4 rounded-xl border transition-all ${
                  !currentSheet.has_header
                    ? "border-amber-300 bg-amber-50/40 dark:bg-amber-950/20 dark:border-amber-800"
                    : "border-border bg-card"
                }`}>
                  <div className="flex items-start gap-3">
                    <div className={`flex size-9 items-center justify-center rounded-lg shrink-0 ${
                      !currentSheet.has_header
                        ? "bg-amber-500/20 text-amber-600"
                        : "bg-emerald-500/20 text-emerald-600"
                    }`}>
                      {!currentSheet.has_header ? (
                        <Type className="size-5" />
                      ) : (
                        <CheckCircle2 className="size-5" />
                      )}
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-foreground">
                        {!currentSheet.has_header
                          ? "Chưa Có Tiêu Đề Cột (No Header)"
                          : "Tiêu Đề Cột Đã Hợp Lệ"}
                      </p>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {!currentSheet.has_header
                          ? "Hàng đầu tiên là số liệu/ngày tháng thực tế, chưa có tên thuộc tính. AI đã chuẩn bị các câu hỏi & gợi ý để bạn chọn tên cột."
                          : `Đã nhận diện hàng tiêu đề chuẩn với ${currentSheet.column_count} cột thuộc tính.`}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 3. Đa Sheet */}
                <div className="p-4 rounded-xl border bg-card">
                  <div className="flex items-start gap-3">
                    <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                      <Layers className="size-5" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-foreground">
                        {inspection.total_sheets > 1
                          ? `Tệp Có ${inspection.total_sheets} Sheet Khác Nhau`
                          : "Tệp Có 1 Sheet Duy Nhất"}
                      </p>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {inspection.total_sheets > 1
                          ? `Workbook chứa các sheet: ${inspection.sheets.map((s) => s.name).join(", ")}. Bạn có thể chọn sheet mong muốn.`
                          : "Định dạng bảng tính chuẩn một sheet."}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 4. Nhiều bảng trong 1 sheet */}
                <div className={`p-4 rounded-xl border transition-all ${
                  currentSheet.is_multi_table
                    ? "border-purple-300 bg-purple-50/40 dark:bg-purple-950/20 dark:border-purple-800"
                    : "border-border bg-card"
                }`}>
                  <div className="flex items-start gap-3">
                    <div className={`flex size-9 items-center justify-center rounded-lg shrink-0 ${
                      currentSheet.is_multi_table
                        ? "bg-purple-500/20 text-purple-600"
                        : "bg-emerald-500/20 text-emerald-600"
                    }`}>
                      <TableIcon className="size-5" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-foreground">
                        {currentSheet.is_multi_table
                          ? `Phát Hiện ${currentSheet.table_regions.length} Bảng Riêng Biệt Trong Sheet`
                          : "Bố Cục Bảng Đơn (Một bảng trong sheet)"}
                      </p>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {currentSheet.is_multi_table
                          ? `Sheet chứa các bảng độc lập (ví dụ: Doanh thu Miền Bắc và Miền Nam). Hệ thống đã bóc tách từng vùng để bạn chọn.`
                          : "Bảng dữ liệu chiếm trọn vẹn worksheet."}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Actions for Step 2 */}
            <div className="border-t bg-card px-6 py-4 flex items-center justify-between shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={handleUploadOriginal}
                disabled={isSaving}
                className="text-xs"
              >
                Tải Lên Tệp Gốc (Bỏ qua sửa lỗi)
              </Button>

              <div className="flex items-center gap-2.5">
                <Button
                  size="sm"
                  onClick={() => setCurrentStep("fixing")}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs h-9 px-4 gap-2 shadow-sm"
                >
                  <Wand2 className="size-4" />
                  Bắt Đầu Nghiệp Vụ Sửa Lỗi File Excel
                  <ArrowRight className="size-4" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* STEP 3: NGHIỆP VỤ SỬA LỖI FILE EXCEL                        */}
        {/* ============================================================ */}
        {currentStep === "fixing" && inspection && currentSheet && (
          <div className="flex flex-col h-full overflow-hidden">
            {/* Sheet & Sub-table bar */}
            <div className="border-b bg-muted/20 px-6 py-3 space-y-2.5 shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-foreground">Đang xử lý Sheet:</span>
                  <Badge variant="outline" className="font-semibold text-xs bg-background">
                    {currentSheet.name}
                  </Badge>
                  {selectedTableId && (
                    <Badge className="bg-purple-500/15 text-purple-700 dark:text-purple-300 text-xs font-semibold">
                      Bảng: {selectedTableId}
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">Còn <strong>{remainingMissingCount}</strong> ô trống</span>
                  <span>•</span>
                  <span className="text-muted-foreground">Đã sửa <strong>{Object.keys(columnRenames).length}</strong> tên cột</span>
                </div>
              </div>

              {/* Multi-table selector if applicable */}
              {currentSheet.is_multi_table && currentSheet.table_regions.length > 1 && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-purple-500/10 border border-purple-500/20 text-xs">
                  <TableIcon className="size-3.5 text-purple-600 shrink-0" />
                  <span className="font-semibold text-purple-900 dark:text-purple-200 shrink-0">
                    Chọn bảng cần sửa:
                  </span>
                  <div className="flex items-center gap-1.5 overflow-x-auto">
                    {currentSheet.table_regions.map((reg, idx) => (
                      <button
                        key={reg.table_id}
                        type="button"
                        onClick={() => setSelectedTableId(reg.table_id)}
                        className={`px-2.5 py-0.5 rounded text-xs font-medium transition-colors ${
                          selectedTableId === reg.table_id
                            ? "bg-purple-600 text-white shadow-sm"
                            : "bg-background hover:bg-muted text-muted-foreground border"
                        }`}
                      >
                        Bảng {idx + 1} ({reg.range})
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Sub-tabs between Header fixing and Missing cell fixing */}
              <Tabs value={fixSubTab} onValueChange={(v) => setFixSubTab(v as any)} className="w-full">
                <TabsList className="grid w-full max-w-md grid-cols-2 h-8">
                  <TabsTrigger value="headers" className="text-xs font-semibold gap-1.5">
                    <Type className="size-3.5" />
                    Đặt Tên Tiêu Đề Cột
                    {!currentSheet.has_header && (
                      <span className="size-1.5 rounded-full bg-amber-500" />
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="cleaning" className="text-xs font-semibold gap-1.5">
                    <Wand2 className="size-3.5" />
                    Sửa Ô Thiếu & Dữ Liệu ({remainingMissingCount})
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Sub-tab 1: Header resolution */}
            <div className="flex-1 overflow-y-auto p-6 bg-muted/10 min-h-0">
              {fixSubTab === "headers" && (
                <div className="space-y-4 max-w-4xl mx-auto">
                  {!currentSheet.has_header && (
                    <div className="p-3.5 rounded-xl border border-amber-300 bg-amber-500/10 text-amber-900 dark:text-amber-200 text-xs flex items-center gap-2.5">
                      <Sparkles className="size-4 shrink-0 text-amber-600" />
                      <span>
                        AI đã phân tích dữ liệu thực tế và chuẩn bị sẵn các câu hỏi / gợi ý bên dưới. Bấm vào nút màu tím để đổi tên cột chỉ với 1 cú click!
                      </span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {currentSheet.columns.map((col, idx) => {
                      const currentName = columnRenames[col.name] || col.name
                      const isRenamed = columnRenames[col.name] !== undefined
                      return (
                        <div
                          key={col.name || idx}
                          className={`p-4 rounded-xl border bg-card space-y-2.5 ${
                            isRenamed ? "border-primary/50 shadow-sm" : ""
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="flex size-5 items-center justify-center rounded-full bg-muted font-mono text-[10px] text-muted-foreground">
                                {idx + 1}
                              </span>
                              <Badge variant="secondary" className="text-xs font-medium">
                                {col.type_category}
                              </Badge>
                            </div>
                            <Badge variant="outline" className="text-[10px] font-mono">
                              {col.dtype}
                            </Badge>
                          </div>

                          <div>
                            <Label className="text-xs text-muted-foreground">Tên cột:</Label>
                            <Input
                              value={currentName}
                              onChange={(e) => {
                                const val = e.target.value
                                setColumnRenames((prev) => ({
                                  ...prev,
                                  [col.name]: val,
                                }))
                              }}
                              placeholder={`Tên cột ${idx + 1}`}
                              className="h-8 text-xs font-semibold mt-1"
                            />
                          </div>

                          {/* Smart suggestions */}
                          {col.suggestions && col.suggestions.length > 0 && (
                            <div className="space-y-1.5 pt-1 border-t border-border/50">
                              <span className="text-[11px] font-medium text-purple-600 dark:text-purple-400 flex items-center gap-1">
                                <Sparkles className="size-3" /> Gợi ý đoán cột này:
                              </span>
                              <div className="flex flex-wrap gap-1">
                                {col.suggestions.map((sug: string) => (
                                  <button
                                    key={sug}
                                    type="button"
                                    onClick={() => applyColumnSuggestion(col.name, sug)}
                                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all ${
                                      currentName.toLowerCase() === sug.toLowerCase()
                                        ? "bg-purple-600 text-white font-semibold"
                                        : "bg-purple-500/10 hover:bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-500/20"
                                    }`}
                                  >
                                    + {sug}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          <p className="text-[11px] text-muted-foreground truncate">
                            Mẫu: {col.sample_values?.join(", ") || "(trống)"}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Sub-tab 2: Missing cells correction */}
              {fixSubTab === "cleaning" && (
                <div className="space-y-5 max-w-4xl mx-auto">
                  {/* Quick tools */}
                  <div className="p-4 rounded-xl border bg-card space-y-3">
                    <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Wand2 className="size-4 text-primary" />
                      Công cụ điền nhanh cho các cột bị khuyết
                    </h4>

                    {currentSheet.missing_summary.columns_with_missing.length === 0 ? (
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                        <CheckCircle2 className="size-4" /> Tuyệt vời! Không có ô nào bị thiếu dữ liệu.
                      </p>
                    ) : (
                      <div className="space-y-2.5">
                        {currentSheet.missing_summary.columns_with_missing.map((col) => {
                          const colName = columnRenames[col.name] || col.name
                          const activeFill = columnFills[col.name]
                          return (
                            <div
                              key={col.name}
                              className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg border bg-muted/20 text-xs"
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-foreground">{colName}</span>
                                <Badge variant="secondary" className="text-[10px]">
                                  {col.missing_count} ô trống ({col.missing_percentage}%)
                                </Badge>
                                {activeFill && (
                                  <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[10px] gap-1">
                                    <Check className="size-3" /> Đã chọn điền: {String(activeFill)}
                                  </Badge>
                                )}
                              </div>

                              <div className="flex flex-wrap items-center gap-1.5">
                                {col.fill_suggestions?.mean !== undefined && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs font-medium"
                                    onClick={() => applyColumnFill(col.name, "mean", `TB: ${col.fill_suggestions?.mean}`)}
                                  >
                                    Điền TB ({col.fill_suggestions?.mean.toLocaleString()})
                                  </Button>
                                )}
                                {col.fill_suggestions?.median !== undefined && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs font-medium"
                                    onClick={() => applyColumnFill(col.name, "median", `Trung vị: ${col.fill_suggestions?.median}`)}
                                  >
                                    Điền Trung Vị ({col.fill_suggestions?.median.toLocaleString()})
                                  </Button>
                                )}
                                {col.fill_suggestions?.mode !== undefined && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs font-medium"
                                    onClick={() => applyColumnFill(col.name, "mode", String(col.fill_suggestions?.mode))}
                                  >
                                    Điền '{col.fill_suggestions?.mode}'
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs font-medium"
                                  onClick={() => applyColumnFill(col.name, "placeholder", "Chưa xác định")}
                                >
                                  Điền 'Chưa xác định'
                                </Button>
                              </div>
                            </div>
                          )
                        })}

                        <div className="pt-2 border-t flex items-center gap-4 text-xs">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={dropEmptyRows}
                              onChange={(e) => setDropEmptyRows(e.target.checked)}
                              className="rounded border-gray-300 text-primary"
                            />
                            <span>Xóa các dòng hoàn toàn rỗng ({currentSheet.empty_rows.length} dòng)</span>
                          </label>

                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={dropAnyMissingRows}
                              onChange={(e) => setDropAnyMissingRows(e.target.checked)}
                              className="rounded border-gray-300 text-primary"
                            />
                            <span>Xóa tất cả dòng chứa ô trống</span>
                          </label>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Manual cell edit table */}
                  {currentSheet.missing_cells.length > 0 && (
                    <div className="space-y-2.5">
                      <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <Edit3 className="size-4 text-amber-600" />
                        Chỉnh sửa trực tiếp từng ô dữ liệu bị thiếu
                      </h4>

                      <div className="border rounded-xl bg-card overflow-hidden">
                        <Table>
                          <TableHeader className="bg-muted/40">
                            <TableRow>
                              <TableHead className="w-16 text-center text-xs">Dòng</TableHead>
                              <TableHead className="text-xs">Cột Bị Thiếu</TableHead>
                              <TableHead className="text-xs">Giá Trị Sửa Lỗi</TableHead>
                              <TableHead className="text-xs">Ngữ Cảnh Dòng Dữ Liệu</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {currentSheet.missing_cells.map((cell, idx) => {
                              const key = `${cell.row_index}_${cell.column_name}`
                              const editedVal = cellFixes[key] || ""
                              const hasColumnFill = columnFills[cell.column_name] !== undefined
                              return (
                                <TableRow key={`${cell.row_index}_${cell.column_index}_${idx}`}>
                                  <TableCell className="text-center font-mono text-xs text-muted-foreground font-semibold">
                                    #{cell.row_index + 1}
                                  </TableCell>
                                  <TableCell className="font-semibold text-xs text-foreground">
                                    {columnRenames[cell.column_name] || cell.column_name}
                                  </TableCell>
                                  <TableCell>
                                    <Input
                                      value={editedVal}
                                      onChange={(e) => handleCellEdit(cell.row_index, cell.column_name, e.target.value)}
                                      placeholder={hasColumnFill ? `[Tự điền: ${columnFills[cell.column_name]}]` : "Gõ giá trị..."}
                                      className="h-7 text-xs font-medium w-44 bg-amber-50/50 dark:bg-amber-950/20 border-amber-300"
                                    />
                                  </TableCell>
                                  <TableCell className="text-xs text-muted-foreground">
                                    <div className="flex flex-wrap gap-1 max-w-md">
                                      {cell.row_context &&
                                        Object.entries(cell.row_context).slice(0, 3).map(([k, v]) => (
                                          <span key={k} className="bg-muted px-1.5 py-0.5 rounded text-[10px]">
                                            {k}: <strong>{String(v)}</strong>
                                          </span>
                                        ))}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              )
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Step 3 Footer */}
            <div className="border-t bg-card px-6 py-3.5 flex items-center justify-between shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentStep("detect_report")}
                className="text-xs gap-1"
              >
                <ArrowLeft className="size-3.5" /> Xem lại báo cáo lỗi
              </Button>

              <Button
                size="sm"
                onClick={() => setCurrentStep("completed")}
                className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold gap-1.5"
              >
                Tiếp Theo: Nghiệm Thu & Tải Lên <ArrowRight className="size-3.5" />
              </Button>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* STEP 4: HOÀN THÀNH & CHO PHÉP TẢI LÊN FILE NÀY             */}
        {/* ============================================================ */}
        {currentStep === "completed" && inspection && currentSheet && (
          <div className="flex flex-col h-full overflow-hidden">
            <div className="p-6 border-b bg-emerald-500/10 shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex size-11 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
                    <ShieldCheck className="size-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                      Nghiệp Vụ Sửa Lỗi Hoàn Tất! Dữ Liệu Đã Đạt Chuẩn 100%
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Đã khắc phục toàn bộ vấn đề về tiêu đề cột, ô khuyết thiếu và phân tách bảng.
                    </p>
                  </div>
                </div>

                <Badge className="bg-emerald-600 text-white text-xs px-3 py-1 font-bold">
                  Sẵn Sàng Tải Lên
                </Badge>
              </div>

              {/* Summary stats of fixes */}
              <div className="grid grid-cols-3 gap-3 mt-4">
                <div className="p-3 rounded-lg border bg-card text-center">
                  <p className="text-[11px] text-muted-foreground font-medium">Tên Cột Đã Chuẩn Hóa</p>
                  <p className="text-base font-bold text-foreground">
                    {currentSheet.columns.length} <span className="text-xs font-normal text-muted-foreground">cột</span>
                  </p>
                </div>
                <div className="p-3 rounded-lg border bg-card text-center">
                  <p className="text-[11px] text-muted-foreground font-medium">Ô Thiếu Đã Khắc Phục</p>
                  <p className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                    {currentSheet.missing_summary.total_missing - remainingMissingCount} / {currentSheet.missing_summary.total_missing} <span className="text-xs font-normal text-muted-foreground">ô</span>
                  </p>
                </div>
                <div className="p-3 rounded-lg border bg-card text-center">
                  <p className="text-[11px] text-muted-foreground font-medium">Quy Mô Dữ Liệu</p>
                  <p className="text-base font-bold text-foreground">
                    {currentSheet.row_count} <span className="text-xs font-normal text-muted-foreground">dòng</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Data preview */}
            <div className="flex-1 overflow-y-auto p-6 bg-muted/10">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                Xem Trước Bảng Dữ Liệu Sau Khi Làm Sạch
              </h4>

              <div className="border rounded-xl bg-card overflow-x-auto max-h-[380px]">
                <Table>
                  <TableHeader className="bg-muted/40 sticky top-0 z-10">
                    <TableRow>
                      <TableHead className="w-12 text-center text-xs">#</TableHead>
                      {currentSheet.columns.map((col) => (
                        <TableHead key={col.name} className="text-xs font-bold whitespace-nowrap text-foreground">
                          {columnRenames[col.name] || col.name}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentSheet.sample_data.length > 0 ? (
                      currentSheet.sample_data.map((row, rIdx) => (
                        <TableRow key={rIdx}>
                          <TableCell className="text-center font-mono text-xs text-muted-foreground">
                            {rIdx + 1}
                          </TableCell>
                          {currentSheet.columns.map((col) => {
                            const key = `${rIdx}_${col.name}`
                            const isFixed = cellFixes[key] !== undefined
                            const hasFill = columnFills[col.name] !== undefined
                            let val = row[col.name]
                            if (isFixed) {
                              val = cellFixes[key]
                            } else if ((val === undefined || val === null || val === "") && hasFill) {
                              val = `[${columnFills[col.name]}]`
                            }
                            return (
                              <TableCell key={col.name} className="text-xs whitespace-nowrap">
                                {val !== undefined && val !== null && val !== "" ? (
                                  <span className={isFixed ? "font-bold text-emerald-600 dark:text-emerald-400" : ""}>
                                    {String(val)}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground/40 italic text-[11px]">(trống)</span>
                                )}
                              </TableCell>
                            )
                          })}
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={currentSheet.columns.length + 1} className="text-center py-6 text-muted-foreground text-xs">
                          Không có dữ liệu
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Bottom Final Action: CHO PHÉP TẢI LÊN FILE NÀY */}
            <div className="border-t bg-card px-6 py-4 flex items-center justify-between shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentStep("fixing")}
                className="text-xs gap-1"
              >
                <ArrowLeft className="size-3.5" /> Sửa lại thiết lập
              </Button>

              <LoadingButton
                size="sm"
                loading={isSaving}
                disabled={isSaving}
                onClick={handleSaveDataset}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm h-10 px-5 gap-2 shadow-md"
              >
                <FileCheck className="size-4.5" />
                Hoàn Thành & Tải Lên File Này Ngay
              </LoadingButton>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
