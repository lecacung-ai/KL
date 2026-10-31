import { ResultFigure } from "@/components/Common/ResultFigure"
import { PageHeading } from "@/components/Common/PageHeading"
import { useState, useEffect } from "react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { TrendingUp, Layers as BrainCircuit, ChartNoAxesCombined as Sparkles, Download, RefreshCw, ArrowUpRight, ArrowDownRight, Info, CheckCircle2, Table as TableIcon, BarChart3, Sliders, Database, FileSpreadsheet } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DatasetsService, Dataset } from "@/services/datasetsService"
import {
  ForecastService,
  ForecastResponseData,
  ClusteringResponseData,
} from "@/services/forecastService"

export const Route = createFileRoute("/_layout/forecast")({
  component: ForecastPage,
  head: () => ({
    meta: [
      {
        title: "Dự Báo Tài Chính & Phân Tích Định Lượng - FinAI",
      },
    ],
  }),
})

function ForecastPage() {
  const navigate = useNavigate()
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [isLoadingDatasets, setIsLoadingDatasets] = useState(true)

  // Dataset & Column Selection State
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>("")
  const [numericColumns, setNumericColumns] = useState<string[]>([])
  const [dateColumns, setDateColumns] = useState<string[]>([])
  const [allColumns, setAllColumns] = useState<string[]>([])

  // Forecasting Options State
  const [targetColumn, setTargetColumn] = useState<string>("")
  const [dateColumn, setDateColumn] = useState<string>("")
  const [horizon, setHorizon] = useState<number>(3)
  const [modelType, setModelType] = useState<"linear_regression" | "polynomial_trend" | "exponential_smoothing">("linear_regression")
  const [isForecasting, setIsForecasting] = useState(false)
  const [forecastResult, setForecastResult] = useState<ForecastResponseData | null>(null)

  // Clustering Options State
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([])
  const [nClusters, setNClusters] = useState<number>(3)
  const [idColumn, setIdColumn] = useState<string>("")
  const [isClustering, setIsClustering] = useState(false)
  const [clusteringResult, setClusteringResult] = useState<ClusteringResponseData | null>(null)

  // 1. Tải danh sách tệp dữ liệu
  useEffect(() => {
    loadDatasets()
  }, [])

  const loadDatasets = async () => {
    setIsLoadingDatasets(true)
    try {
      const res = await DatasetsService.getDatasets(0, 100)
      const readyDatasets = res.data.filter((d) => d.status === "ready")
      setDatasets(readyDatasets)
      if (readyDatasets.length > 0 && !selectedDatasetId) {
        handleSelectDataset(readyDatasets[0])
      }
    } catch {
      toast.error("Không thể tải danh sách dữ liệu từ kho lưu trữ")
    } finally {
      setIsLoadingDatasets(false)
    }
  }

  // 2. Phân tách cột số và cột thời gian khi chọn dataset
  const handleSelectDataset = (dataset: Dataset) => {
    setSelectedDatasetId(dataset.id)
    setForecastResult(null)
    setClusteringResult(null)

    try {
      if (dataset.schema_info) {
        const profile = JSON.parse(dataset.schema_info)
        const cols = profile.columns || []
        const numCols: string[] = []
        const dtCols: string[] = []
        const names: string[] = []

        cols.forEach((col: any) => {
          names.push(col.name)
          if (col.type_category?.includes("Số") || col.dtype.includes("int") || col.dtype.includes("float")) {
            numCols.push(col.name)
          }
          if (col.type_category?.includes("Thời gian") || col.name.toLowerCase().includes("date") || col.name.toLowerCase().includes("ngay") || col.name.toLowerCase().includes("thang")) {
            dtCols.push(col.name)
          }
        })

        setNumericColumns(numCols)
        setDateColumns(dtCols)
        setAllColumns(names)

        if (numCols.length > 0) {
          setTargetColumn(numCols[0])
          setSelectedFeatures(numCols.slice(0, 3))
        }
        if (dtCols.length > 0) {
          setDateColumn(dtCols[0])
        } else {
          setDateColumn("")
        }
      }
    } catch {
      setNumericColumns([])
      setDateColumns([])
      setAllColumns([])
    }
  }

  // 3. Thực hiện dự báo tài chính
  const handleRunForecast = async () => {
    if (!selectedDatasetId) {
      toast.error("Vui lòng chọn tệp dữ liệu nguồn")
      return
    }
    if (!targetColumn) {
      toast.error("Vui lòng chọn chỉ tiêu tài chính cần dự báo")
      return
    }

    setIsForecasting(true)
    try {
      const res = await ForecastService.predict({
        dataset_id: selectedDatasetId,
        target_column: targetColumn,
        date_column: dateColumn || null,
        horizon,
        model_type: modelType,
      })
      setForecastResult(res.data)
      toast.success(`Dự báo thành công ${horizon} kỳ tiếp theo cho '${targetColumn}'`)
    } catch (err: any) {
      const msg = err.response?.data?.detail || "Lỗi trong quá trình huấn luyện mô hình dự báo"
      toast.error(msg)
    } finally {
      setIsForecasting(false)
    }
  }

  // 4. Thực hiện phân cụm K-Means
  const handleRunClustering = async () => {
    if (!selectedDatasetId) {
      toast.error("Vui lòng chọn tệp dữ liệu nguồn")
      return
    }
    if (selectedFeatures.length < 2) {
      toast.error("Vui lòng chọn tối thiểu 2 đặc trưng số học để phân cụm")
      return
    }

    setIsClustering(true)
    try {
      const res = await ForecastService.runClustering({
        dataset_id: selectedDatasetId,
        features: selectedFeatures,
        n_clusters: nClusters,
        id_column: idColumn || null,
      })
      setClusteringResult(res.data)
      toast.success(`Phân cụm K-Means thành công (${nClusters} phân khúc)`)
    } catch (err: any) {
      const msg = err.response?.data?.detail || "Lỗi khi thực hiện phân cụm"
      toast.error(msg)
    } finally {
      setIsClustering(false)
    }
  }

  // Tải ảnh biểu đồ xuống máy
  const handleDownloadChart = (imageSrc: string, filename: string) => {
    const link = document.createElement("a")
    link.href = imageSrc
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success("Đã tải tệp ảnh biểu đồ")
  }

  return (
    <div className="flex min-w-0 flex-col gap-7 pb-8 w-full">
      <PageHeading eyebrow="Từ dữ liệu đến góc nhìn" title="Dự báo & phân nhóm"
        description="Khám phá xu hướng theo thời gian và những nhóm có đặc điểm tương đồng."
        action={<div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadDatasets} disabled={isLoadingDatasets} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${isLoadingDatasets ? "animate-spin" : ""}`} /> Làm mới nguồn dữ liệu
          </Button>
          <Button variant="default" size="sm" onClick={() => navigate({ to: "/datasets" })} className="gap-2">
            <Database className="h-4 w-4" /> Quản lý kho dữ liệu
          </Button>
        </div>} />

      {/* Dataset Picker Bar */}
      <Card className="border-border bg-card  shadow-sm">
        <CardContent className="p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-semibold tracking-normal text-muted-foreground">Tệp Dữ Liệu Nguồn</span>
              {datasets.length === 0 && !isLoadingDatasets ? (
                <span className="text-sm text-destructive">Chưa có tệp dữ liệu. Vui lòng tải file lên kho dữ liệu.</span>
              ) : (
                <select
                  value={selectedDatasetId}
                  onChange={(e) => {
                    const ds = datasets.find((d) => d.id === e.target.value)
                    if (ds) handleSelectDataset(ds)
                  }}
                  className="bg-transparent font-medium text-sm text-foreground focus:outline-none cursor-pointer border-b border-border/60 pb-0.5"
                >
                  {datasets.map((ds) => (
                    <option key={ds.id} value={ds.id} className="bg-popover text-foreground">
                      {ds.filename} (v{ds.version} - {ds.row_count.toLocaleString()} dòng)
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-primary" />
              {numericColumns.length} Cột chỉ số tài chính
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-orange-500" />
              {dateColumns.length} Cột mốc thời gian
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Main Tabs */}
      <Tabs defaultValue="forecast" className="w-full space-y-6">
        <TabsList className="grid grid-cols-2 max-w-md bg-muted/60 p-1">
          <TabsTrigger value="forecast" className="gap-2 text-xs md:text-sm">
            <TrendingUp className="h-4 w-4" />
            Dự báo theo thời gian
          </TabsTrigger>
          <TabsTrigger value="clustering" className="gap-2 text-xs md:text-sm">
            <BrainCircuit className="h-4 w-4" />
            Phân nhóm dữ liệu (K-Means)
          </TabsTrigger>
        </TabsList>

        {/* ================= TAB 1: DỰ BÁO CHUỖI THỜI GIAN ================= */}
        <TabsContent value="forecast" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Control Panel */}
            <Card className="border-border lg:col-span-1 shadow-sm flex flex-col justify-between">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Sliders className="h-4 w-4 text-primary" />
                  Cấu Hình Tham Số Dự Báo
                </CardTitle>
                <CardDescription className="text-xs">
                  Thiết lập biến mục tiêu, trục thời gian và mô hình toán học
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4 text-sm">
                {/* Target Column */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground flex items-center justify-between">
                    <span>Chỉ tiêu tài chính mục tiêu</span>
                    <span className="text-xs text-primary">Biến Y</span>
                  </label>
                  <select
                    value={targetColumn}
                    onChange={(e) => setTargetColumn(e.target.value)}
                    className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    {numericColumns.length === 0 ? (
                      <option value="">Không có cột dạng số</option>
                    ) : (
                      numericColumns.map((col) => (
                        <option key={col} value={col}>
                          {col}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                {/* Date Column */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground flex items-center justify-between">
                    <span>Cột mốc thời gian (Tùy chọn)</span>
                    <span className="text-xs text-muted-foreground">Trục X</span>
                  </label>
                  <select
                    value={dateColumn}
                    onChange={(e) => setDateColumn(e.target.value)}
                    className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="">Tự động sắp xếp theo thứ tự chuỗi</option>
                    {allColumns.map((col) => (
                      <option key={col} value={col}>
                        {col}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Horizon Selection */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Khoảng thời gian dự phóng (Kỳ)</label>
                  <div className="grid grid-cols-4 gap-2">
                    {[1, 3, 6, 12].map((h) => (
                      <Button
                        key={h}
                        type="button"
                        variant={horizon === h ? "default" : "outline"}
                        size="sm"
                        onClick={() => setHorizon(h)}
                        className="text-xs h-9"
                      >
                        +{h} kỳ
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Model Type */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Thuật toán phân tích</label>
                  <select
                    value={modelType}
                    onChange={(e) => setModelType(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="linear_regression">Hồi quy tuyến tính (Linear Regression)</option>
                    <option value="polynomial_trend">Đường cong xu hướng đa thức (Polynomial Trend)</option>
                    <option value="exponential_smoothing">Làm mịn số mũ tuyến tính (Holt's Smoothing)</option>
                  </select>
                </div>

                <div className="pt-2">
                  <Button
                    onClick={handleRunForecast}
                    disabled={isForecasting || !selectedDatasetId || !targetColumn}
                    className="w-full gap-2 shadow-sm font-semibold"
                  >
                    {isForecasting ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Đang huấn luyện mô hình...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        Thực Hiện Dự Báo Tài Chính
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Results Overview */}
            <div className="lg:col-span-2 space-y-4">
              {!forecastResult ? (
                <Card className="border-dashed border-2 flex flex-col items-center justify-center p-12 text-center h-full min-h-[350px]">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-3">
                    <TrendingUp className="h-6 w-6" />
                  </div>
                  <h3 className="font-semibold text-base">Sẵn Sàng Huấn Luyện Dự Báo</h3>
                  <p className="text-xs text-muted-foreground max-w-md mt-1 mb-4">
                    Chọn chỉ tiêu tài chính cần dự báo (Doanh thu, Lợi nhuận gộp, Chi phí) và số kỳ mong muốn ở bảng bên trái, sau đó nhấn "Thực Hiện Dự Báo".
                  </p>
                  <Button variant="outline" size="sm" onClick={handleRunForecast} disabled={!targetColumn} className="gap-2">
                    <Sparkles className="h-3.5 w-3.5" />
                    Chạy thử với {targetColumn || "chỉ tiêu đầu tiên"}
                  </Button>
                </Card>
              ) : (
                <div className="space-y-4">
                  {/* KPI Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Card className="border-border p-3.5 bg-card ">
                      <span className="text-xs font-medium text-muted-foreground tracking-normal">Sai số MAE</span>
                      <div className="text-xl font-semibold mt-1 text-foreground">
                        ±{forecastResult.metrics.mae.toLocaleString()}
                      </div>
                      <span className="text-xs text-muted-foreground">Độ lệch tuyệt đối trung bình</span>
                    </Card>

                    <Card className="border-border p-3.5 bg-card ">
                      <span className="text-xs font-medium text-muted-foreground tracking-normal">Sai số RMSE</span>
                      <div className="text-xl font-semibold mt-1 text-foreground">
                        {forecastResult.metrics.rmse.toLocaleString()}
                      </div>
                      <span className="text-xs text-muted-foreground">Căn bậc hai sai số bình phương</span>
                    </Card>

                    <Card className="border-border p-3.5 bg-card ">
                      <span className="text-xs font-medium text-muted-foreground tracking-normal">Độ phù hợp R²</span>
                      <div className="text-xl font-semibold mt-1 text-emerald-500">
                        {Math.round(forecastResult.metrics.r2 * 100)}%
                      </div>
                      <span className="text-xs text-muted-foreground">Khả năng giải thích phương sai</span>
                    </Card>

                    <Card className="border-border p-3.5 bg-card ">
                      <span className="text-xs font-medium text-muted-foreground tracking-normal">Tăng trưởng dự phóng</span>
                      <div className={`text-xl font-semibold mt-1 flex items-center gap-1 ${forecastResult.growth_rate_pct >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                        {forecastResult.growth_rate_pct >= 0 ? (
                          <ArrowUpRight className="h-5 w-5" />
                        ) : (
                          <ArrowDownRight className="h-5 w-5" />
                        )}
                        {forecastResult.growth_rate_pct > 0 ? `+${forecastResult.growth_rate_pct}%` : `${forecastResult.growth_rate_pct}%`}
                      </div>
                      <span className="text-xs text-muted-foreground">So với kỳ cơ sở gần nhất</span>
                    </Card>
                  </div>

                  {/* Executive Summary */}
                  <Card className="border-border bg-primary/5 border-primary/20 p-4">
                    <div className="flex items-start gap-3">
                      <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <div className="text-xs md:text-sm text-foreground/90 leading-relaxed">
                        <span className="font-semibold text-primary">Đánh Giá Định Lượng: </span>
                        {forecastResult.summary}
                      </div>
                    </div>
                  </Card>
                </div>
              )}
            </div>
          </div>

          {/* Forecast Visualization & Tables */}
          {forecastResult && (
            <div className="space-y-6">
              {/* Chart Card */}
              <Card className="border-border overflow-hidden shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between pb-2 bg-muted/20">
                  <div>
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-primary" />
                      Biểu Đồ Trực Quan Xu Hướng & Khoảng Tin Cậy 95%
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Phân định rõ ràng giữa dữ liệu thực tế lịch sử và dải giá trị dự phóng tương lai
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownloadChart(forecastResult.chart_image, `du_bao_${targetColumn}.png`)}
                    className="gap-1.5 text-xs"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Tải Biểu Đồ PNG
                  </Button>
                </CardHeader>
                <CardContent className="p-4 flex items-center justify-center bg-muted/30">
                  <ResultFigure src={forecastResult.chart_image} alt="Biểu đồ dự báo tài chính" />
                </CardContent>
              </Card>

              {/* Data Table of Future Predictions */}
              <Card className="border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <TableIcon className="h-4 w-4 text-primary" />
                    Bảng Giá Trị Dự Báo Chi Tiết ({forecastResult.horizon} Kỳ Sắp Tới)
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Số liệu định lượng kèm chặn trên (Max) và chặn dưới (Min) theo phân phối chuẩn 95%
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead className="font-semibold text-xs">Mốc Thời Gian / Kỳ Dự Phóng</TableHead>
                        <TableHead className="font-semibold text-xs text-right">Giá Trị Dự Báo Trung Bình</TableHead>
                        <TableHead className="font-semibold text-xs text-right text-muted-foreground">Khoảng Tối Thiểu (Min 95%)</TableHead>
                        <TableHead className="font-semibold text-xs text-right text-muted-foreground">Khoảng Tối Đa (Max 95%)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {forecastResult.forecast_table.map((row, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium text-xs flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-orange-500" />
                            {row.period}
                          </TableCell>
                          <TableCell className="text-right font-semibold text-primary text-sm">
                            {row.forecast_value.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground">
                            {row.lower_bound.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground">
                            {row.upper_bound.toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* ================= TAB 2: PHÂN CỤM HỌC MÁY (K-MEANS) ================= */}
        <TabsContent value="clustering" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Control Panel for Clustering */}
            <Card className="border-border lg:col-span-1 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <BrainCircuit className="h-4 w-4 text-primary" />
                  Cấu Hình Phân Cụm K-Means
                </CardTitle>
                <CardDescription className="text-xs">
                  Phân khúc khách hàng hoặc sản phẩm dựa trên thuật toán học máy không giám sát
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                {/* Select Number of Clusters */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Số lượng phân cụm (K)</label>
                  <div className="grid grid-cols-4 gap-2">
                    {[2, 3, 4, 5].map((k) => (
                      <Button
                        key={k}
                        type="button"
                        variant={nClusters === k ? "default" : "outline"}
                        size="sm"
                        onClick={() => setNClusters(k)}
                        className="text-xs h-9"
                      >
                        {k} Cụm
                      </Button>
                    ))}
                  </div>
                </div>

                {/* ID Column */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Cột định danh (Mã KH / Tên SP)</label>
                  <select
                    value={idColumn}
                    onChange={(e) => setIdColumn(e.target.value)}
                    className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="">Tự động gắn mã số bản ghi</option>
                    {allColumns.map((col) => (
                      <option key={col} value={col}>
                        {col}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Quantitative Feature Chips */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground flex items-center justify-between">
                    <span>Đặc trưng định lượng phân cụm (Tối thiểu 2)</span>
                    <span className="text-xs text-primary">{selectedFeatures.length} đã chọn</span>
                  </label>
                  <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto p-2 rounded-md border border-input bg-muted/20">
                    {numericColumns.map((col) => {
                      const isSelected = selectedFeatures.includes(col)
                      return (
                        <button
                          key={col}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setSelectedFeatures(selectedFeatures.filter((f) => f !== col))
                            } else {
                              setSelectedFeatures([...selectedFeatures, col])
                            }
                          }}
                          className={`px-2.5 py-1 rounded-full text-xs transition-colors flex items-center gap-1 border ${
                            isSelected
                              ? "bg-primary text-primary-foreground border-primary font-medium"
                              : "bg-background text-muted-foreground border-border hover:bg-muted"
                          }`}
                        >
                          {isSelected && <CheckCircle2 className="h-3 w-3" />}
                          {col}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="pt-2">
                  <Button
                    onClick={handleRunClustering}
                    disabled={isClustering || selectedFeatures.length < 2 || !selectedDatasetId}
                    className="w-full gap-2 shadow-sm font-semibold"
                  >
                    {isClustering ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Đang phân cụm dữ liệu...
                      </>
                    ) : (
                      <>
                        <BrainCircuit className="h-4 w-4" />
                        Huấn Luyện Phân Cụm K-Means
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Clustering Results View */}
            <div className="lg:col-span-2 space-y-4">
              {!clusteringResult ? (
                <Card className="border-dashed border-2 flex flex-col items-center justify-center p-12 text-center h-full min-h-[350px]">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-3">
                    <BrainCircuit className="h-6 w-6" />
                  </div>
                  <h3 className="font-semibold text-base">Phân Khúc Khách Hàng / Sản Phẩm</h3>
                  <p className="text-xs text-muted-foreground max-w-md mt-1 mb-4">
                    Ứng dụng thuật toán K-Means kết hợp giảm chiều PCA để tự động gom nhóm các đối tượng có đặc điểm chi tiêu và hành vi tương đồng.
                  </p>
                  <Button variant="outline" size="sm" onClick={handleRunClustering} disabled={selectedFeatures.length < 2} className="gap-2">
                    <Sparkles className="h-3.5 w-3.5" />
                    Chạy Phân Cụm ({nClusters} cụm)
                  </Button>
                </Card>
              ) : (
                <div className="space-y-4">
                  {/* Quality Score Bar */}
                  <div className="flex items-center justify-between p-4 rounded-lg bg-card border border-border shadow-sm">
                    <div>
                      <span className="text-xs font-semibold tracking-normal text-muted-foreground">Chỉ Số Silhouette Score</span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-2xl font-semibold text-foreground">{clusteringResult.silhouette_score}</span>
                        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-xs">
                          Chất lượng: {clusteringResult.quality_rating}
                        </Badge>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-muted-foreground">Thuật toán: K-Means (Scikit-Learn)</span>
                      <p className="text-xs font-medium text-foreground">Giảm chiều không gian đa biến với PCA</p>
                    </div>
                  </div>

                  {/* Cluster Persona Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {clusteringResult.cluster_stats.map((c) => (
                      <Card key={c.cluster_id} className="border-border p-3.5 bg-card ">
                        <div className="flex items-center justify-between pb-1">
                          <span className="text-xs font-semibold text-foreground">{c.business_label}</span>
                          <Badge variant="secondary" className="text-xs">
                            {c.count} bản ghi ({c.percentage}%)
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                          {c.description}
                        </p>
                        <div className="mt-2 pt-2 border-t border-border/50 grid grid-cols-2 gap-1.5 text-xs">
                          {Object.entries(c.feature_means).map(([feat, val]) => (
                            <div key={feat} className="flex justify-between">
                              <span className="text-muted-foreground truncate">{feat}:</span>
                              <span className="font-semibold text-foreground ml-1">{val.toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Clustering Scatter Plot & Sample Table */}
          {clusteringResult && (
            <div className="space-y-6">
              <Card className="border-border overflow-hidden shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between pb-2 bg-muted/20">
                  <div>
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-primary" />
                      Không Gian Phân Cụm 2D & Tâm Điểm (Centroids)
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Chiếu không gian đa biến thành 2 trục chính, làm nổi bật khoảng cách giữa các nhóm
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownloadChart(clusteringResult.chart_image, "phan_cum_kmeans.png")}
                    className="gap-1.5 text-xs"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Tải Biểu Đồ PNG
                  </Button>
                </CardHeader>
                <CardContent className="p-4 flex items-center justify-center bg-muted/30">
                  <ResultFigure src={clusteringResult.chart_image} alt="Biểu đồ phân cụm K-Means" />
                </CardContent>
              </Card>

              {/* Sample Clustered Records Table */}
              <Card className="border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <TableIcon className="h-4 w-4 text-primary" />
                    Dữ Liệu Mẫu Kèm Nhãn Phân Khúc (15 Dòng Đầu)
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/40">
                          {clusteringResult.sample_data.length > 0 &&
                            Object.keys(clusteringResult.sample_data[0]).map((key) => (
                              <TableHead key={key} className="text-xs font-semibold">
                                {key === "cluster_id" ? "Mã Cụm" : key === "cluster_label" ? "Phân Khúc Nghiệp Vụ" : key}
                              </TableHead>
                            ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {clusteringResult.sample_data.map((row, idx) => (
                          <TableRow key={idx}>
                            {Object.entries(row).map(([k, val]: any) => (
                              <TableCell key={k} className="text-xs">
                                {k === "cluster_label" ? (
                                  <Badge variant="outline" className="text-xs font-normal">
                                    {val}
                                  </Badge>
                                ) : typeof val === "number" ? (
                                  val.toLocaleString()
                                ) : (
                                  String(val)
                                )}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
