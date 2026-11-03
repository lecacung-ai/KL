import { PageHeading } from "@/components/Common/PageHeading"
import { createFileRoute } from "@tanstack/react-router"

import ChangePassword from "@/components/UserSettings/ChangePassword"
import DeleteAccount from "@/components/UserSettings/DeleteAccount"
import UserInformation from "@/components/UserSettings/UserInformation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import useAuth from "@/hooks/useAuth"

const tabsConfig = [
  { value: "my-profile", title: "Thông tin cá nhân", component: UserInformation },
  { value: "password", title: "Mật khẩu", component: ChangePassword },
  { value: "danger-zone", title: "Quản lý tài khoản", component: DeleteAccount },
]

export const Route = createFileRoute("/_layout/settings")({
  component: UserSettings,
  head: () => ({
    meta: [
      {
        title: "Cài đặt tài khoản - FinAI",
      },
    ],
  }),
})

function UserSettings() {
  const { user: currentUser } = useAuth()
  const finalTabs = currentUser?.is_superuser
    ? tabsConfig.slice(0, 3)
    : tabsConfig

  if (!currentUser) {
    return null
  }

  return (
    <div className="flex flex-col gap-5 w-full min-w-0 max-w-full">
      <PageHeading title="Cài đặt tài khoản" description="Thông tin cá nhân, mật khẩu và tùy chọn tài khoản." />

      <Tabs defaultValue="my-profile" className="w-full min-w-0">
        <TabsList className="h-8.5 bg-muted/60 p-0.5">
          {finalTabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className="text-xs h-7.5 px-3">
              {tab.title}
            </TabsTrigger>
          ))}
        </TabsList>
        {finalTabs.map((tab) => (
          <TabsContent key={tab.value} value={tab.value} className="pt-2 min-w-0">
            <tab.component />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
