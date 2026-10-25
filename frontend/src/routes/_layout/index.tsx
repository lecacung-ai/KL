import { useState, useEffect } from "react"
import { createFileRoute, Link } from "@tanstack/react-router"
import {
  Database,
  TrendingUp,
  DollarSign,
  Activity,
  ArrowUpRight,
  Sparkles,
  BarChart3,
  Layers,
  ArrowRight,
} from "lucide-react"

import useAuth from "@/hooks/useAuth"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import DataAnalyzer from "../../components/DataAnalyzer"
import { DatasetsService, Dataset } from "@/services/datasetsService"

export const Route = createFileRoute("/_layout/")({
  component: Dashboard,
  head: () => ({
    meta: [
      {
        title: "Bảng Điều Khiển Tài Chính - FinAI Enterprise",
      },
    ],
  }),
})

function Dashboard() {
  const { user: currentUser } = useAuth()
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    DatasetsService.getDatasets()
      .then((res) => setDatasets(res.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const totalRecords = datasets.reduce((sum, d) => sum + (d.row_count || 0), 0)
  const totalDatasets = datasets.length
  const totalBytes = datasets.reduce((sum, d) => sum + (d.size_bytes || 0), 0)

  // Điểm sức khỏe dữ liệu thực tế tính từ schema_info của các tệp đã tải lên
  const avgHealthScore = totalDatasets > 0
    ? Math.round(
        datasets.reduce((acc, d) => {
          try {
            const profile = JSON.parse(d.schema_info || "{}")
            return acc + (profile.health_score ?? 100)
          } catch {
            return acc + 100
          }
        }, 0) / totalDatasets
      )
    : 0

  // Đếm tổng số cột chỉ số số học / tài chính đã nhận diện
  const totalNumericCols = datasets.reduce((sum, d) => {
    try {
      const profile = JSON.parse(d.schema_info || "{}")
      const cols = profile.columns || []
      const numCols = cols.filter(
        (c: any) =>
          c.type_category?.includes("Số") ||
          c.dtype?.includes("int") ||
          c.dtype?.includes("float")
      )
      return sum + numCols.length
    } catch {
      return sum
    }
  }, 0)

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Top Executive Welcome & Quick Action Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
              Tổng Quan Tài Chính & Kinh Doanh
            </h1>
            <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 gap-1.5 font-semibold text-xs">
              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" /> Hệ thống sẵn sàng
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Chào mừng trở lại, <span className="font-semibold text-foreground">{currentUser?.full_name || currentUser?.email?.split("@")[0]}</span>. Dưới đây là phân tích dữ liệu và dự báo tài chính doanh nghiệp mới nhất.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link to="/datasets">
            <Button className="bg-blue-600 hover:bg-blue-700 text-white font-semibold gap-2 shadow-md shadow-blue-500/20 h-10 px-4">
              <Database className="size-4" /> Kho Dữ Liệu Doanh Nghiệp
            </Button>
          </Link>
        </div>
      </div>

      {/* 4 Professional KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Doanh Thu Dự Báo / Trạng Thái Dự Báo */}
        <div className="rounded-xl border bg-card p-5 shadow-sm space-y-3 relative overflow-hidden group hover:border-blue-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Dự Báo Tài Chính (Kỳ Tới)
            </span>
            <div className="flex size-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
              <DollarSign className="size-4.5" />
            </div>
          </div>
          <div className="space-y-1">
            <h3 className="text-2xl font-black text-foreground">
              {totalDatasets === 0 ? "--" : "Sẵn sàng"}
            </h3>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
              {totalDatasets === 0 ? (
                <span>Chưa nạp tệp dữ liệu</span>
              ) : (
                <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <ArrowUpRight className="size-3.5" /> Khai thác từ {totalDatasets} tệp nguồn
                </span>
              )}
            </div>
          </div>
          <div className="w-full bg-muted/60 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-blue-600 h-full rounded-full transition-all"
              style={{ width: totalDatasets === 0 ? "0%" : "100%" }}
            />
          </div>
        </div>

        {/* Card 2: Chỉ Số Định Lượng Đã Khai Thác */}
        <div className="rounded-xl border bg-card p-5 shadow-sm space-y-3 relative overflow-hidden group hover:border-emerald-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Chỉ Số Định Lượng Khai Thác
            </span>
            <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
              <TrendingUp className="size-4.5" />
            </div>
          </div>
          <div className="space-y-1">
            <h3 className="text-2xl font-black text-foreground">
              {totalDatasets === 0 ? "--" : `${totalNumericCols} chỉ số`}
            </h3>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
              {totalDatasets === 0 ? (
                <span>Cần nạp báo cáo tài chính</span>
              ) : (
                <span className="text-emerald-600 dark:text-emerald-400">
                  Doanh thu, chi phí, sản lượng...
                </span>
              )}
            </div>
          </div>
          <div className="w-full bg-muted/60 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all"
              style={{ width: totalDatasets === 0 ? "0%" : "100%" }}
            />
          </div>
        </div>

        {/* Card 3: Quy Mô Kho Dữ Liệu */}
        <div className="rounded-xl border bg-card p-5 shadow-sm space-y-3 relative overflow-hidden group hover:border-indigo-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Quy Mô Kho Dữ Liệu
            </span>
            <div className="flex size-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
              <Database className="size-4.5" />
            </div>
          </div>
          <div className="space-y-1">
            <h3 className="text-2xl font-black text-foreground">
              {totalDatasets} tệp <span className="text-sm font-normal text-muted-foreground">({formatFileSize(totalBytes)})</span>
            </h3>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
              <Layers className="size-3.5 text-indigo-500" /> {totalRecords.toLocaleString()} bản ghi phân tích
            </div>
          </div>
          <div className="w-full bg-muted/60 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-indigo-600 h-full rounded-full transition-all"
              style={{ width: `${Math.min(100, totalDatasets * 25)}%` }}
            />
          </div>
        </div>

        {/* Card 4: Sức Khỏe Dữ Liệu Doanh Nghiệp */}
        <div className="rounded-xl border bg-card p-5 shadow-sm space-y-3 relative overflow-hidden group hover:border-cyan-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Chất Lượng Dữ Liệu Nguồn
            </span>
            <div className="flex size-9 items-center justify-center rounded-lg bg-cyan-50 text-cyan-600 dark:bg-cyan-950/60 dark:text-cyan-400">
              <Activity className="size-4.5" />
            </div>
          </div>
          <div className="space-y-1">
            <h3 className="text-2xl font-black text-foreground">
              {totalDatasets === 0 ? "--" : `${avgHealthScore}/100`}
            </h3>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
              {totalDatasets === 0 ? (
                <span>Chưa có tệp để đánh giá</span>
              ) : (
                <span className="text-cyan-600 dark:text-cyan-400 font-semibold">
                  {avgHealthScore >= 90 ? "Độ sạch dữ liệu đạt chuẩn cao" : "Cần tự động làm sạch"}
                </span>
              )}
            </div>
          </div>
          <div className="w-full bg-muted/60 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-cyan-500 h-full rounded-full transition-all"
              style={{ width: `${avgHealthScore}%` }}
            />
          </div>
        </div>
      </div>

      {/* Visual Analytics Overview Chart & Data Hub Quick View */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Monthly Trend Visualization */}
        <div className="lg:col-span-2 rounded-2xl border bg-card p-6 shadow-sm space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
            <div>
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <BarChart3 className="size-5 text-blue-600 dark:text-blue-400" />
                Diễn Biến Dữ Liệu & Chỉ Số Doanh Nghiệp
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Tổng hợp tình trạng các tệp báo cáo kinh doanh được nạp vào hệ thống
              </p>
            </div>

            {totalDatasets > 0 && (
              <div className="flex items-center gap-3 text-xs">
                <Link to="/forecast">
                  <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8">
                    <TrendingUp className="size-3.5 text-primary" /> Mở Studio Dự Báo ML
                  </Button>
                </Link>
              </div>
            )}
          </div>

          {/* Dynamic Content: Empty State when 0 files, or Dataset Summary when files exist */}
          {totalDatasets === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center space-y-3 h-56">
              <div className="size-12 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <BarChart3 className="size-6" />
              </div>
              <div className="space-y-1">
                <h3 className="font-semibold text-sm text-foreground">Kho Dữ Liệu Đang Trống</h3>
                <p className="text-xs text-muted-foreground max-w-md">
                  Chưa có tệp dữ liệu kinh doanh nào được nạp. Hãy tải lên tệp Excel (.xlsx) hoặc CSV đầu tiên để hệ thống tự động bóc tách chỉ số và trực quan hóa biểu đồ thực tế.
                </p>
              </div>
              <Link to="/datasets">
                <Button size="sm" variant="default" className="gap-1.5 text-xs font-semibold shadow-sm">
                  <Database className="size-3.5" /> Nạp tệp dữ liệu ngay
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {datasets.slice(0, 4).map((d) => (
                  <div
                    key={d.id}
                    className="p-3.5 rounded-xl border bg-muted/20 flex flex-col justify-between space-y-2 hover:bg-muted/40 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-foreground truncate max-w-[200px]">
                        {d.filename}
                      </span>
                      <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-500 border-emerald-500/30">
                        {d.status === "ready" ? "Đã sẵn sàng" : d.status}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground font-mono">
                      <span>{d.row_count.toLocaleString()} dòng • {d.column_count} cột</span>
                      <span>v{d.version}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 flex items-center justify-between">
                <span className="text-xs text-foreground/90">
                  Đã sẵn sàng {totalDatasets} tệp dữ liệu ({totalRecords.toLocaleString()} dòng). Hãy sử dụng Trợ lý AI bên dưới để ra lệnh phân tích tức thì.
                </span>
                <Link to="/forecast">
                  <Button size="sm" variant="ghost" className="text-xs text-primary hover:text-primary gap-1">
                    Chạy dự báo <ArrowRight className="size-3.5" />
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Right 1 Col: Quick Data Hub Status */}
        <div className="rounded-2xl border bg-card p-6 shadow-sm flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <Database className="size-4.5 text-indigo-500" />
                Kho Tệp Đang Khai Thác
              </h2>
              <Link to="/datasets" className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5">
                Xem tất cả <ArrowRight className="size-3" />
              </Link>
            </div>

            {loading ? (
              <p className="text-xs text-muted-foreground py-4 text-center">Đang nạp dữ liệu...</p>
            ) : datasets.length === 0 ? (
              <div className="py-6 text-center space-y-2">
                <p className="text-xs text-muted-foreground">Kho dữ liệu hiện đang trống.</p>
                <Link to="/datasets">
                  <Button size="sm" variant="outline" className="text-xs">
                    Tải tệp Excel/CSV lên
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-2.5">
                {datasets.slice(0, 3).map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-2.5 rounded-xl border bg-muted/30 hover:bg-muted/50 transition-colors">
                    <div className="min-w-0 pr-2">
                      <p className="text-xs font-semibold text-foreground truncate">{item.filename}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">
                        v{item.version} • {item.row_count} dòng • {item.column_count} cột
                      </p>
                    </div>
                    <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 shrink-0 font-medium">
                      Sẵn sàng
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-blue-500/20 bg-blue-50/30 dark:bg-blue-950/20 p-3.5 space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-blue-700 dark:text-blue-300">
              <Sparkles className="size-3.5" /> Trợ Lý Thông Minh Sẵn Sàng
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Bạn có thể sử dụng khung điều khiển AI phía dưới để đặt câu hỏi trực tiếp trên bất kỳ tệp dữ liệu kinh doanh nào.
            </p>
          </div>
        </div>
      </div>

      {/* Main AI Data Analytics Terminal Component */}
      <DataAnalyzer />
    </div>
  )
}
