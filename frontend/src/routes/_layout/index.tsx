import { createFileRoute } from "@tanstack/react-router"
import DataAnalyzer from "../../components/DataAnalyzer"

export const Route = createFileRoute("/_layout/")({
  component: Dashboard,
  head: () => ({
    meta: [
      {
        title: "FinAI Assistant - AI Data Workspace",
      },
    ],
  }),
})

function Dashboard() {
  return (
    <div className="min-w-0 h-full">
      <DataAnalyzer />
    </div>
  )
}
