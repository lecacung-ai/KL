import type { ReactNode } from "react"

type PageHeadingProps = {
  eyebrow?: string
  title: string
  description?: ReactNode
  action?: ReactNode
}

/** Minimalist Enterprise SaaS Page Heading */
export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: PageHeadingProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 mb-4 border-b border-border/60 min-w-0">
      <div className="min-w-0 space-y-0.5">
        {eyebrow && (
          <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">
            {eyebrow}
          </p>
        )}
        <h1 className="text-lg sm:text-xl font-bold tracking-tight text-foreground truncate">
          {title}
        </h1>
        {description && (
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-2xl">
            {description}
          </p>
        )}
      </div>
      {action && (
        <div className="flex shrink-0 items-center gap-2">
          {action}
        </div>
      )}
    </div>
  )
}
