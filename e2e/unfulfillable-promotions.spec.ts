import { test, expect } from "./fixtures";
import crypto from "crypto";

test.describe("Unfulfillable Promotions", () => {
  test("should show $0 value and unfulfillable message when nights are insufficient", async ({
    page,
    request,
    testHotelChain,
  }) => {
    // 1. Create a 3-night spanned promotion
    const uniqueId = crypto.randomUUID().slice(0, 8);
    const promoName = `Unfulfillable Promo ${uniqueId}`;
    const promoRes = await request.post("/api/promotions", {
      data: {
        name: promoName,
        type: "loyalty",
        hotelChainId: testHotelChain.id,
        startDate: "2026-01-01",
        endDate: "2026-12-31",
        restrictions: {
          minNightsRequired: 3,
          spanStays: true,
        },
        benefits: [
          {
            rewardType: "cashback",
            valueType: "fixed",
            value: 30,
            sortOrder: 0,
          },
        ],
      },
    });
    const promotion = await promoRes.json();

    // 2. Create a 1-night booking (insufficient nights total)
    const bookingRes = await request.post("/api/bookings", {
      data: {
        hotelChainId: testHotelChain.id,
        propertyName: "Stay 1 (Unfulfillable)",
        checkIn: "2026-06-01",
        checkOut: "2026-06-02",
        numNights: 1,
        pretaxCost: 100,
        taxAmount: 20,
        totalCost: 120,
        currency: "USD",
        bookingSource: "direct_web",
      },
    });
    const booking1 = await bookingRes.json();

    // Verify API response has the correct flag and value
    const bp1 = booking1.bookingPromotions.find(
      (p: { promotionId: string }) => p.promotionId === promotion.id
    );
    expect(bp1).toBeDefined();
    expect(Number(bp1.appliedValue)).toBe(0);
    expect(bp1.isUnfulfillable).toBe(true);

    try {
      // 3. Verify on Booking Detail page
      await page.goto(`/bookings/${booking1.id}`);

      // Check the Cost Breakdown table
      // It should show the promotion because it's unfulfillable
      await page.getByTestId("breakdown-promos-toggle").click();
      const promoRow = page.getByTestId(`breakdown-promo-item-${promotion.id}`);
      await expect(promoRow).toBeVisible();
      await expect(promoRow).toHaveText(/0\.00/);

      // Open calculation info
      const promoTestId = `calc-info-${promoName.toLowerCase().replace(/\s+/g, "-")}`;
      await page.getByTestId(`${promoTestId}-desktop`).click();

      // Check for unfulfillable message in the description
      await expect(
        page.locator("text=There are not enough future bookings to fulfill this promotion.").first()
      ).toBeVisible();
      await expect(page.locator(".font-mono:has-text('(unfulfillable)')").first()).toBeVisible();

      // 4. Create a future 2-night booking to fulfill the requirement
      const booking2Res = await request.post("/api/bookings", {
        data: {
          hotelChainId: testHotelChain.id,
          propertyName: "Stay 2 (Fulfillment)",
          checkIn: "2026-07-01",
          checkOut: "2026-07-03",
          numNights: 2,
          pretaxCost: 200,
          taxAmount: 40,
          totalCost: 240,
          currency: "USD",
          bookingSource: "direct_web",
        },
      });
      const booking2 = await booking2Res.json();

      try {
        // 5. Re-check Stay 1 - should now have value ($10)
        await page.reload();
        await page.getByTestId("breakdown-promos-toggle").click();

        // Wait for re-evaluation to be reflected
        const promoRowFulfilled = page.getByTestId(`breakdown-promo-item-${promotion.id}`);
        await expect(promoRowFulfilled).toHaveText(/10\.00/);

        // Open calculation info again
        await page.getByTestId(`${promoTestId}-desktop`).click();
        await expect(page.locator("text=Pending").first()).toBeVisible();
        await expect(page.locator(".font-mono:has-text('(unfulfillable)')")).not.toBeVisible();

        // 6. Delete Stay 2 - Stay 1 should revert to unfulfillable
        await request.delete(`/api/bookings/${booking2.id}`);
        await page.reload();
        await page.getByTestId("breakdown-promos-toggle").click();

        const promoRowReverted = page.getByTestId(`breakdown-promo-item-${promotion.id}`);
        await expect(promoRowReverted).toHaveText(/0\.00/);
      } finally {
        // Cleanup booking 2 if it still exists
        try {
          await request.delete(`/api/bookings/${booking2.id}`);
        } catch {}
      }
    } finally {
      await request.delete(`/api/bookings/${booking1.id}`);
      await request.delete(`/api/promotions/${promotion.id}`);
    }
  });
});
