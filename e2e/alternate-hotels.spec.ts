import crypto from "crypto";
import { test, expect } from "./fixtures";

test.describe("Alternate hotels", () => {
  test("lists a candidate, watches it, and tags it on /price-watch", async ({
    isolatedUser,
    testBooking,
  }) => {
    const year = new Date().getFullYear();

    const bookingRes = await isolatedUser.request.get(`/api/bookings/${testBooking.id}`);
    expect(bookingRes.ok()).toBeTruthy();
    const booking = await bookingRes.json();
    const chainId = booking.hotelChainId;
    expect(chainId).toBeTruthy();

    // Seed an alternate property in the same chain via a second booking.
    // The testBooking has countryCode "US" and no GPS coords — the service falls back
    // to country-code matching, so this property will appear as a candidate.
    const altPropertyName = `Alt Hotel ${crypto.randomUUID()}`;
    const altBookingRes = await isolatedUser.request.post("/api/bookings", {
      data: {
        hotelChainId: chainId,
        propertyName: altPropertyName,
        checkIn: `${year}-09-01`,
        checkOut: `${year}-09-05`,
        numNights: 4,
        pretaxCost: 300,
        taxAmount: 60,
        totalCost: 360,
        currency: "USD",
        bookingSource: "direct_web",
        countryCode: "US",
        city: "Boston",
      },
    });
    expect(altBookingRes.ok()).toBeTruthy();
    const altBooking = await altBookingRes.json();
    let altPriceWatchId: string | null = null;

    try {
      // Load the anchor booking detail page
      await isolatedUser.page.goto(`/bookings/${testBooking.id}`);

      // Expand the alternate hotels section (collapsed by default)
      await isolatedUser.page.getByTestId("alternate-hotels-toggle").click();

      // The alternate property should appear as a candidate
      await expect(
        isolatedUser.page
          .getByTestId("alternate-candidate-row")
          .filter({ hasText: altPropertyName })
      ).toBeVisible();

      // Click the Watch button for the alternate property
      await isolatedUser.page
        .getByTestId("alternate-candidate-row")
        .filter({ hasText: altPropertyName })
        .getByTestId("watch-alternate-button")
        .click();

      // Fill in a cash threshold and save
      await isolatedUser.page.getByTestId("alt-cash-threshold").fill("300");
      await isolatedUser.page.getByTestId("alt-save-button").click();

      // Modal closes after successful save
      await expect(isolatedUser.page.locator('[data-testid="watch-alternate-modal"]')).toBeHidden();

      // Verify price watch was created via API
      const watchesRes = await isolatedUser.request.get("/api/price-watches");
      const watches = await watchesRes.json();
      const altWatch = watches.find(
        (w: { property: { name: string }; id: string }) => w.property.name === altPropertyName
      );
      expect(altWatch).toBeDefined();
      altPriceWatchId = altWatch.id;

      // Navigate to /price-watch and verify the "Alternate" badge appears for the watch
      await isolatedUser.page.goto("/price-watch");
      const altWatchRow = isolatedUser.page.locator(
        `[data-testid="price-watch-row-${altWatch.id}"]`
      );
      await expect(altWatchRow).toBeVisible();
      await expect(altWatchRow.getByTestId("alternate-booking-label")).toBeVisible();
    } finally {
      if (altPriceWatchId) {
        await isolatedUser.request.delete(`/api/price-watches/${altPriceWatchId}`);
      }
      await isolatedUser.request.delete(`/api/bookings/${altBooking.id}`);
    }
  });
});
