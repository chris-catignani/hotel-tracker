import crypto from "crypto";
import { test, expect } from "./fixtures";

const YEAR = new Date().getFullYear();

test.describe("Dashboard — new widgets", () => {
  test("new widget cards are visible with booking data", async ({ isolatedUser, adminRequest }) => {
    const chains = await adminRequest.get("/api/hotel-chains");
    const chain = (await chains.json())[0];

    // Use a property name that triggers the manual geo modal path; we rely on the API
    // accepting countryCode directly via the property upsert. If the API does not accept
    // countryCode on booking create, the geo card will show empty state — adjust as needed.
    const propertyName = `Widget Test ${crypto.randomUUID()}`;
    const bookingRes = await isolatedUser.request.post("/api/bookings", {
      data: {
        hotelChainId: chain.id,
        propertyName,
        checkIn: `${YEAR}-06-10`,
        checkOut: `${YEAR}-06-13`,
        numNights: 3,
        pretaxCost: 270,
        taxAmount: 30,
        totalCost: 300,
        currency: "USD",
        bookingSource: "direct_web",
        countryCode: "US",
        city: "New York",
      },
    });
    expect(bookingRes.ok()).toBeTruthy();
    const booking = await bookingRes.json();

    try {
      await isolatedUser.page.goto("/");

      // Price Distribution — card visible and shows at least one bucket label
      const priceCard = isolatedUser.page.getByTestId("price-distribution-card");
      await expect(priceCard).toBeVisible();
      // $300 / 3 nights = $100/night → $100–150 bucket should appear
      await expect(priceCard).toContainText("$100–150");

      // Monthly Travel Pattern — card visible and shows month labels
      const monthlyCard = isolatedUser.page.getByTestId("monthly-travel-pattern-card");
      await expect(monthlyCard).toBeVisible();
      await expect(monthlyCard).toContainText("Jun");

      // Geo Distribution — card visible and shows at least one country row
      const geoCard = isolatedUser.page.getByTestId("geo-distribution-card");
      await expect(geoCard).toBeVisible();
      await expect(geoCard.getByTestId("geo-row-US")).toBeVisible();
    } finally {
      await isolatedUser.request.delete(`/api/bookings/${booking.id}`);
    }
  });
});
