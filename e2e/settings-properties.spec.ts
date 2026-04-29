import { test, expect } from "./fixtures";

test.describe("Settings — Properties", () => {
  test.describe.configure({ mode: "serial" });

  test("Properties tab is visible to admin", async ({ adminPage }) => {
    await adminPage.goto("/settings");
    await expect(adminPage.getByRole("tab", { name: "Properties" })).toBeVisible();
  });

  test("Properties tab is not visible to regular users", async ({ isolatedUser }) => {
    const { page } = isolatedUser;
    await page.goto("/settings");
    await expect(page.getByRole("tab", { name: "Properties" })).not.toBeVisible();
  });

  test("properties list shows seeded properties", async ({ adminPage, adminRequest }) => {
    // Create a booking as admin to ensure at least one property exists
    const chains = await adminRequest.get("/api/hotel-chains");
    const chain = (await chains.json())[0];
    const YEAR = new Date().getFullYear();
    const bookingRes = await adminRequest.post("/api/bookings", {
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
      await adminPage.goto("/settings");
      await adminPage.getByRole("tab", { name: "Properties" }).click();
      await expect(adminPage.getByTestId("tab-properties")).toBeVisible();
      // Verify at least one property row exists
      await expect(adminPage.locator('[data-testid="property-row"]').first()).toBeVisible();
    } finally {
      await adminRequest.delete(`/api/bookings/${booking.id}`);
    }
  });

  test("search and pagination works", async ({ adminPage, adminRequest }) => {
    // Create 3 properties with distinct names and a unique prefix to isolate from other tests
    const YEAR = new Date().getFullYear();
    const uniquePrefix = `SearchTest-${Math.random().toString(36).substring(7)}`;
    const names = [
      `${uniquePrefix} Alpha Hotel`,
      `${uniquePrefix} Beta Resort`,
      `${uniquePrefix} Gamma Suites`,
    ];
    const bookingIds: string[] = [];

    for (const name of names) {
      const res = await adminRequest.post("/api/bookings", {
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
      await adminPage.goto("/settings");
      await adminPage.getByRole("tab", { name: "Properties" }).click();
      // Wait for initial load
      await expect(adminPage.getByTestId("property-row").first()).toBeVisible();

      // Test Search
      const searchInput = adminPage.getByTestId("property-search");

      // Search for prefix
      const searchPromise = adminPage.waitForResponse(
        (resp) => resp.url().includes("/api/properties") && resp.url().includes("name=")
      );
      await searchInput.fill(uniquePrefix);
      await searchPromise;

      // Verify filter results
      await expect(
        adminPage
          .getByTestId("properties-desktop")
          .getByTestId("property-name")
          .filter({ hasText: `${uniquePrefix} Alpha Hotel` })
      ).toBeVisible();
      await expect(
        adminPage
          .getByTestId("properties-desktop")
          .getByTestId("property-name")
          .filter({ hasText: `${uniquePrefix} Beta Resort` })
      ).toBeVisible();

      // Refine search
      const refinePrefix = `${uniquePrefix} Alpha`;
      const refinePromise = adminPage.waitForResponse(
        (resp) => resp.url().includes("/api/properties") && resp.url().includes("name=")
      );
      await searchInput.fill(refinePrefix);
      await refinePromise;

      await expect(
        adminPage
          .getByTestId("properties-desktop")
          .getByTestId("property-name")
          .filter({ hasText: `${uniquePrefix} Alpha Hotel` })
      ).toBeVisible();
      await expect(
        adminPage
          .getByTestId("properties-desktop")
          .getByTestId("property-name")
          .filter({ hasText: `${uniquePrefix} Beta Resort` })
      ).not.toBeVisible();

      // Reset search
      const resetPromise = adminPage.waitForResponse(
        (resp) => resp.url().includes("/api/properties") && !resp.url().includes("name=")
      );
      await searchInput.fill("");
      await resetPromise;

      // Verify filter reset (should show Beta Resort again)
      await expect(
        adminPage
          .getByTestId("properties-desktop")
          .getByTestId("property-name")
          .filter({ hasText: `${uniquePrefix} Beta Resort` })
      ).toBeVisible();

      // Test pagination UI
      const isolatedSearchPromise = adminPage.waitForResponse(
        (resp) => resp.url().includes("/api/properties") && resp.url().includes("name=")
      );
      await searchInput.fill(uniquePrefix);
      await isolatedSearchPromise;

      await expect(adminPage.getByText(/Page 1 of 1/)).toBeVisible();
      await expect(adminPage.getByRole("button", { name: "Previous page" })).toBeDisabled();
      await expect(adminPage.getByRole("button", { name: "Next page" })).toBeDisabled();
    } finally {
      for (const id of bookingIds) {
        await adminRequest.delete(`/api/bookings/${id}`);
      }
    }
  });
});
