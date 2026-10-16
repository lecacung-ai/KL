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
        {/* Card 1: Doanh Thu Dự Báo */}
        <div className="rounded-xl border bg-card p-5 shadow-sm space-y-3 relative overflow-hidden group hover:border-blue-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Doanh Thu Kỳ Tới (Dự Báo)
            </span>
            <div className="flex size-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
              <DollarSign className="size-4.5" />
            </div>
          </div>
          <div className="space-y-1">
            <h3 className="text-2xl font-black text-foreground">3.480.000.000 ₫</h3>
            <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
              <ArrowUpRight className="size-3.5" /> +14.8% <span className="text-muted-foreground font-normal">so với cùng kỳ</span>
            </div>
          </div>
          <div className="w-full bg-muted/60 h-1.5 rounded-full overflow-hidden">
            <div className="bg-blue-600 h-full rounded-full w-[78%]" />
          </div>
        </div>

        {/* Card 2: Dòng Tiền & Tỷ Suất Lợi Nhuận */}
        <div className="rounded-xl border bg-card p-5 shadow-sm space-y-3 relative overflow-hidden group hover:border-emerald-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Biên Lợi Nhuận Gộp
            </span>
            <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
              <TrendingUp className="size-4.5" />
            </div>
          </div>
          <div className="space-y-1">
            <h3 className="text-2xl font-black text-foreground">36.2%</h3>
            <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
              <ArrowUpRight className="size-3.5" /> +2.4% <span className="text-muted-foreground font-normal">mục tiêu 35%</span>
            </div>
          </div>
          <div className="w-full bg-muted/60 h-1.5 rounded-full overflow-hidden">
            <div className="bg-emerald-500 h-full rounded-full w-[88%]" />
          </div>
        </div>

        {/* Card 3: Dữ Liệu Đang Giám Sát */}
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
            <div className="bg-indigo-600 h-full rounded-full w-[65%]" />
          </div>
        </div>

        {/* Card 4: Sức Khỏe Tài Chính Doanh Nghiệp */}
        <div className="rounded-xl border bg-card p-5 shadow-sm space-y-3 relative overflow-hidden group hover:border-cyan-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Chỉ Số Sức Khỏe Tài Chính
            </span>
            <div className="flex size-9 items-center justify-center rounded-lg bg-cyan-50 text-cyan-600 dark:bg-cyan-950/60 dark:text-cyan-400">
              <Activity className="size-4.5" />
            </div>
          </div>
          <div className="space-y-1">
            <h3 className="text-2xl font-black text-foreground">92/100</h3>
            <div className="flex items-center gap-1.5 text-xs text-cyan-600 dark:text-cyan-400 font-semibold">
              <span>Đạt chuẩn tín dụng A+</span>
            </div>
          </div>
          <div className="w-full bg-muted/60 h-1.5 rounded-full overflow-hidden">
            <div className="bg-cyan-500 h-full rounded-full w-[92%]" />
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
                Diễn Biến Doanh Thu & Chi Phí Doanh Nghiệp
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Số liệu tổng hợp các kỳ gần nhất kèm dự báo xu hướng 2 tháng tới
              </p>
            </div>

            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 font-medium">
                <span className="size-2.5 rounded-full bg-blue-600" /> Doanh thu thực tế
              </span>
              <span className="flex items-center gap-1.5 font-medium">
                <span className="size-2.5 rounded-full bg-rose-500" /> Chi phí vận hành
              </span>
              <span className="flex items-center gap-1.5 font-medium">
                <span className="size-2.5 rounded-full bg-indigo-400 border border-dashed border-indigo-600" /> Dự báo tương lai
              </span>
            </div>
          </div>

          {/* Interactive Chart Graphic */}
          <div className="space-y-3 pt-2">
            <div className="grid grid-cols-7 gap-2 sm:gap-4 items-end h-52 pt-4 px-2">
              {[
                { month: "T1", rev: 180, exp: 90, isFuture: false },
                { month: "T2", rev: 220, exp: 110, isFuture: false },
                { month: "T3", rev: 310, exp: 130, isFuture: false },
                { month: "T4", rev: 270, exp: 115, isFuture: false },
                { month: "T5", rev: 390, exp: 160, isFuture: false },
                { month: "T6 (Dự kiến)", rev: 430, exp: 175, isFuture: true },
                { month: "T7 (Dự kiến)", rev: 470, exp: 190, isFuture: true },
              ].map((item, idx) => (
                <div key={idx} className="flex flex-col items-center gap-2 h-full justify-end group">
                  <div className="flex items-end gap-1.5 w-full justify-center h-full">
                    {/* Revenue Bar */}
                    <div
                      style={{ height: `${(item.rev / 500) * 100}%` }}
                      className={`w-4 sm:w-6 rounded-t-md transition-all duration-300 group-hover:opacity-90 relative ${
                        item.isFuture
                          ? "bg-gradient-to-t from-indigo-500 to-indigo-400 border border-dashed border-indigo-300"
                          : "bg-gradient-to-t from-blue-700 to-blue-500"
                      }`}
                      title={`Doanh thu: ${item.rev} triệu`}
                    />
                    {/* Expense Bar */}
                    <div
                      style={{ height: `${(item.exp / 500) * 100}%` }}
                      className={`w-3 sm:w-5 rounded-t-md transition-all duration-300 group-hover:opacity-90 ${
                        item.isFuture
                          ? "bg-gradient-to-t from-rose-400 to-rose-300 border border-dashed border-rose-200"
                          : "bg-gradient-to-t from-rose-600 to-rose-400"
                      }`}
                      title={`Chi phí: ${item.exp} triệu`}
                    />
                  </div>
                  <span className={`text-[11px] font-medium text-center truncate max-w-full ${item.isFuture ? "text-indigo-600 dark:text-indigo-400 font-bold" : "text-muted-foreground"}`}>
                    {item.month}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground text-center italic">
              * Biểu đồ mô phỏng đường hồi quy xu hướng doanh thu và chi phí chuỗi thời gian của doanh nghiệp.
            </p>
          </div>
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
