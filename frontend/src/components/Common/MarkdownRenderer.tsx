import React from "react"

interface MarkdownRendererProps {
  content: string
  className?: string
}

function renderInline(text: string): React.ReactNode[] {
  if (!text) return []

  // Tokenize inline markdown patterns:
  // 1. Bold code: **`code`**
  // 2. Bold italic: ***text***
  // 3. Bold: **text**
  // 4. Italic: *text*
  // 5. Inline code: `code`
  // 6. Links: [label](url)
  const regex = /(\*\*`[^`]+`\*\*|\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g

  const parts = text.split(regex)
  return parts.map((part, index) => {
    if (!part) return null

    // 1. Bold code: **`code`**
    if (part.startsWith("**`") && part.endsWith("`**") && part.length >= 6) {
      const code = part.slice(3, -3)
      return (
        <strong key={index} className="font-semibold text-foreground">
          <code className="px-1.5 py-0.5 rounded bg-primary/10 text-primary font-mono text-[11px] font-semibold border border-primary/20">
            {code}
          </code>
        </strong>
      )
    }

    // 2. Bold italic: ***text***
    if (part.startsWith("***") && part.endsWith("***") && part.length >= 6) {
      const inner = part.slice(3, -3)
      return (
        <strong key={index} className="font-semibold text-foreground">
          <em className="italic">{inner}</em>
        </strong>
      )
    }

    // 3. Bold: **text**
    if (part.startsWith("**") && part.endsWith("**") && part.length >= 4) {
      const inner = part.slice(2, -2)
      return (
        <strong key={index} className="font-semibold text-foreground">
          {renderInline(inner)}
        </strong>
      )
    }

    // 4. Italic: *text*
    if (part.startsWith("*") && part.endsWith("*") && part.length >= 2) {
      const inner = part.slice(1, -1)
      return (
        <em key={index} className="italic text-foreground/90">
          {inner}
        </em>
      )
    }

    // 5. Inline code: `code`
    if (part.startsWith("`") && part.endsWith("`") && part.length >= 2) {
      const code = part.slice(1, -1)
      return (
        <code
          key={index}
          className="px-1.5 py-0.5 rounded bg-muted font-mono text-[11px] text-primary font-medium border border-border/60"
        >
          {code}
        </code>
      )
    }

    // 6. Links: [label](url)
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
    if (linkMatch) {
      return (
        <a
          key={index}
          href={linkMatch[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline hover:text-primary/80 transition-colors"
        >
          {linkMatch[1]}
        </a>
      )
    }

    // Regular plain text
    return <React.Fragment key={index}>{part}</React.Fragment>
  })
}

function parseTableRow(line: string): string[] {
  let trimmed = line.trim()
  if (trimmed.startsWith("|")) trimmed = trimmed.slice(1)
  if (trimmed.endsWith("|")) trimmed = trimmed.slice(0, -1)
  return trimmed.split("|").map((c) => c.trim())
}

function isTableDelimiter(line: string): boolean {
  return /^\|?\s*(:?-{2,}:?)\s*(\|\s*(:?-{2,}:?)\s*)+\|?$/.test(line.trim())
}

function parseAlignments(line: string): ("left" | "center" | "right")[] {
  const parts = parseTableRow(line)
  return parts.map((p) => {
    const left = p.startsWith(":")
    const right = p.endsWith(":")
    if (left && right) return "center"
    if (right) return "right"
    return "left"
  })
}

type Block =
  | {
      type: "table"
      headers: string[]
      alignments: ("left" | "center" | "right")[]
      rows: string[][]
    }
  | { type: "code"; lang: string; code: string }
  | { type: "heading"; level: number; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "quote"; text: string }
  | { type: "paragraph"; text: string }

export function MarkdownRenderer({ content, className = "" }: MarkdownRendererProps) {
  if (!content) return null

  const lines = content.split("\n")
  const blocks: Block[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    // 1. Empty lines
    if (!trimmed) {
      i++
      continue
    }

    // 2. Fenced Code Blocks (```python ...)
    if (trimmed.startsWith("```")) {
      const lang = trimmed.slice(3).trim()
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i])
        i++
      }
      if (i < lines.length && lines[i].trim().startsWith("```")) {
        i++ // skip closing fence
      }
      blocks.push({
        type: "code",
        lang,
        code: codeLines.join("\n"),
      })
      continue
    }

    // 3. Markdown Tables
    // Check if current line contains '|' and the next line is a table delimiter
    if (line.includes("|") && i + 1 < lines.length && isTableDelimiter(lines[i + 1])) {
      const headers = parseTableRow(line)
      const alignments = parseAlignments(lines[i + 1])
      const rows: string[][] = []
      i += 2 // skip header and delimiter

      while (i < lines.length && lines[i].includes("|") && lines[i].trim() !== "") {
        rows.push(parseTableRow(lines[i]))
        i++
      }

      blocks.push({
        type: "table",
        headers,
        alignments,
        rows,
      })
      continue
    }

    // 4. Headings (# H1, ## H2, ### H3, #### H4)
    const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)$/)
    if (headingMatch) {
      blocks.push({
        type: "heading",
        level: headingMatch[1].length,
        text: headingMatch[2],
      })
      i++
      continue
    }

    // 5. Blockquotes (> ...)
    if (trimmed.startsWith(">")) {
      const quoteLines: string[] = []
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ""))
        i++
      }
      blocks.push({
        type: "quote",
        text: quoteLines.join(" "),
      })
      continue
    }

    // 6. Unordered Lists (- item, * item)
    if (/^[-*]\s+/.test(trimmed)) {
      const items: string[] = []
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, ""))
        i++
      }
      blocks.push({
        type: "list",
        ordered: false,
        items,
      })
      continue
    }

    // 7. Ordered Lists (1. item, 2. item)
    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = []
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ""))
        i++
      }
      blocks.push({
        type: "list",
        ordered: true,
        items,
      })
      continue
    }

    // 8. Normal Paragraph (accumulate lines until an empty line or block marker)
    const paraLines: string[] = [line]
    i++
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].trim().startsWith("```") &&
      !(lines[i].includes("|") && i + 1 < lines.length && isTableDelimiter(lines[i + 1])) &&
      !/^#{1,4}\s+/.test(lines[i].trim()) &&
      !/^[-*]\s+/.test(lines[i].trim()) &&
      !/^\d+\.\s+/.test(lines[i].trim()) &&
      !lines[i].trim().startsWith(">")
    ) {
      paraLines.push(lines[i])
      i++
    }

    blocks.push({
      type: "paragraph",
      text: paraLines.join("\n"),
    })
  }

  return (
    <div className={`space-y-2.5 text-xs sm:text-sm text-foreground leading-relaxed ${className}`}>
      {blocks.map((block, index) => {
        switch (block.type) {
          case "table": {
            return (
              <div
                key={index}
                className="my-3 w-full overflow-x-auto rounded-lg border border-border/80 bg-card shadow-2xs"
              >
                <table className="w-full text-xs border-collapse">
                  <thead className="bg-muted/70 text-foreground font-semibold border-b border-border/80">
                    <tr>
                      {block.headers.map((h, hIdx) => {
                        const align = block.alignments[hIdx] || "left"
                        const alignClass =
                          align === "center"
                            ? "text-center"
                            : align === "right"
                            ? "text-right"
                            : "text-left"
                        return (
                          <th
                            key={hIdx}
                            className={`px-3 py-2 text-xs font-semibold whitespace-nowrap ${alignClass}`}
                          >
                            {renderInline(h)}
                          </th>
                        )
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {block.rows.map((row, rIdx) => (
                      <tr
                        key={rIdx}
                        className={
                          rIdx % 2 === 1
                            ? "bg-muted/20 hover:bg-muted/40 transition-colors"
                            : "bg-card hover:bg-muted/30 transition-colors"
                        }
                      >
                        {row.map((cell, cIdx) => {
                          const align = block.alignments[cIdx] || "left"
                          const alignClass =
                            align === "center"
                              ? "text-center"
                              : align === "right"
                              ? "text-right"
                              : "text-left"
                          return (
                            <td
                              key={cIdx}
                              className={`px-3 py-2 text-xs leading-relaxed ${alignClass}`}
                            >
                              {renderInline(cell)}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          }

          case "heading": {
            if (block.level === 1) {
              return (
                <h1
                  key={index}
                  className="text-base font-bold text-foreground mt-3 mb-1 border-b border-border/60 pb-1"
                >
                  {renderInline(block.text)}
                </h1>
              )
            }
            if (block.level === 2) {
              return (
                <h2 key={index} className="text-sm font-semibold text-foreground mt-2.5 mb-1">
                  {renderInline(block.text)}
                </h2>
              )
            }
            return (
              <h3 key={index} className="text-xs font-semibold text-foreground mt-2 mb-0.5">
                {renderInline(block.text)}
              </h3>
            )
          }

          case "list": {
            if (block.ordered) {
              return (
                <ol
                  key={index}
                  className="space-y-1 my-1.5 pl-5 list-decimal text-foreground marker:text-primary/70"
                >
                  {block.items.map((item, itIdx) => (
                    <li key={itIdx} className="leading-relaxed">
                      {renderInline(item)}
                    </li>
                  ))}
                </ol>
              )
            }
            return (
              <ul
                key={index}
                className="space-y-1 my-1.5 pl-4 list-disc text-foreground marker:text-primary/70"
              >
                {block.items.map((item, itIdx) => (
                  <li key={itIdx} className="leading-relaxed">
                    {renderInline(item)}
                  </li>
                ))}
              </ul>
            )
          }

          case "code": {
            return (
              <pre
                key={index}
                className="my-2 p-3 rounded-lg bg-muted/60 text-foreground font-mono text-[11px] overflow-x-auto border border-border/70"
              >
                <code>{block.code}</code>
              </pre>
            )
          }

          case "quote": {
            return (
              <blockquote
                key={index}
                className="border-l-2 border-primary/60 pl-3 py-1 my-2 text-muted-foreground italic bg-muted/20 rounded-r"
              >
                {renderInline(block.text)}
              </blockquote>
            )
          }

          case "paragraph":
          default: {
            return (
              <p key={index} className="leading-relaxed whitespace-pre-wrap break-words">
                {renderInline(block.text)}
              </p>
            )
          }
        }
      })}
    </div>
  )
}
