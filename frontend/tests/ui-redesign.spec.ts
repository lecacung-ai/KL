import { expect, test, type Page } from "@playwright/test"

const syntheticDataset = {
  id: "synthetic-ui-file",
  filename: "Bao_cao_tai_chinh_chi_nhanh_co_ten_dai_de_kiem_tra_giao_dien.csv",
  file_type: "csv", size_bytes: 100, row_count: 6, column_count: 2,
  version: 1, status: "ready", description: "Synthetic UI fixture",
  owner_id: "synthetic-ui-user", created_at: "2025-01-01T00:00:00Z",
  schema_info: JSON.stringify({ health_score: 80, columns: [
    { name: "month", dtype: "datetime64", type_category: "Date" },
    { name: "revenue", dtype: "float64", type_category: "Numeric" },
  ] }),
  sample_data: JSON.stringify([{ month: "2025-01-01", revenue: 100 }]),
}

async function mockWorkspace(page: Page, baseURL: string, admin = false) {
  const mutations: string[] = []
  const unexpected: string[] = []
  await page.addInitScript(() => {
    sessionStorage.setItem("access_token", "synthetic-ui-token")
    sessionStorage.setItem("vite-ui-theme", "light")
  })
  const origin = new URL(baseURL).origin
  await page.route("**/*", async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    // Every API origin is intercepted. Unknown/external requests never hit a backend.
    if (!url.pathname.startsWith("/api/")) {
      if (url.origin !== origin) { await route.abort(); return }
      await route.continue()
      return
    }
    const headers = {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "authorization,content-type",
      "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    }
    if (request.method() === "OPTIONS") { await route.fulfill({ status: 204, headers }); return }
    if (request.method() !== "GET") {
      mutations.push(`${request.method()} ${url.pathname}`)
      await route.fulfill({ status: 409, headers, json: { detail: "Synthetic UI: mutations disabled" } })
      return
    }
    let json: unknown
    if (url.pathname.endsWith("/users/me")) {
      json = { id: "synthetic-ui-user", email: "ui@example.invalid", full_name: "Người dùng kiểm tra", is_active: true, is_superuser: admin }
    } else if (/\/datasets\/?$/.test(url.pathname)) {
      json = { data: [syntheticDataset], count: 1 }
    } else if (url.pathname.endsWith("/history/stats")) {
      json = { total_queries: 0, success_rate_pct: 0, avg_time_ms: 0, avg_memory_mb: 0 }
    } else if (/\/history\/?$/.test(url.pathname)) {
      json = { data: [], count: 0 }
    } else if (/\/users\/?$/.test(url.pathname)) {
      json = { data: [], count: 0 }
    } else {
      unexpected.push(url.pathname)
      await route.fulfill({ status: 404, headers, json: { detail: "Synthetic UI: unknown endpoint" } })
      return
    }
    await route.fulfill({ headers, json })
  })
  return { mutations, unexpected }
}

for (const width of [360, 390, 768, 1024, 1440]) {
  test(`workspace fits ${width}px without mutations or document overflow`, async ({ page, baseURL }) => {
    const calls = await mockWorkspace(page, baseURL!)
    await page.setViewportSize({ width, height: 1000 })
    for (const [url, title] of [["/", "Tổng quan"], ["/datasets", "Kho dữ liệu"], ["/forecast", "Dự báo & phân nhóm"], ["/history", "Lịch sử phân tích"], ["/settings", "Cài đặt tài khoản"]]) {
      await page.goto(url)
      await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible()
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1)
    }
    expect(calls.mutations).toEqual([])
    expect(calls.unexpected).toEqual([])
  })
}

test("forecast tabs only change presentation and preserve access to both features", async ({ page, baseURL }) => {
  const calls = await mockWorkspace(page, baseURL!)
  await page.goto("/forecast")
  await page.getByRole("tab", { name: "Phân nhóm dữ liệu (K-Means)" }).click()
  await expect(page.getByRole("tab", { name: "Phân nhóm dữ liệu (K-Means)" })).toHaveAttribute("data-state", "active")
  await page.getByRole("tab", { name: "Dự báo theo thời gian" }).click()
  expect(calls.mutations).toEqual([])
})

