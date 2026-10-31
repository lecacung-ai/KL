import { Link, useRouterState } from "@tanstack/react-router"
import { ChevronRight, PanelLeft, Settings } from "lucide-react"

import { Button } from "@/components/ui/button"
import { SidebarTrigger } from "@/components/ui/sidebar"

const pageNames: Record<string, string> = {
  "/": "Tổng quan", "/datasets": "Kho dữ liệu", "/forecast": "Dự báo & phân nhóm",
  "/history": "Lịch sử phân tích", "/admin": "Quản lý người dùng",
  "/settings": "Cài đặt tài khoản", "/items": "Danh mục",
}

export function WorkspaceHeader() {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  return (
    <header className="finai-workspace-header">
      <div className="flex min-w-0 items-center gap-3">
        <SidebarTrigger aria-label="Mở hoặc thu gọn menu" className="size-10 rounded-xl" />
        <span className="h-5 w-px bg-border" aria-hidden="true" />
        <nav aria-label="Vị trí trang" className="flex min-w-0 items-center gap-2 text-sm">
          <Link to="/" className="hidden text-muted-foreground hover:text-foreground sm:inline">FinAI</Link>
          <ChevronRight className="hidden size-3.5 text-muted-foreground sm:block" aria-hidden="true" />
          <span className="truncate font-medium" aria-current="page">{pageNames[pathname] ?? "Không gian làm việc"}</span>
        </nav>
      </div>
      <div className="flex items-center gap-3">
        <span className="hidden items-center gap-2 text-xs text-muted-foreground lg:flex"><PanelLeft className="size-3.5" aria-hidden="true" /> Không gian làm việc của bạn</span>
        <Button asChild variant="ghost" size="icon" className="rounded-xl"><Link to="/settings" aria-label="Cài đặt tài khoản"><Settings className="size-4" /></Link></Button>
      </div>
    </header>
  )
}
