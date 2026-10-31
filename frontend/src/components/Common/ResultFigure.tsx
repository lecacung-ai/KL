import { useEffect, useRef, useState } from "react"
import { Maximize2, Minimize2 } from "lucide-react"

import { Button } from "@/components/ui/button"

/** Expands the same image element; does not fetch, duplicate or transform its data. */
export function ResultFigure({ src, alt }: { src: string; alt: string }) {
  const [expanded, setExpanded] = useState(false)
  const button = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!expanded) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    button.current?.focus()
    return () => {
      document.body.style.overflow = previousOverflow
      button.current?.focus()
    }
  }, [expanded])

  return (
    <div
      className={expanded ? "finai-figure finai-figure-expanded" : "finai-figure"}
      role={expanded ? "dialog" : undefined}
      aria-modal={expanded || undefined}
      aria-label={expanded ? alt : undefined}
      onKeyDown={(event) => {
        if (!expanded) return
        if (event.key === "Escape") {
          event.stopPropagation()
          setExpanded(false)
        }
        if (event.key === "Tab") {
          event.preventDefault()
          button.current?.focus()
        }
      }}
    >
      <div className="flex shrink-0 items-center justify-between gap-3 p-3">
        <p className="text-xs text-muted-foreground">{expanded ? alt : "Biểu đồ từ kết quả phân tích"}</p>
        <Button ref={button} type="button" variant="outline" size="sm" onClick={() => setExpanded(!expanded)}>
          {expanded ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          {expanded ? "Thu gọn biểu đồ" : "Mở lớn biểu đồ"}
        </Button>
      </div>
      <div className="finai-figure-canvas">
        <img src={src} alt={alt} className="finai-results-image" />
      </div>
    </div>
  )
}
