import { Database, History, Home, Users } from "lucide-react"

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
  { icon: History, title: "Lịch sử phân tích", path: "/history" },
]

export function AppSidebar() {
  const { user: currentUser } = useAuth()

  const items = currentUser?.is_superuser
    ? [...baseItems, { icon: Users, title: "Quản lý người dùng", path: "/admin" }]
    : baseItems

  return (
    <Sidebar collapsible="icon" className="finai-sidebar border-r border-sidebar-border bg-sidebar">
      <SidebarHeader className="px-3.5 py-3.5 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:items-center">
        <Logo variant="responsive" />
      </SidebarHeader>
      <SidebarContent className="gap-3 px-2 pt-1">
        <p className="px-2 text-[10px] font-semibold tracking-wider text-muted-foreground/60 uppercase group-data-[collapsible=icon]:hidden">
          Không Gian Làm Việc
        </p>
        <Main items={items} />
      </SidebarContent>
      <SidebarFooter className="gap-1.5 border-t border-sidebar-border p-2">
        <SidebarAppearance />
        <User user={currentUser} />
      </SidebarFooter>
    </Sidebar>
  )
}

export default AppSidebar
