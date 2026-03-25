import { test, expect } from "./fixtures";

test.describe("Settings — Properties", () => {
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
});
