export function Footer() {
  const currentYear = new Date().getFullYear()
  return (
    <footer className="finai-footer">
      <p><span className="font-semibold text-foreground">FinAI</span> <span className="mx-2" aria-hidden="true">/</span> Dữ liệu rõ ràng, quyết định có cơ sở.</p>
      <p>© {currentYear} · CNTT-KLCN327</p>
    </footer>
  )
}