test("theme choice persists through page navigation", async ({ page, baseURL }) => {
  const calls = await mockWorkspace(page, baseURL!)
  await page.goto("/")
  await page.getByTestId("theme-button").click()
  await page.getByTestId("dark-mode").click()
  await expect(page.locator("html")).toHaveClass(/dark/)
  await page.getByRole("link", { name: "Kho dữ liệu", exact: true }).first().click()
  await expect(page.locator("html")).toHaveClass(/dark/)
  expect(calls.mutations).toEqual([])
})

test("normal user does not gain an admin navigation item", async ({ page, baseURL }) => {
  await mockWorkspace(page, baseURL!)
  await page.goto("/")
  await expect(page.getByRole("heading", { name: "Tổng quan", exact: true })).toBeVisible()
  await expect(page.getByRole("link", { name: "Người dùng", exact: true })).toHaveCount(0)
})

test("admin navigation is retained for an admin response", async ({ page, baseURL }) => {
  await mockWorkspace(page, baseURL!, true)
  await page.goto("/")
  await expect(page.getByRole("link", { name: "Người dùng", exact: true })).toBeVisible()
})

test("upload dialog opens and closes without uploading a file", async ({ page, baseURL }) => {
  const calls = await mockWorkspace(page, baseURL!)
  await page.goto("/datasets")
  await page.getByRole("button", { name: "Tải tệp lên", exact: true }).click()
  await expect(page.getByRole("dialog")).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(page.getByRole("dialog")).toHaveCount(0)
  expect(calls.mutations).toEqual([])
})

test("analysis submits once and expanding its result never submits again", async ({ page, baseURL }) => {
  const calls = await mockWorkspace(page, baseURL!)
  let posts = 0
  const query = "Hiển thị các cột trong tệp synthetic"
  await page.route("**/api/v1/datasets/synthetic-ui-file/download", async (route) => {
    await route.fulfill({
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-headers": "authorization,content-type",
        "access-control-allow-methods": "GET,OPTIONS",
      },
      contentType: "text/csv",
      body: "month,revenue\n2025-01-01,100\n",
    })
  })
  await page.route("**/api/v1/files/upload", async (route) => {
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-headers": "authorization,content-type",
        "access-control-allow-methods": "POST,OPTIONS",
      } })
      return
    }
    posts += 1
    expect(route.request().method()).toBe("POST")
    const body = route.request().postDataBuffer()?.toString("utf8") ?? ""
    expect(body).toContain('name="query"')
    expect(body).toContain(query)
    expect(body).toContain('name="file"')
    await route.fulfill({ headers: { "access-control-allow-origin": "*" }, json: {
      file_name: syntheticDataset.filename,
      columns: ["month", "revenue"], selected_scope: [],
      stdout: "Synthetic result; not financial evidence.", ai_code: "# synthetic UI fixture",
      execution_status: "success", execution_error: "", execution_time_ms: 1,
      security_status: "passed",
      chart_image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a8fsAAAAASUVORK5CYII=",
    } })
  })
  await page.goto("/")
  await expect(page.getByRole("combobox", { name: "Chọn tệp đã lưu" })).toBeVisible()
  await page.getByRole("combobox", { name: "Chọn tệp đã lưu" }).selectOption(syntheticDataset.id)
  await page.getByRole("textbox", { name: "Câu hỏi phân tích" }).fill(query)
  await page.getByRole("button", { name: "Phân Tích Ngay" }).click()
  await expect(page.getByText("Synthetic result; not financial evidence.")).toBeVisible()
  await page.getByRole("button", { name: "Mở lớn biểu đồ" }).click()
  await expect(page.getByRole("dialog", { name: "Biểu đồ phân tích tài chính" })).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(page.getByRole("dialog", { name: "Biểu đồ phân tích tài chính" })).toHaveCount(0)
  expect(posts).toBe(1)
  expect(calls.mutations).toEqual([])
  expect(calls.unexpected).toEqual([])
})
