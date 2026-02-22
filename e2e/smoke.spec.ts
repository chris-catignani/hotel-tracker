import { test, expect } from "@playwright/test";

test.describe("Smoke Test", () => {
  test.beforeEach(async ({ page }) => {
    // Go to the home page
    await page.goto("/");
  });

  test("should load the dashboard and show initial stats", async ({ page }) => {
    // Check the title
    await expect(page).toHaveTitle(/Hotel Tracker/i);

    // Verify dashboard header
    await expect(page.getByRole("heading", { name: /Dashboard/i })).toBeVisible();

    // Verify that some stats are visible (even if 0)
    await expect(page.getByTestId("stat-value-total-bookings")).toBeVisible();
    await expect(page.getByTestId("stat-value-cash")).toBeVisible();
  });

  test("should navigate to settings and see tabs", async ({ page }) => {
    // Click on Settings in the sidebar/navigation
    // Assuming there is a link with text "Settings"
    await page
      .getByRole("link", { name: /Settings/i })
      .first()
      .click();

    // Verify we are on the settings page
    await expect(page).toHaveURL(/\/settings/);
    await expect(page.getByRole("heading", { name: /Settings/i })).toBeVisible();

    // Check if the tabs are present
    // Note: Only the active tab's content is typically 'visible' in Radix UI
    await expect(page.getByTestId("tab-my-status")).toBeVisible();
    await expect(page.getByTestId("tab-point-types")).toBeAttached();
  });
});
