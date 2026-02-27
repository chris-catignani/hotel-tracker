import { test, expect } from "./fixtures";

test.describe("Payment Type Restrictions", () => {
  test("Promotion with 'cash' restriction: applied to cash booking, skipped for points booking", async ({
    request,
    testHotelChain,
  }) => {
    // 1. Create a promotion restricted to 'cash' payment type
    const promoName = `Cash Only Promo ${crypto.randomUUID()}`;
    const promoRes = await request.post("/api/promotions", {
      data: {
        name: promoName,
        type: "loyalty",
        hotelChainId: testHotelChain.id,
        benefits: [
          { rewardType: "cashback", valueType: "fixed", value: 50, certType: null, sortOrder: 0 },
        ],
        restrictions: {
          allowedPaymentTypes: ["cash"],
        },
        isActive: true,
      },
    });
    expect(promoRes.ok()).toBeTruthy();
    const promo = await promoRes.json();

    // 2. Create a cash booking (pretaxCost > 0, pointsRedeemed = 0)
    const cashBookingRes = await request.post("/api/bookings", {
      data: {
        hotelChainId: testHotelChain.id,
        propertyName: "Cash Booking",
        checkIn: "2026-06-01",
        checkOut: "2026-06-02",
        numNights: 1,
        pretaxCost: 100,
        taxAmount: 20,
        totalCost: 120,
        currency: "USD",
        pointsRedeemed: 0,
      },
    });
    const cashBooking = await cashBookingRes.json();

    // 3. Create a points booking (pretaxCost = 0, pointsRedeemed > 0)
    const pointsBookingRes = await request.post("/api/bookings", {
      data: {
        hotelChainId: testHotelChain.id,
        propertyName: "Points Booking",
        checkIn: "2026-06-03",
        checkOut: "2026-06-04",
        numNights: 1,
        pretaxCost: 0,
        taxAmount: 0,
        totalCost: 0,
        currency: "USD",
        pointsRedeemed: 10000,
      },
    });
    const pointsBooking = await pointsBookingRes.json();

    // 4. Verify cash booking GOT the promotion
    const cashDetail = await (await request.get(`/api/bookings/${cashBooking.id}`)).json();
    const cashApplied = (cashDetail.bookingPromotions || []).some(
      (bp: { promotionId: string }) => bp.promotionId === promo.id
    );
    expect(cashApplied).toBe(true);

    // 5. Verify points booking SKIPPED the promotion
    const pointsDetail = await (await request.get(`/api/bookings/${pointsBooking.id}`)).json();
    const pointsApplied = (pointsDetail.bookingPromotions || []).some(
      (bp: { promotionId: string }) => bp.promotionId === promo.id
    );
    expect(pointsApplied).toBe(false);

    // Cleanup
    await request.delete(`/api/bookings/${cashBooking.id}`);
    await request.delete(`/api/bookings/${pointsBooking.id}`);
    await request.delete(`/api/promotions/${promo.id}`);
  });

  test("UI: adding, interacting with, and persisting payment type restriction", async ({
    page,
    testHotelChain,
  }) => {
    const promoName = `UI Payment Promo ${crypto.randomUUID()}`;

    await page.goto("/promotions/new");

    // Basic info
    await page.getByLabel(/Name/i).fill(promoName);
    await page.getByTestId("promotion-type-select").click();
    await page.getByRole("option", { name: "Loyalty" }).click();
    await page.getByTestId("hotel-chain-select").click();
    await page.getByRole("option", { name: testHotelChain.name }).click();

    // Add a benefit (since empty benefits might be rejected)
    await page.getByTestId("benefit-value-0").fill("10");

    // Add Restriction
    await page.getByTestId("restriction-picker-button").click();
    await page.getByTestId("restriction-option-payment_type").click();

    // Verify card appears
    const restrictionCard = page.getByTestId("restriction-card-payment_type");
    await expect(restrictionCard).toBeVisible();

    // Check 'Cash' and 'Points'
    await restrictionCard.getByTestId("payment-type-cash").check();
    await restrictionCard.getByTestId("payment-type-points").check();

    // Save
    await page.getByTestId("promotion-form-submit").click();

    // Wait for redirect to promotions list
    await expect(page).toHaveURL(/\/promotions$/);
    const desktopList = page.getByTestId("promotions-list-desktop");
    const row = desktopList.getByRole("row").filter({ hasText: promoName });
    await expect(row).toBeVisible();

    // Navigate to Edit to check persistence
    await row.getByRole("link", { name: "Edit" }).click();

    // Check persistence in Edit page
    const editRestrictionCard = page.getByTestId("restriction-card-payment_type");
    await expect(editRestrictionCard).toBeVisible();
    await expect(editRestrictionCard.getByTestId("payment-type-cash")).toBeChecked();
    await expect(editRestrictionCard.getByTestId("payment-type-points")).toBeChecked();
    await expect(editRestrictionCard.getByTestId("payment-type-cert")).not.toBeChecked();

    // Verify removal
    await editRestrictionCard.getByTestId("restriction-remove-payment_type").click();
    await expect(editRestrictionCard).not.toBeVisible();

    // Save again to ensure deletion persists
    await page.getByTestId("promotion-form-submit").click();
    await expect(page).toHaveURL(/\/promotions$/);

    // Navigate back one more time to be absolutely sure
    await desktopList
      .getByRole("row")
      .filter({ hasText: promoName })
      .getByRole("link", { name: "Edit" })
      .click();
    await expect(page.getByTestId("restriction-card-payment_type")).not.toBeVisible();
  });
});
