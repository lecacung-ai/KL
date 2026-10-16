import { Link } from "@tanstack/react-router"
import { TrendingUp } from "lucide-react"

import { cn } from "@/lib/utils"

interface LogoProps {
  variant?: "full" | "icon" | "responsive"
  className?: string
  asLink?: boolean
}

export function Logo({
  variant = "full",
  className,
  asLink = true,
}: LogoProps) {
  const content = (
    <div className={cn("flex items-center gap-2.5 select-none", className)}>
      <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 text-white shadow-md shadow-blue-500/25">
        <TrendingUp className="size-5 stroke-[2.5]" />
      </div>
      <div
        className={cn(
          "flex flex-col leading-none",
          variant === "responsive" && "group-data-[collapsible=icon]:hidden",
          variant === "icon" && "hidden",
        )}
      >
        <div className="flex items-center gap-1.5">
          <span className="font-black text-lg tracking-tight bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 bg-clip-text text-transparent">
            FinAI
          </span>
          <span className="rounded-full bg-blue-500/10 px-1.5 py-0.5 text-[9px] font-bold text-blue-600 dark:text-blue-400 border border-blue-500/20">
            AI Assistant
          </span>
        </div>
        <span className="text-[10px] text-muted-foreground font-medium mt-1 truncate max-w-[140px]">
          Phân Tích & Dự Báo
        </span>
      </div>
    </div>
  )

  if (!asLink) {
    return content
  }

  return <Link to="/">{content}</Link>
}
