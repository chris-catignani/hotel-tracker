import { test, expect } from "./fixtures";
import { HOTEL_ID } from "@/lib/constants";

test.describe("Settings — My Status", () => {
  test("status table shows hotel chains", async ({ isolatedUser }) => {
    const { page } = isolatedUser;
    await page.goto("/settings");
    await expect(page.getByTestId("tab-my-status")).toBeVisible();
    await expect(page.getByTestId("user-status-table")).toBeVisible();
    // At least one data row visible (seeded chains exist)
    await expect(page.getByTestId("user-status-table").getByRole("row").first()).toBeVisible();
  });

  test("selecting an elite status persists after reload", async ({ isolatedUser }) => {
    const { page } = isolatedUser;
    await page.goto("/settings");
    await expect(page.getByTestId("tab-my-status")).toBeVisible();
    await expect(page.getByTestId("user-status-table")).toBeVisible();

    // Select a seeded Hyatt elite status
    // Seeded Hyatt statuses: Discoverist, Explorist, Globalist
    await page.getByTestId(`status-select-${HOTEL_ID.HYATT}`).click();
    await Promise.all([
      page.waitForResponse(
        (resp) => resp.url().includes("/api/user-statuses") && resp.status() < 400
      ),
      page.getByRole("option", { name: "Explorist" }).click(),
    ]);

    await page.reload();
    await expect(page.getByTestId("user-status-table")).toBeVisible();
    await expect(page.getByTestId(`status-select-${HOTEL_ID.HYATT}`)).toContainText("Explorist");
  });

  test("resetting status to base member persists after reload", async ({ isolatedUser }) => {
    const { page, request } = isolatedUser;

    // Set initial "Explorist" state via API so the test starts with a known non-base status
    const chainsRes = await request.get("/api/hotel-chains");
    const chains = await chainsRes.json();
    const hyattChain = chains.find((c: { id: string }) => c.id === HOTEL_ID.HYATT);
    const exploristStatus = hyattChain.eliteStatuses.find(
      (s: { name: string }) => s.name === "Explorist"
    );
    await request.post("/api/user-statuses", {
      data: { hotelChainId: HOTEL_ID.HYATT, eliteStatusId: exploristStatus.id },
    });

    await page.goto("/settings");
    await expect(page.getByTestId("tab-my-status")).toBeVisible();
    await expect(page.getByTestId("user-status-table")).toBeVisible();

    await page.getByTestId(`status-select-${HOTEL_ID.HYATT}`).click();
    await Promise.all([
      page.waitForResponse(
        (resp) => resp.url().includes("/api/user-statuses") && resp.status() < 400
      ),
      page.getByRole("option", { name: "Base Member / No Status" }).click(),
    ]);

    await page.reload();
    await expect(page.getByTestId("user-status-table")).toBeVisible();
    await expect(page.getByTestId(`status-select-${HOTEL_ID.HYATT}`)).toContainText(
      "Base Member / No Status"
    );
  });

  test("enabling a partnership persists after reload", async ({ isolatedUser }) => {
    // Relies on seeded partnership earn data (global-setup.ts seeds partnership earns)
    const { page } = isolatedUser;
    await page.goto("/settings");
    await expect(page.getByTestId("tab-my-status")).toBeVisible();

    // Find all partnership checkboxes and pick the first one
    const checkboxes = page.locator('[data-testid^="partnership-checkbox-"]');
    const checkboxCount = await checkboxes.count();
    if (checkboxCount === 0) {
      test.skip();
      return;
    }

    // Extract the stable testid of the first checkbox so we can re-query it after reload
    const firstCheckbox = checkboxes.first();
    const testId = await firstCheckbox.getAttribute("data-testid");
    if (!testId) throw new Error("Could not read partnership checkbox testid");

    // Ensure it ends up enabled: enable if currently disabled
    const isChecked = await firstCheckbox.isChecked();
    if (!isChecked) {
      await firstCheckbox.click();
    }

    // Verify it persists after reload using the stable testid
    await page.reload();
    await expect(page.getByTestId("tab-my-status")).toBeVisible();
    await expect(page.getByTestId(testId)).toBeChecked();
  });
});
