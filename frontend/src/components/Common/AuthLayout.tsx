import { Appearance } from "@/components/Common/Appearance"
import { Logo } from "@/components/Common/Logo"
import { Footer } from "./Footer"

interface AuthLayoutProps {
  children: React.ReactNode
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="relative min-h-svh w-full flex flex-col justify-between p-4 sm:p-6 bg-background">
      <header className="w-full flex items-center justify-between max-w-4xl mx-auto py-2">
        <Logo />
        <div className="flex items-center gap-2">
          <Appearance />
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center py-6 sm:py-8">
        <div className="w-full max-w-[420px] rounded-xl border border-border/80 bg-card p-6 sm:p-8 shadow-xs">
          {children}
        </div>
      </main>

      <div className="w-full max-w-4xl mx-auto py-3">
        <Footer />
      </div>
    </div>
  )
}
