import fs from "node:fs";
import { chromium } from "playwright";
// Salon accounts + credits walkthrough against a running server (database mode).
// Usage: node tests/e2e/salon-flow.mjs [outDir] [baseUrl]
// Needs ADMIN_USERNAME/ADMIN_PASSWORD of the server in env (defaults admin / admin-pass-123).
const OUT = process.argv[2] ?? "e2e-out";
const BASE = process.argv[3] ?? "http://localhost:3000";
const ADMIN = process.env.ADMIN_USERNAME ?? "admin";
const ADMIN_PW = process.env.ADMIN_PASSWORD ?? "admin-pass-123";
fs.mkdirSync(OUT, { recursive: true });
const stamp = Date.now().toString(36).slice(-5);
const SLUG = `glow-${stamp}`;
const OWNER = `glow-owner-${stamp}`;
const OWNER_PW = "glowpass123";

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
await ctx.route(/jsdelivr|storage\.googleapis/, (r) => r.abort());
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const check = (cond, label) => {
  console.log(`${cond ? "PASS" : "FAIL"} ${label}`);
  if (!cond) process.exitCode = 1;
};

async function login(user, pw) {
  await page.goto(`${BASE}/login`);
  await page.getByLabel("Username").fill(user);
  await page.locator('input[autocomplete="current-password"]').fill(pw);
  await page.getByRole("button", { name: "Sign in" }).click();
}
async function logout() {
  await page.request.post(`${BASE}/api/auth/signout`);
  await ctx.clearCookies();
}

