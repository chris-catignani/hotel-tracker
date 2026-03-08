import { test as setup } from "@playwright/test";
import path from "path";

const adminFile = path.join(__dirname, ".auth/admin.json");

setup("authenticate as admin", async ({ page }) => {
  await page.goto("/login");
  await page.fill('input[type="email"]', process.env.SEED_ADMIN_EMAIL ?? "admin@example.com");
  await page.fill('input[type="password"]', process.env.SEED_ADMIN_PASSWORD ?? "admin123");
  await page.click('button[type="submit"]');
  await page.waitForURL("/");
  await page.context().storageState({ path: adminFile });
});
