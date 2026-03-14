import { test, expect } from "@playwright/test";

// These tests run without the admin session — clear storageState explicitly
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Authentication", () => {
  test("unauthenticated access to / redirects to /login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
  });

  test("login with valid credentials navigates to dashboard", async ({ page }) => {
    await page.goto("/login");
    await page
      .locator('input[type="email"]')
      .pressSequentially(process.env.SEED_ADMIN_EMAIL ?? "admin@example.com");
    await page
      .locator('input[type="password"]')
      .pressSequentially(process.env.SEED_ADMIN_PASSWORD ?? "admin123");
    await page.locator('button[type="submit"]').click();
    await page.waitForURL("/");
    await expect(page.getByRole("heading", { name: /Dashboard/i })).toBeVisible();
  });

  test("login with wrong password shows error", async ({ page }) => {
    await page.goto("/login");
    await page
      .locator('input[type="email"]')
      .pressSequentially(process.env.SEED_ADMIN_EMAIL ?? "admin@example.com");
    await page.locator('input[type="password"]').pressSequentially("wrongpassword");
    await page.locator('button[type="submit"]').click();
    await expect(page.getByText("Invalid email or password")).toBeVisible();
  });

  test("unauthenticated API request to /api/bookings returns 401", async ({ request }) => {
    const response = await request.get("/api/bookings");
    expect(response.status()).toBe(401);
  });
});
