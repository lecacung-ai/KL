import { fileURLToPath } from "node:url"
import { defineConfig } from "@playwright/test"

// Isolated mock suite: no auth setup, dotenv, backend or dev-server startup.
export default defineConfig({
  testDir: ".",
  testMatch: "ui-redesign.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  outputDir: fileURLToPath(new URL("../../docs/evidence/web-ui/test-results/", import.meta.url)),
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:5173",
    browserName: "chromium",
    storageState: { cookies: [], origins: [] },
    serviceWorkers: "block",
    trace: "off",
    screenshot: "off",
    video: "off",
  },
})
