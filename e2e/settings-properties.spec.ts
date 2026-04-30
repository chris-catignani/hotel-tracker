import { test, expect } from "./fixtures";

test.describe("Settings — Properties", () => {
  test("Properties tab is visible to admin", async ({ isolatedAdmin }) => {
    await isolatedAdmin.page.goto("/settings");
    await expect(isolatedAdmin.page.getByRole("tab", { name: "Properties" })).toBeVisible();
  });

  test("Properties tab is not visible to regular users", async ({ isolatedUser }) => {
    const { page } = isolatedUser;
    await page.goto("/settings");
    await expect(page.getByRole("tab", { name: "Properties" })).not.toBeVisible();
  });

  test("properties list shows seeded properties", async ({ isolatedAdmin }) => {
    const { page, request } = isolatedAdmin;
    const chains = await request.get("/api/hotel-chains");
    const chain = (await chains.json())[0];
    const YEAR = new Date().getFullYear();
    const bookingRes = await request.post("/api/bookings", {
      data: {
        hotelChainId: chain.id,
        propertyName: `E2E Properties Tab Hotel ${Date.now()}`,
        checkIn: `${YEAR}-09-01`,
        checkOut: `${YEAR}-09-03`,
        numNights: 2,
        pretaxCost: 200,
        taxAmount: 20,
        totalCost: 220,
        currency: "USD",
        bookingSource: "direct_web",
        countryCode: "US",
        city: "Chicago",
      },
    });
    const booking = await bookingRes.json();

    try {
      await page.goto("/settings");
      await page.getByRole("tab", { name: "Properties" }).click();
      await expect(page.getByTestId("tab-properties")).toBeVisible();
      await expect(page.locator('[data-testid="property-row"]').first()).toBeVisible();
    } finally {
      await request.delete(`/api/bookings/${booking.id}`);
    }
  });

  test("search and pagination works", async ({ isolatedAdmin }) => {
    const { page, request } = isolatedAdmin;
    const YEAR = new Date().getFullYear();
    const uniquePrefix = `SearchTest-${Math.random().toString(36).substring(7)}`;
    const names = [
      `${uniquePrefix} Alpha Hotel`,
      `${uniquePrefix} Beta Resort`,
      `${uniquePrefix} Gamma Suites`,
    ];
    const bookingIds: string[] = [];

    for (const name of names) {
      const res = await request.post("/api/bookings", {
        data: {
          propertyName: name,
          checkIn: `${YEAR}-10-01`,
          checkOut: `${YEAR}-10-02`,
          numNights: 1,
          pretaxCost: 100,
          taxAmount: 10,
          totalCost: 110,
          currency: "USD",
          countryCode: "US",
          city: "Test City",
        },
      });
      const b = await res.json();
      bookingIds.push(b.id);
    }

    try {
      await page.goto("/settings");
      await page.getByRole("tab", { name: "Properties" }).click();
      // Wait for initial load
      await expect(page.getByTestId("property-row").first()).toBeVisible();

      // Test Search
      const searchInput = page.getByTestId("property-search");

      // Search for prefix — all 3 should appear
      await searchInput.fill(uniquePrefix);
      await expect(
        page
          .getByTestId("properties-desktop")
          .getByTestId("property-name")
          .filter({ hasText: `${uniquePrefix} Alpha Hotel` })
      ).toBeVisible({ timeout: 8000 });
      await expect(
        page
          .getByTestId("properties-desktop")
          .getByTestId("property-name")
          .filter({ hasText: `${uniquePrefix} Beta Resort` })
      ).toBeVisible({ timeout: 8000 });

      // Refine search — only Alpha should remain; waiting for Beta to disappear
      // acts as the signal that the debounced refine request has settled
      await searchInput.fill(`${uniquePrefix} Alpha`);
      await expect(
        page
          .getByTestId("properties-desktop")
          .getByTestId("property-name")
          .filter({ hasText: `${uniquePrefix} Beta Resort` })
      ).not.toBeVisible({ timeout: 8000 });
      await expect(
        page
          .getByTestId("properties-desktop")
          .getByTestId("property-name")
          .filter({ hasText: `${uniquePrefix} Alpha Hotel` })
      ).toBeVisible();

      // Reset search — waiting for Beta to reappear confirms the debounced
      // reset request has settled
      await searchInput.fill("");
      await expect(
        page
          .getByTestId("properties-desktop")
          .getByTestId("property-name")
          .filter({ hasText: `${uniquePrefix} Beta Resort` })
      ).toBeVisible({ timeout: 8000 });

      // Test pagination UI
      await searchInput.fill(uniquePrefix);
      await expect(page.getByText(/Page 1 of 1/)).toBeVisible({ timeout: 8000 });
      await expect(page.getByRole("button", { name: "Previous page" })).toBeDisabled();
      await expect(page.getByRole("button", { name: "Next page" })).toBeDisabled();
    } finally {
      for (const id of bookingIds) {
        await request.delete(`/api/bookings/${id}`);
      }
    }
  });
});
