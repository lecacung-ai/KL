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
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-2xs">
        <TrendingUp className="size-4.5 stroke-[2.5]" />
      </div>
      <div
        className={cn(
          "flex flex-col leading-tight min-w-0",
          variant === "responsive" && "group-data-[collapsible=icon]:hidden",
          variant === "icon" && "hidden",
        )}
      >
        <div className="flex items-center gap-1.5">
          <span className="text-base font-bold tracking-tight text-foreground">
            FinAI
          </span>
        </div>
        <span className="truncate text-[10px] font-medium text-muted-foreground/80">
          AI Data Workspace
        </span>
      </div>
    </div>
  )

  if (!asLink) {
    return content
  }

  return <Link to="/">{content}</Link>
}
