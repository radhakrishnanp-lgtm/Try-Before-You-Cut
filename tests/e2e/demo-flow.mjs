import fs from "node:fs";
import { chromium } from "playwright";
// End-to-end walkthrough of the demo-mode app.
// Usage: npm run build && npm start, then: node tests/e2e/demo-flow.mjs [outDir] [baseUrl]
// Screenshots and downloads are written to outDir (default: ./e2e-out).
fs.mkdirSync(process.argv[2] ?? "e2e-out", { recursive: true });
const SP = process.argv[2] ?? "e2e-out";
const BASE = process.argv[3] ?? "http://localhost:3000";
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const ctx = await browser.newContext({ viewport: { width: 1180, height: 820 }, permissions: ["clipboard-read", "clipboard-write"] });
// Block the on-device face detector CDN so the fallback path is exercised deterministically.
await ctx.route(/jsdelivr|storage\.googleapis/, (r) => r.abort());
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

// Make a 900x1200 synthetic portrait
await page.goto(BASE + "/privacy");
const dataUrl = await page.evaluate(() => {
  const c = document.createElement("canvas"); c.width = 900; c.height = 1200;
  const g = c.getContext("2d");
  const grd = g.createLinearGradient(0, 0, 0, 1200); grd.addColorStop(0, "#c9c2b8"); grd.addColorStop(1, "#8d877d");
  g.fillStyle = grd; g.fillRect(0, 0, 900, 1200);
  g.fillStyle = "#2a211b"; g.beginPath(); g.ellipse(450, 470, 230, 270, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#b07d58"; g.beginPath(); g.ellipse(450, 540, 180, 230, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#2a211b"; g.beginPath(); g.ellipse(380, 500, 18, 10, 0, 0, Math.PI * 2); g.ellipse(520, 500, 18, 10, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#3d5a73"; g.fillRect(200, 860, 500, 340);
  return c.toDataURL("image/jpeg", 0.9);
});
fs.writeFileSync(SP + "/face.jpg", Buffer.from(dataUrl.split(",")[1], "base64"));

await page.goto(BASE + "/t/demo");
await page.screenshot({ path: SP + "/01-consent.png", fullPage: true });
await page.getByLabel(/I agree to Studio Amara/).check();
await page.getByRole("button", { name: "I agree, continue" }).click();
await page.getByRole("button", { name: "Upload from gallery" }).waitFor();
await page.screenshot({ path: SP + "/02-capture.png" });
await page.locator('input[type=file]').setInputFiles(SP + "/face.jpg");
await page.getByText("Photo check").waitFor();
await page.screenshot({ path: SP + "/03-check.png", fullPage: true });
await page.getByRole("button", { name: "Use this photo" }).click();
await page.getByText("Choose up to four looks").waitFor();
await page.getByRole("button", { name: "Wavy" }).click();
await page.screenshot({ path: SP + "/04-styles.png" });
const cards = page.locator(".style-card");
for (let i = 0; i < 4; i++) await cards.nth(i).click();
console.log("5th disabled:", await cards.nth(4).isDisabled());
await page.getByRole("button", { name: /Try 4 looks/ }).click();
await page.getByText("Creating your looks").waitFor();
await page.screenshot({ path: SP + "/05-generating.png" });
await page.getByRole("heading", { name: "Your looks", exact: true }).waitFor({ timeout: 30000 });
await page.screenshot({ path: SP + "/06-results.png", fullPage: true });
const hearts = page.locator(".heart");
await hearts.nth(0).click(); await hearts.nth(1).click();
await page.locator(".result-media").first().click();
await page.getByText("Before & after").waitFor();
await page.locator('.compare input[type=range]').fill("30");
await page.screenshot({ path: SP + "/07-compare.png" });
const dl = page.waitForEvent("download");
await page.getByRole("button", { name: "Download" }).click();
const d = await dl; await d.saveAs(SP + "/watermarked.jpg");
await page.getByRole("button", { name: "Stylist Board" }).click();
await page.getByAltText("Your Stylist Board").waitFor({ timeout: 15000 });
await page.screenshot({ path: SP + "/08-board.png", fullPage: true });
const dl2 = page.waitForEvent("download");
await page.getByRole("button", { name: "Download" }).click();
await (await dl2).saveAs(SP + "/board.jpg");
await page.getByRole("button", { name: "Copy 24-hour link" }).click();
await page.waitForTimeout(500);
const link = await page.evaluate(() => navigator.clipboard.readText());
console.log("share link", link);
const p2 = await ctx.newPage();
await p2.goto(link);
await p2.screenshot({ path: SP + "/09-shared.png", fullPage: true });
console.log("shared images", await p2.locator(".result-media img").count());

// Refresh persistence
await page.reload();
await page.getByRole("heading", { name: "Your looks", exact: true }).waitFor();
// Delete my data
page.once("dialog", (dlg) => dlg.accept());
await page.getByRole("button", { name: "Delete my data now" }).click();
await page.getByText("Your data has been deleted").waitFor();
await p2.reload();
console.log("after delete:", await p2.locator("h1").innerText());

// Mobile viewport of style picker
const m = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const mp = await m.newPage();
await mp.goto(BASE + "/t/demo");
await mp.screenshot({ path: SP + "/10-mobile-consent.png", fullPage: false });
const scrollW = await mp.evaluate(() => document.documentElement.scrollWidth);
console.log("mobile scrollWidth", scrollW);

// Owner dashboard
await page.goto(BASE + "/login");
await page.getByRole("button", { name: "Salon owner" }).click();
await page.waitForURL("**/dashboard");
await page.screenshot({ path: SP + "/11-dashboard.png", fullPage: true });
await page.getByRole("tab", { name: "Styles" }).click();
await page.locator(".toggle-item input").first().uncheck();
await page.getByRole("button", { name: "Save changes" }).click();
await page.getByText("Saved").waitFor();
await page.getByRole("tab", { name: "Branding" }).click();
await page.getByLabel("Use #2f5d50").click();
await page.waitForTimeout(500);
await page.screenshot({ path: SP + "/12-branding.png", fullPage: true });
await page.goto(BASE + "/studio");
await page.screenshot({ path: SP + "/13-studio.png" });

// Admin
await page.request.post(BASE + "/api/auth/signout");
await page.goto(BASE + "/login");
await page.getByRole("button", { name: "Platform admin" }).click();
await page.waitForURL("**/admin");
await page.screenshot({ path: SP + "/14-admin.png", fullPage: true });

// Negative API checks
const r1 = await page.request.get(BASE + "/api/sessions/00000000-0000-0000-0000-000000000000");
console.log("unknown session", r1.status());
const r2 = await page.request.post(BASE + "/api/sessions", { data: { salonSlug: "demo", mode: "remote", consent: false, isMinor: false, guardianConsent: false } });
console.log("no consent", r2.status());
const r3 = await page.request.post(BASE + "/api/sessions", { data: { salonSlug: "demo", mode: "remote", consent: true, isMinor: true, guardianConsent: false } });
console.log("minor without guardian", r3.status());
console.log("errors:", errors);
await browser.close();
