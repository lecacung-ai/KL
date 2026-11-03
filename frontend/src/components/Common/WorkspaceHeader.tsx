import { Link, useRouterState } from "@tanstack/react-router"
import { ChevronRight, Settings } from "lucide-react"

import { Button } from "@/components/ui/button"
import { SidebarTrigger } from "@/components/ui/sidebar"

const pageNames: Record<string, string> = {
  "/": "Tổng quan",
  "/datasets": "Kho dữ liệu",
  "/forecast": "Dự báo & phân nhóm",
  "/history": "Lịch sử phân tích",
  "/admin": "Quản lý người dùng",
  "/settings": "Cài đặt tài khoản",
  "/items": "Danh mục",
}

export function WorkspaceHeader() {
  const pathname = useRouterState({ select: (state) => state.location.pathname })

  return (
    <header className="sticky top-0 z-20 flex h-12 items-center justify-between gap-3 border-b border-border/80 bg-background/85 px-4 backdrop-blur-md">
      <div className="flex min-w-0 items-center gap-2.5">
        <SidebarTrigger aria-label="Mở hoặc thu gọn menu" className="size-8 rounded-lg text-muted-foreground hover:text-foreground" />
        <span className="h-4 w-px bg-border/80" aria-hidden="true" />
        <nav aria-label="Vị trí trang" className="flex min-w-0 items-center gap-1.5 text-xs sm:text-sm">
          <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors font-medium">
            FinAI
          </Link>
          <ChevronRight className="size-3.5 text-muted-foreground/60 shrink-0" aria-hidden="true" />
          <span className="truncate font-semibold text-foreground" aria-current="page">
            {pageNames[pathname] ?? "Không gian làm việc"}
          </span>
        </nav>
      </div>

      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon" className="size-8 rounded-lg text-muted-foreground hover:text-foreground" title="Cài đặt tài khoản">
          <Link to="/settings" aria-label="Cài đặt tài khoản">
            <Settings className="size-4" />
          </Link>
        </Button>
      </div>
    </header>
  )
}