await page.goto(BASE);
await page.mouse.move(900, 300);
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/01-landing.png` });

// Wrong password is rejected
await login(ADMIN, "wrong-password");
await page.getByText("Wrong username or password.").waitFor();
check(true, "wrong admin password rejected");

// Admin creates a salon with 3 looks
await login(ADMIN, ADMIN_PW);
await page.waitForURL("**/admin");
await page.getByRole("tab", { name: "New salon" }).click();
await page.getByLabel("Salon name").fill(`Glow Studio ${stamp}`);
await page.locator('input[pattern^="[a-z0-9][a-z0-9"]').fill(SLUG);
check((await page.locator('input[pattern^="[a-z0-9][a-z0-9"]').inputValue()) === SLUG, "custom slug kept exactly");
await page.getByLabel(/Looks to start with/).fill("3");
await page.getByLabel("Owner name").fill("Meera");
await page.getByLabel("Username").fill(OWNER);
await page.locator('input[minlength="8"]').fill(OWNER_PW);
await page.screenshot({ path: `${OUT}/02-admin-new-salon.png`, fullPage: true });
await page.getByRole("button", { name: "Create salon" }).click();
await page.getByText("Salon created").waitFor({ timeout: 10000 }).catch(async (e) => {
  console.log("notices:", await page.locator(".notice").allInnerTexts());
  throw e;
});
check(await page.getByText(`Username: ${OWNER}`).isVisible(), "credentials card shows owner username");
await page.screenshot({ path: `${OUT}/02b-admin-created.png` });
await page.getByRole("tab", { name: "Salons" }).click();
await page.mouse.move(640, 500);
await page.screenshot({ path: `${OUT}/03-admin-salons.png`, fullPage: true });

// Owner signs in and sees 3 looks
await logout();
await login(OWNER, OWNER_PW);
await page.waitForURL("**/dashboard");
const balanceText = await page.locator(".panel-dark").innerText();
check(/\b3\s*looks left/.test(balanceText), `owner sees 3 looks left (${balanceText.split("\n")[1]})`);
await page.screenshot({ path: `${OUT}/04-owner-dashboard.png`, fullPage: true });

// Owner adds a stylist login
await page.getByRole("tab", { name: "Team" }).click();
await page.getByLabel("Name", { exact: true }).fill("Ravi");
await page.getByLabel("Username", { exact: true }).fill(`ravi-${stamp}`);
await page.getByLabel(/Password \(min 8/).fill("ravipass123");
await page.getByRole("button", { name: "Create login" }).click();
await page.getByText(/can now sign in/).waitFor();
check(true, "stylist login created");

// Studio: 4 looks blocked, 3 allowed
const face = `${OUT}/face.jpg`;
if (!fs.existsSync(face)) {
  const url = await page.evaluate(() => {
    const c = document.createElement("canvas"); c.width = 900; c.height = 1200;
    const g = c.getContext("2d"); g.fillStyle = "#8d877d"; g.fillRect(0, 0, 900, 1200);
    g.fillStyle = "#2a211b"; g.beginPath(); g.ellipse(450, 470, 230, 270, 0, 0, 7); g.fill();
    g.fillStyle = "#b07d58"; g.beginPath(); g.ellipse(450, 540, 180, 230, 0, 0, 7); g.fill();
    return c.toDataURL("image/jpeg", 0.9);
  });
  fs.writeFileSync(face, Buffer.from(url.split(",")[1], "base64"));
}
await logout();
await login(`ravi-${stamp}`, "ravipass123");
await page.waitForURL("**/dashboard");
await page.goto(`${BASE}/studio`);
await page.getByLabel(/I agree to/).check();
await page.getByRole("button", { name: "I agree, continue" }).click();
await page.locator("input[type=file]").setInputFiles(face);
await page.getByRole("button", { name: "Use this photo" }).click();
await page.getByText("Choose up to").waitFor();
const cards = page.locator(".style-card");
for (let i = 0; i < 4; i++) await cards.nth(i).click();
await cards.nth(1).hover();
await page.mouse.move(400, 520);
await page.screenshot({ path: `${OUT}/05-studio-styles.png` });
await page.getByRole("button", { name: /Try 4 looks/ }).click();
await page.getByText(/Only 3 looks left/).waitFor();
check(true, "4 looks blocked with 3 left");
await cards.nth(3).click();
await page.getByRole("button", { name: /Try 3 looks/ }).click();
await page.getByRole("heading", { name: "Your looks", exact: true }).waitFor({ timeout: 60000 });
check((await page.locator(".result-media img").count()) === 3, "3 looks generated");
await page.locator(".result-card").first().hover();
await page.screenshot({ path: `${OUT}/06-studio-results.png` });

// Balance is now zero
await page.goto(`${BASE}/dashboard`);
check(/\b0\s*looks left/.test(await page.locator(".panel-dark").innerText()), "balance is 0 after 3 looks");

// Admin tops up 5 looks
await logout();
await login(ADMIN, ADMIN_PW);
await page.waitForURL("**/admin");
const row = page.locator(".card", { hasText: `Glow Studio ${stamp}` });
await row.getByLabel("Number of looks").fill("5");
await row.getByRole("button", { name: "Add looks" }).click();
await page.getByText(/Added 5 looks/).waitFor();
check(/\b5\s*looks left/.test(await row.innerText()), "admin top-up shows 5 looks");

// Old owner password stops working after a reset
page.once("dialog", (d) => d.accept("newglowpass1"));
await row.getByRole("button", { name: "reset password" }).first().click();
await page.getByText(/Password reset for/).waitFor();
await logout();
await login(OWNER, OWNER_PW);
await page.getByText("Wrong username or password.").waitFor();
await login(OWNER, "newglowpass1");
await page.waitForURL("**/dashboard");
check(/\b5\s*looks left/.test(await page.locator(".panel-dark").innerText()), "owner logs in with new password and sees 5 looks");

// Mobile landing
const m = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const mp = await m.newPage();
await mp.goto(BASE);
await mp.screenshot({ path: `${OUT}/07-mobile-landing.png` });
check((await mp.evaluate(() => document.documentElement.scrollWidth)) <= 390, "no horizontal scroll on mobile");

console.log("page errors:", errors);
await browser.close();
