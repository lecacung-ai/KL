import { useRef, useState } from "react"
import axios from "axios"
import { Download, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { type Dataset, DatasetsService } from "@/services/datasetsService"

export function DownloadDatasetButton({ dataset, iconOnly = false }: {
  dataset: Dataset
  iconOnly?: boolean
}) {
  const [loading, setLoading] = useState(false)
  const pending = useRef(false)

  const download = async () => {
    if (pending.current) return
    const token = sessionStorage.getItem("access_token")
    if (!token) {
      toast.error("Vui lòng đăng nhập để tải tệp.")
      return
    }
    pending.current = true
    setLoading(true)
    try {
      const response = await axios.get<Blob>(DatasetsService.getDownloadUrl(dataset.id), {
        responseType: "blob",
        headers: { Authorization: `Bearer ${token}` },
        timeout: 60000,
      })
      // A response from a previous session must not download into a new session.
      if (sessionStorage.getItem("access_token") !== token) return
      const url = URL.createObjectURL(response.data)
      const link = document.createElement("a")
      link.href = url
      link.download = dataset.filename.replace(/[\\/]/g, "_")
      document.body.appendChild(link)
      try {
        link.click()
      } finally {
        link.remove()
        window.setTimeout(() => URL.revokeObjectURL(url), 10000)
      }
    } catch (error) {
      const status = axios.isAxiosError(error) ? error.response?.status : undefined
      const message = status === 401
        ? "Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại."
        : status === 403
          ? "Bạn không có quyền tải tệp này hoặc đường dẫn lưu trữ không hợp lệ."
          : status === 404
            ? "Không tìm thấy tệp hoặc dữ liệu đã bị xóa. Vui lòng làm mới kho dữ liệu."
            : status === 503
              ? "Kho lưu trữ tạm thời không truy cập được. Vui lòng thử lại sau."
              : "Không thể tải tệp. Vui lòng kiểm tra kết nối và thử lại."
      toast.error(message)
    } finally {
      pending.current = false
      setLoading(false)
    }
  }

  return (
    <Button type="button" variant={iconOnly ? "ghost" : "outline"}
      size={iconOnly ? "icon" : "sm"}
      className={iconOnly ? "size-8 text-muted-foreground hover:text-foreground" : "gap-1.5 h-9 font-medium"}
      aria-label={`Tải tệp gốc: ${dataset.filename}`} aria-busy={loading}
      title={loading ? "Đang tải tệp…" : "Tải về tệp gốc"} disabled={loading} onClick={download}>
      {loading ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : <Download aria-hidden="true" className="size-4" />}
      {!iconOnly && (loading ? "Đang tải…" : "Tải Tệp Gốc")}
    </Button>
  )
}
