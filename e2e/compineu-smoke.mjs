// Browser smoke test for compineu: login, every routed page, brand text, console and API errors.
// Needs the API on :8000, the Vite dev server on :5173 and google-chrome installed.
// Run: E2E_EMAIL=... E2E_PASSWORD=... node e2e/compineu-smoke.mjs   (E2E_SHOTS=<dir> saves screenshots)
import { chromium } from "playwright-core";

const BASE = process.env.E2E_BASE ?? "http://localhost:5173";
const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;
const SHOTS = process.env.E2E_SHOTS;
if (!EMAIL || !PASSWORD) throw new Error("set E2E_EMAIL and E2E_PASSWORD");

const browser = await chromium.launch({
  executablePath: process.env.E2E_CHROME ?? "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const problems = [];
let current = "login";
page.on("pageerror", (e) => problems.push(`[${current}] page error: ${e}`));
page.on("console", (m) => {
  // The stream reconnects when the API restarts; only real errors count.
  if (m.type() === "error" && !/EventSource|net::ERR_ABORTED/.test(m.text())) problems.push(`[${current}] console: ${m.text().slice(0, 160)}`);
});
page.on("response", (r) => {
  if (r.url().includes("/api/") && r.status() >= 400) problems.push(`[${current}] ${r.status()} ${r.url().replace(/^.*\/api/, "/api")}`);
});

const shot = async (name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false }); };
// The live SSE stream keeps a connection open, so "networkidle" never fires. Wait for the DOM and a short settle.
const settle = async () => { await page.waitForLoadState("domcontentloaded"); await page.waitForTimeout(1500); };
const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  " + detail : ""}`); };

await page.goto(`${BASE}/login`);
check("title is compineu", (await page.title()) === "compineu", await page.title());
await shot("01-login");
await page.fill("input[type=email]", EMAIL);
await page.fill("input[type=password]", PASSWORD);
await page.click("button:has-text('Sign in')");
await page.waitForURL(`${BASE}/`, { timeout: 20000 });
current = "dashboard";
await page.waitForSelector("text=Dashboard", { timeout: 20000 });
await settle();
check("dashboard loads", true);
check("sidebar brand reads compineu", (await page.locator("text=compineu").count()) > 0);
check("no old brand text on dashboard", (await page.locator("text=/PolicyGuard|AML/").count()) === 0);
await shot("02-dashboard");

// /quality is hidden on purpose (QUALITY_PAGE_ENABLED=false in useQuality.ts) and redirects to the dashboard.
// /admin/observability reads CloudWatch, so it answers 502 without AWS credentials; it is only checked when
// E2E_OBSERVABILITY=1 (a deployed run).
const pages = [["/alerts", "alerts"], ["/cases", "incidents"], ["/compliance", "compliance"], ["/notifications", "notifications"], ["/account", "account"]];
if (process.env.E2E_OBSERVABILITY === "1") pages.push(["/admin/observability", "observability"]);
for (const [route, label] of pages) {
  current = label;
  await page.goto(`${BASE}${route}`);
  await settle();
  const h1 = ((await page.locator("h1").first().textContent({ timeout: 8000 }).catch(() => "")) ?? "").trim();
  check(`${label} page renders`, h1.length > 0, `heading "${h1}"`);
  if (label === "incidents") await shot("03-incidents");
  if (label === "compliance") await shot("05-compliance");
}
await page.goto(`${BASE}/quality`);
await settle();
check("quality page is hidden and redirects to the dashboard", new URL(page.url()).pathname === "/");

current = "case detail";
await page.goto(`${BASE}/cases`);
await settle();
// Incident rows are clickable table rows, not links.
const row = page.locator("tbody tr").first();
const hasCase = (await row.count()) > 0;
check("an incident is listed", hasCase);
if (hasCase) {
  await row.locator("text=/^Incident \\d+$/").first().click();
  await page.waitForURL(/\/cases\/\d+/, { timeout: 20000 });
  await settle();
  check("case detail shows the audit timeline", (await page.locator("text=Audit timeline").count()) > 0);
  await shot("04-case-detail");
}

console.log(problems.length ? `\nPROBLEMS (${problems.length}):\n` + [...new Set(problems)].join("\n") : "\nno console, page or API errors");
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${failed === 0 && problems.length === 0 ? "SMOKE PASS" : "SMOKE FAIL"} (${results.length - failed}/${results.length} checks)`);
process.exit(failed === 0 && problems.length === 0 ? 0 : 1);
