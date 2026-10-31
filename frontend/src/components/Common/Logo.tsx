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
    <div data-logo className={cn("flex items-center gap-2.5 select-none", className)}>
      <div className="flex size-10 shrink-0 items-center justify-center rounded-[14px] bg-primary text-primary-foreground">
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
          <span className="text-xl font-semibold tracking-tight text-foreground">
            FinAI
          </span>
        </div>
        <span className="mt-1 max-w-[160px] truncate text-xs text-muted-foreground">
          Dữ liệu & góc nhìn
        </span>
      </div>
    </div>
  )

  if (!asLink) {
    return content
  }

  return <Link to="/">{content}</Link>
}
