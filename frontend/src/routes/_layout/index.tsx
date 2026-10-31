import { useState, useEffect } from "react"
import { createFileRoute, Link } from "@tanstack/react-router"
import { Database, TrendingUp, Activity, ArrowUpRight, BarChart3, Layers, ArrowRight, MessageSquareText, FileSpreadsheet } from "lucide-react"

import useAuth from "@/hooks/useAuth"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PageHeading } from "@/components/Common/PageHeading"
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
    <div className="min-w-0 space-y-10 pb-10">
      <section className="finai-dashboard-hero overflow-hidden" aria-labelledby="dashboard-welcome">
        <div className="finai-dashboard-copy relative z-10 flex min-h-[430px] flex-col justify-between p-6 sm:p-9 xl:p-12">
          <div>
            <h1 id="dashboard-welcome" className="finai-eyebrow text-[#f5c579]">Tổng quan</h1>
            <h2 className="max-w-2xl text-3xl leading-[1.08] font-semibold tracking-[-.045em] text-white sm:text-5xl">
              Chào {currentUser?.full_name || currentUser?.email?.split("@")[0]}, hôm nay bạn muốn hiểu điều gì từ dữ liệu?
            </h2>
            <p className="mt-5 max-w-xl text-sm leading-7 text-white/75 sm:text-base">
              Bắt đầu từ một bảng dữ liệu, đặt câu hỏi bằng tiếng Việt và giữ mọi kết quả trong cùng một luồng làm việc.
            </p>
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" className="bg-[#f5c579] text-[#163844] hover:bg-[#ffd99c]">
              <a href="#phan-tich"><MessageSquareText className="size-4" /> Bắt đầu phân tích</a>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white">
              <Link to="/datasets"><Database className="size-4" /> Xem kho dữ liệu</Link>
            </Button>
          </div>
        </div>
        <div className="finai-dashboard-art relative min-h-[290px] lg:min-h-full">
          <img src="/images/finai-data-story.png" alt="Minh họa hành trình từ bảng dữ liệu đến quyết định" className="absolute inset-0 size-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#123946] via-[#123946]/20 to-transparent lg:from-[#123946]/25" />
          <div className="absolute right-5 bottom-5 left-5 rounded-2xl border border-white/25 bg-white/85 p-4 text-[#183044] shadow-xl backdrop-blur-md sm:right-8 sm:bottom-8 sm:left-auto sm:w-[310px]">
            <div className="flex items-center justify-between gap-4"><span className="text-xs font-semibold tracking-wide uppercase">Dữ liệu hiện có</span><Database className="size-4 text-[#0f766e]" /></div>
            <p className="mt-3 text-3xl font-semibold tracking-tight">{totalDatasets} <span className="text-sm font-medium text-[#607584]">tệp dữ liệu</span></p>
            <p className="mt-1 text-xs text-[#607584]">{totalRecords.toLocaleString()} bản ghi · {formatFileSize(totalBytes)}</p>
          </div>
        </div>
      </section>

      <section className="finai-insight-strip" aria-label="Tổng quan dữ liệu">
        {[
          { icon: Database, label: "Nguồn dữ liệu", value: `${totalDatasets} tệp`, note: `${formatFileSize(totalBytes)} đã lưu` },
          { icon: Layers, label: "Cột dữ liệu số", value: totalDatasets === 0 ? "—" : totalNumericCols, note: "Nhận diện từ cấu trúc tệp" },
          { icon: Activity, label: "Chất lượng dữ liệu", value: totalDatasets === 0 ? "—" : `${avgHealthScore}/100`, note: "Theo metadata hiện có" },
          { icon: TrendingUp, label: "Dữ liệu cho dự báo", value: totalDatasets === 0 ? "—" : totalDatasets, note: totalDatasets === 0 ? "Thêm tệp để bắt đầu" : "Nguồn có thể lựa chọn" },
        ].map(({ icon: Icon, label, value, note }) => (
          <div key={label} className="finai-insight-item">
            <span className="finai-insight-icon"><Icon className="size-5" /></span>
            <div className="min-w-0"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p><p className="mt-1 truncate text-xs text-muted-foreground">{note}</p></div>
          </div>
        ))}
      </section>

      <div className="grid items-stretch gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,.75fr)]">
        <section className="finai-data-shelf">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b px-5 py-5 sm:px-7">
            <div><p className="finai-eyebrow">Gần đây</p><h2 className="text-xl font-semibold">Những tệp bạn đang làm việc</h2></div>
            <Link to="/datasets" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">Đi tới kho dữ liệu <ArrowRight className="size-4" /></Link>
          </div>
          {loading ? <div className="p-10 text-center text-sm text-muted-foreground" role="status">Đang tải dữ liệu…</div> : totalDatasets === 0 ? (
            <div className="grid min-h-[280px] place-items-center px-6 py-10 text-center">
              <div><span className="mx-auto flex size-16 items-center justify-center rounded-[22px] bg-secondary text-primary"><FileSpreadsheet className="size-7" /></span><h3 className="mt-5 text-lg font-semibold">Bắt đầu với bảng dữ liệu đầu tiên</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">Thêm CSV hoặc Excel để xem cấu trúc, chọn cột và đặt câu hỏi.</p><Button asChild className="mt-5"><Link to="/datasets">Thêm dữ liệu <ArrowRight className="size-4" /></Link></Button></div>
            </div>
          ) : <div className="grid gap-px bg-border sm:grid-cols-2">{datasets.slice(0, 4).map((d, index) => (
            <div key={d.id} className="group min-w-0 bg-card p-5 transition-colors hover:bg-muted/30 sm:p-6">
              <div className="flex items-start justify-between gap-3"><span className={`flex size-11 items-center justify-center rounded-2xl ${index % 2 === 0 ? "bg-[#e4f2ee] text-[#0f766e]" : "bg-[#fbedd7] text-[#9b6428]"}`}><BarChart3 className="size-5" /></span><Badge variant="outline" className="text-xs">{d.status === "ready" ? "Sẵn sàng" : d.status}</Badge></div>
              <p className="mt-6 break-all font-semibold leading-6">{d.filename}</p>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground"><span>{d.row_count.toLocaleString()} dòng</span><span>{d.column_count} cột</span><span>Phiên bản {d.version}</span></div>
            </div>
          ))}</div>}
        </section>

        <aside className="finai-next-step flex flex-col justify-between overflow-hidden p-6 sm:p-8">
          <div><span className="flex size-12 items-center justify-center rounded-2xl bg-[#f5c579] text-[#183044]"><TrendingUp className="size-5" /></span><p className="finai-eyebrow mt-8 text-[#f5c579]">Khám phá tiếp</p><h2 className="text-2xl font-semibold tracking-tight text-white">Nhìn xa hơn từ chuỗi dữ liệu của bạn.</h2><p className="mt-4 text-sm leading-7 text-white/70">Dùng dữ liệu theo thời gian để xem xu hướng hoặc tìm những nhóm có đặc điểm tương đồng.</p></div>
          <Button asChild variant="outline" className="mt-8 w-full border-white/25 bg-white/10 text-white hover:bg-white/20 hover:text-white"><Link to="/forecast">Mở dự báo & phân nhóm <ArrowUpRight className="size-4" /></Link></Button>
        </aside>
      </div>

      <section id="phan-tich" className="scroll-mt-24 space-y-5">
        <PageHeading eyebrow="Không gian phân tích" title="Đặt câu hỏi cho dữ liệu"
          description="Một quy trình rõ ràng từ chọn nguồn, thu hẹp phạm vi đến đọc kết quả và biểu đồ." />
        <DataAnalyzer />
      </section>
    </div>
  )
}
