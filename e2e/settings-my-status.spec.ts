import crypto from "crypto";
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
    await page.waitForLoadState("networkidle");
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
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId(`status-select-${HOTEL_ID.HYATT}`)).toContainText(
      "Base Member / No Status"
    );
  });

  test("recalculates loyalty points when elite status changes", async ({ isolatedUser }) => {
    const { request } = isolatedUser;
    const pastYear = new Date().getFullYear() - 1;

    // Fetch Hyatt to get an Explorist eliteStatusId
    const chainsRes = await request.get("/api/hotel-chains");
    const chains = await chainsRes.json();
    const hyatt = chains.find((c: { id: string }) => c.id === HOTEL_ID.HYATT);
    const explorist = hyatt?.eliteStatuses?.find((s: { name: string }) => s.name === "Explorist");
    expect(explorist, "Explorist elite status not found in seeded Hyatt data").toBeDefined();

    // Create a past booking for Hyatt (no status set yet → base rate only)
    const bookingRes = await request.post("/api/bookings", {
      data: {
        hotelChainId: HOTEL_ID.HYATT,
        propertyName: `Status Cascade ${crypto.randomUUID()}`,
        checkIn: `${pastYear}-08-01`,
        checkOut: `${pastYear}-08-05`,
        numNights: 4,
        pretaxCost: 200,
        taxAmount: 20,
        totalCost: 220,
      },
    });
    expect(bookingRes.ok()).toBeTruthy();
    const booking = await bookingRes.json();
    const initialPoints = Number(booking.loyaltyPointsEarned);

    try {
      // Set elite status to Explorist
      const statusRes = await request.post("/api/user-statuses", {
        data: { hotelChainId: HOTEL_ID.HYATT, eliteStatusId: explorist.id },
      });
      expect(statusRes.ok()).toBeTruthy();

      // Loyalty points should have increased — poll to allow cascade to propagate under load
      await expect
        .poll(
          async () => {
            const res = await request.get(`/api/bookings/${booking.id}`);
            const data = await res.json();
            return Number(data.loyaltyPointsEarned);
          },
          { timeout: 8000 }
        )
        .toBeGreaterThan(initialPoints);
    } finally {
      await request.delete(`/api/bookings/${booking.id}`);
      // Restore base status
      await request.post("/api/user-statuses", {
        data: { hotelChainId: HOTEL_ID.HYATT, eliteStatusId: null },
      });
    }
  });

  test("enabling a partnership persists after reload", async ({ isolatedUser }) => {
    // Relies on seeded partnership earn data (global-setup.ts seeds partnership earns)
    const { page } = isolatedUser;
    await page.goto("/settings");
    await expect(page.getByTestId("tab-my-status")).toBeVisible();

    // Wait for partnership checkboxes to render (data fetched async after page load)
    const firstCheckbox = page.locator('[data-testid^="partnership-checkbox-"]').first();
    await expect(
      firstCheckbox,
      "No partnership checkboxes — partnershipEarn seed data missing or not rendered"
    ).toBeVisible();
    const testId = await firstCheckbox.getAttribute("data-testid");
    if (!testId) throw new Error("Could not read partnership checkbox testid");

    // Ensure it ends up enabled: enable if currently disabled, and wait for the API save
    const isChecked = await firstCheckbox.isChecked();
    if (!isChecked) {
      await Promise.all([
        page.waitForResponse(
          (r) => r.url().includes("/api/user-partnership-earns") && r.status() < 400
        ),
        firstCheckbox.click(),
      ]);
    }

    // Verify it persists after reload using the stable testid
    await page.reload();
    await expect(page.getByTestId("tab-my-status")).toBeVisible();
    await expect(page.getByTestId(testId)).toBeChecked();
  });
});
