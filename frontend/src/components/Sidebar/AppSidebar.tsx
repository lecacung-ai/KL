import { Database, History, Home, TrendingUp, Users } from "lucide-react"

import { SidebarAppearance } from "@/components/Common/Appearance"
import { Logo } from "@/components/Common/Logo"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/sidebar"
import useAuth from "@/hooks/useAuth"
import { type Item, Main } from "./Main"
import { User } from "./User"

const baseItems: Item[] = [
  { icon: Home, title: "Tổng quan", path: "/" },
  { icon: Database, title: "Kho dữ liệu", path: "/datasets" },
  { icon: TrendingUp, title: "Dự báo & phân nhóm", path: "/forecast" },
  { icon: History, title: "Lịch sử phân tích", path: "/history" },
]

export function AppSidebar() {
  const { user: currentUser } = useAuth()

  const items = currentUser?.is_superuser
    ? [...baseItems, { icon: Users, title: "Người dùng", path: "/admin" }]
    : baseItems

  return (
    <Sidebar collapsible="icon" className="finai-sidebar border-r border-sidebar-border">
      <SidebarHeader className="px-4 py-6 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:items-center">
        <Logo variant="responsive" />
      </SidebarHeader>
      <SidebarContent className="gap-5 pt-5">
        <p className="px-6 text-[11px] font-semibold tracking-[0.12em] text-muted-foreground group-data-[collapsible=icon]:hidden">KHÔNG GIAN LÀM VIỆC</p>
        <Main items={items} />
      </SidebarContent>
      <SidebarFooter className="gap-2 border-t border-sidebar-border p-3">
        <SidebarAppearance />
        <User user={currentUser} />
      </SidebarFooter>
    </Sidebar>
  )
}

export default AppSidebar
