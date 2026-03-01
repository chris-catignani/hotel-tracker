import { test, expect } from "./fixtures";

test.describe("Promotion hotel chain restriction", () => {
  test("Credit Card promo: matches only when booking matches chain restriction", async ({
    request,
    testHotelChain,
  }) => {
    // 1. Create a Credit Card promotion restricted to a specific chain
    const promoRes = await request.post("/api/promotions", {
      data: {
        name: `CC Chain restricted ${crypto.randomUUID()}`,
        type: "credit_card",
        creditCardId: "cme8yfwy2hfqahb6ync8czd24", // Amex Platinum
        restrictions: { hotelChainId: testHotelChain.id },
        benefits: [
          { rewardType: "cashback", valueType: "fixed", value: 100, certType: null, sortOrder: 0 },
        ],
      },
    });
    expect(promoRes.ok()).toBeTruthy();
    const promo = await promoRes.json();

    // 2. Create a booking for the MATCHING chain
    const bookingMatchRes = await request.post("/api/bookings", {
      data: {
        hotelChainId: testHotelChain.id,
        creditCardId: "cme8yfwy2hfqahb6ync8czd24",
        propertyName: `Match Stay ${crypto.randomUUID()}`,
        checkIn: "2026-06-01",
        checkOut: "2026-06-03",
        numNights: 2,
        pretaxCost: 300,
        taxAmount: 50,
        totalCost: 350,
        currency: "USD",
      },
    });
    expect(bookingMatchRes.ok()).toBeTruthy();
    const bookingMatch = await bookingMatchRes.json();

    // Verify applied
    const matchDetail = await (await request.get(`/api/bookings/${bookingMatch.id}`)).json();
    expect(
      matchDetail.bookingPromotions.some(
        (bp: { promotionId: string }) => bp.promotionId === promo.id
      )
    ).toBeTruthy();

    // 3. Create a booking for a DIFFERENT chain
    // Find another chain
    const chains = await (await request.get("/api/hotel-chains")).json();
    const otherChain = chains.find((c: { id: string }) => c.id !== testHotelChain.id);

    const bookingOtherRes = await request.post("/api/bookings", {
      data: {
        hotelChainId: otherChain.id,
        creditCardId: "cme8yfwy2hfqahb6ync8czd24",
        propertyName: `Other Stay ${crypto.randomUUID()}`,
        checkIn: "2026-06-05",
        checkOut: "2026-06-07",
        numNights: 2,
        pretaxCost: 300,
        taxAmount: 50,
        totalCost: 350,
        currency: "USD",
      },
    });
    expect(bookingOtherRes.ok()).toBeTruthy();
    const bookingOther = await bookingOtherRes.json();

    // Verify NOT applied
    const otherDetail = await (await request.get(`/api/bookings/${bookingOther.id}`)).json();
    expect(
      otherDetail.bookingPromotions.some(
        (bp: { promotionId: string }) => bp.promotionId === promo.id
      )
    ).toBeFalsy();

    // Cleanup
    await request.delete(`/api/bookings/${bookingMatch.id}`);
    await request.delete(`/api/bookings/${bookingOther.id}`);
    await request.delete(`/api/promotions/${promo.id}`);
  });
});
