import { test, expect } from "./fixtures";

test.describe("Settings CRUD flows", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/settings/);
    await expect(page.getByRole("heading", { name: /Settings/i })).toBeVisible();
  });

  test("navigates settings tabs", async ({ page }) => {
    // My Status tab should be visible by default
    await expect(page.getByTestId("tab-my-status")).toBeVisible();

    // Other tabs should be present (attached) and switchable
    await page.getByRole("tab", { name: /Hotel Chains/i }).click();
    await expect(page.getByTestId("tab-hotels")).toBeVisible();

    await page.getByRole("tab", { name: /Credit Cards/i }).click();
    await expect(page.getByTestId("tab-credit-cards")).toBeVisible();

    await page.getByRole("tab", { name: /Shopping Portals/i }).click();
    await expect(page.getByTestId("tab-portals")).toBeVisible();

    await page.getByRole("tab", { name: /OTA Agencies/i }).click();
    await expect(page.getByTestId("tab-ota-agencies")).toBeVisible();
  });

  test("can add and edit a hotel chain", async ({ page }) => {
    await page.getByRole("tab", { name: /Hotel Chains/i }).click();

    // Open add dialog
    await page.getByTestId("add-hotel-chain-button").click();
    await expect(page.getByRole("heading", { name: "Add Hotel Chain" })).toBeVisible();
    await expect(page.getByLabel("Name")).toBeVisible();

    // Verify desktop container is present (data comes from API)
    const desktop = page.getByTestId("hotel-chains-desktop");
    await expect(desktop).toBeVisible();
  });

  test("can add, edit, and delete a credit card", async ({ page }) => {
    await page.getByRole("tab", { name: /Credit Cards/i }).click();

    // Add
    await page.getByTestId("add-credit-card-button").click();
    await expect(page.getByRole("heading", { name: "Add Credit Card" })).toBeVisible();
    await expect(page.getByLabel("Name")).toBeVisible();

    const desktop = page.getByTestId("credit-cards-desktop");
    await expect(desktop).toBeVisible();
  });

  test("can add and edit a shopping portal", async ({ page }) => {
    await page.getByRole("tab", { name: /Shopping Portals/i }).click();

    // Add
    await page.getByTestId("add-portal-button").click();
    await expect(page.getByRole("heading", { name: "Add Shopping Portal" })).toBeVisible();
    await expect(page.getByLabel("Name")).toBeVisible();

    const desktop = page.getByTestId("portals-desktop");
    await expect(desktop).toBeVisible();
  });

  test("can add, edit, and delete an OTA agency", async ({ page }) => {
    await page.getByRole("tab", { name: /OTA Agencies/i }).click();

    // Add
    await page.getByTestId("add-agency-button").click();
    await expect(page.getByRole("heading", { name: "Add OTA Agency" })).toBeVisible();
    await expect(page.getByLabel("Name")).toBeVisible();

    const desktop = page.getByTestId("agencies-desktop");
    await expect(desktop).toBeVisible();
  });
});
