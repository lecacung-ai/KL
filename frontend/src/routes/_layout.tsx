import { createFileRoute, Outlet, redirect } from "@tanstack/react-router"

import { Footer } from "@/components/Common/Footer"
import AppSidebar from "@/components/Sidebar/AppSidebar"
import { WorkspaceHeader } from "@/components/Common/WorkspaceHeader"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { isLoggedIn } from "@/hooks/useAuth"

export const Route = createFileRoute("/_layout")({
  component: Layout,
  beforeLoad: async () => {
    if (!isLoggedIn()) {
      throw redirect({
        to: "/login",
      })
    }
  },
})

function Layout() {
  return (
    <SidebarProvider>
      <a href="#main-content" className="finai-skip-link">Đi đến nội dung chính</a>
      <AppSidebar />
      <SidebarInset className="finai-workspace min-w-0">
        <WorkspaceHeader />
        <main id="main-content" className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-9 lg:py-8">
          <div className="mx-auto w-full min-w-0 max-w-7xl">
            <Outlet />
          </div>
        </main>
        <Footer />
      </SidebarInset>
    </SidebarProvider>
  )
}
