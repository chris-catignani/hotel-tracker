import { test, expect } from "./fixtures";

test.describe("Smoke Test", () => {
  test.beforeEach(async ({ isolatedUser }) => {
    // Go to the home page
    await isolatedUser.page.goto("/");
  });

  test("should load the dashboard and show initial stats", async ({ isolatedUser }) => {
    // Check the title
    await expect(isolatedUser.page).toHaveTitle(/Hotel Tracker/i);

    // Verify dashboard header
    await expect(isolatedUser.page.getByRole("heading", { name: /Dashboard/i })).toBeVisible();

    // Verify that some stats are visible (even if 0)
    await expect(isolatedUser.page.getByTestId("stat-value-total-bookings")).toBeVisible();
    await expect(isolatedUser.page.getByTestId("stat-value-cash")).toBeVisible();
  });

  test("should navigate to settings and see tabs", async ({ isolatedUser }) => {
    // Click on Settings in the sidebar/navigation
    // Assuming there is a link with text "Settings"
    await isolatedUser.page
      .getByRole("link", { name: /Settings/i })
      .first()
      .click();

    // Verify we are on the settings page
    await expect(isolatedUser.page).toHaveURL(/\/settings/);
    await expect(isolatedUser.page.getByRole("heading", { name: /Settings/i })).toBeVisible();

    // Check if the tabs are present
    // Note: Only the active tab's content is typically 'visible' in Radix UI
    await expect(isolatedUser.page.getByTestId("tab-my-status")).toBeVisible();
    await expect(isolatedUser.page.getByTestId("tab-point-types")).toBeAttached();
  });
});
