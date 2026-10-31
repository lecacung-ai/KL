import type { ReactNode } from "react"

type PageHeadingProps = {
  eyebrow?: string
  title: string
  description: ReactNode
  action?: ReactNode
}

/** Presentation only: no queries, mutations or business state. */
export function PageHeading({ eyebrow = "Không gian làm việc", title, description, action }: PageHeadingProps) {
  return (
    <div className="finai-page-heading">
      <div className="min-w-0 max-w-3xl">
        <p className="finai-eyebrow">{eyebrow}</p>
        <h1 className="finai-page-title">{title}</h1>
        <p className="finai-page-description">{description}</p>
      </div>
      {action && <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>}
    </div>
  )
}
