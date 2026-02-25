import { test, expect } from "./fixtures";

test.describe("Promotion exclusions", () => {
  test("booking at excluded sub-brand does NOT get promotion applied", async ({ request }) => {
    // Create a unique hotel chain and sub-brands for this test to avoid interference
    const chainRes = await request.post("/api/hotel-chains", {
      data: { name: `Chain ${crypto.randomUUID()}` },
    });
    const chain = await chainRes.json();
    const subBrand1Res = await request.post(
      `/api/hotel-chains/${chain.id}/hotel-chain-sub-brands`,
      { data: { name: `Sub1 ${crypto.randomUUID()}` } }
    );
    const subBrand1 = await subBrand1Res.json();

    const promoName = `Exclusion Test ${crypto.randomUUID()}`;
    // Create a loyalty promotion for the unique chain that excludes Sub1
    const promoRes = await request.post("/api/promotions", {
      data: {
        name: promoName,
        type: "loyalty",
        hotelChainId: chain.id,
        exclusionSubBrandIds: [subBrand1.id],
        benefits: [
          { rewardType: "cashback", valueType: "fixed", value: 50, certType: null, sortOrder: 0 },
        ],
        isActive: true,
      },
    });
    expect(promoRes.ok()).toBeTruthy();
    const promo = await promoRes.json();

    // Create a booking at the excluded sub-brand
    const bookingRes = await request.post("/api/bookings", {
      data: {
        hotelChainId: chain.id,
        hotelChainSubBrandId: subBrand1.id,
        propertyName: `Sub1 Test ${crypto.randomUUID()}`,
        checkIn: "2026-06-01",
        checkOut: "2026-06-03",
        numNights: 2,
        pretaxCost: 300,
        taxAmount: 50,
        totalCost: 350,
        currency: "USD",
        bookingSource: "direct_web",
      },
    });
    expect(bookingRes.ok()).toBeTruthy();
    const booking = await bookingRes.json();

    // Verify the promotion was NOT applied
    const detailRes = await request.get(`/api/bookings/${booking.id}`);
    const detail = await detailRes.json();
    const applied = (detail.bookingPromotions ?? []).find(
      (bp: { promotionId: number }) => bp.promotionId === promo.id
    );
    expect(applied).toBeUndefined();

    // Cleanup
    await request.delete(`/api/bookings/${booking.id}`);
    await request.delete(`/api/promotions/${promo.id}`);
  });

  test("booking at non-excluded sub-brand DOES get promotion applied", async ({ request }) => {
    // Create a unique hotel chain and sub-brands for this test to avoid interference
    const chainRes = await request.post("/api/hotel-chains", {
      data: { name: `Chain ${crypto.randomUUID()}` },
    });
    const chain = await chainRes.json();
    const subBrand1Res = await request.post(
      `/api/hotel-chains/${chain.id}/hotel-chain-sub-brands`,
      { data: { name: `Sub1 ${crypto.randomUUID()}` } }
    );
    const subBrand1 = await subBrand1Res.json();
    const subBrand2Res = await request.post(
      `/api/hotel-chains/${chain.id}/hotel-chain-sub-brands`,
      { data: { name: `Sub2 ${crypto.randomUUID()}` } }
    );
    const subBrand2 = await subBrand2Res.json();

    const promoName = `Exclusion Test ${crypto.randomUUID()}`;
    // Create a loyalty promotion for the unique chain that excludes Sub1
    const promoRes = await request.post("/api/promotions", {
      data: {
        name: promoName,
        type: "loyalty",
        hotelChainId: chain.id,
        exclusionSubBrandIds: [subBrand1.id],
        benefits: [
          { rewardType: "cashback", valueType: "fixed", value: 50, certType: null, sortOrder: 0 },
        ],
        isActive: true,
      },
    });
    expect(promoRes.ok()).toBeTruthy();
    const promo = await promoRes.json();

    // Create a booking at Sub2 (not excluded)
    const bookingRes = await request.post("/api/bookings", {
      data: {
        hotelChainId: chain.id,
        hotelChainSubBrandId: subBrand2.id,
        propertyName: `Sub2 Test ${crypto.randomUUID()}`,
        checkIn: "2026-06-01",
        checkOut: "2026-06-03",
        numNights: 2,
        pretaxCost: 300,
        taxAmount: 50,
        totalCost: 350,
        currency: "USD",
        bookingSource: "direct_web",
      },
    });
    expect(bookingRes.ok()).toBeTruthy();
    const booking = await bookingRes.json();

    // Verify the promotion WAS applied
    const detailRes = await request.get(`/api/bookings/${booking.id}`);
    const detail = await detailRes.json();
    const applied = (detail.bookingPromotions ?? []).find(
      (bp: { promotionId: number }) => bp.promotionId === promo.id
    );
    expect(applied).toBeDefined();
    expect(Number(applied.appliedValue)).toBe(50);

    // Cleanup
    await request.delete(`/api/bookings/${booking.id}`);
    await request.delete(`/api/promotions/${promo.id}`);
  });

  test("removing an exclusion causes previously-skipped booking to get promotion applied", async ({
    request,
  }) => {
    // Create a unique hotel chain and sub-brands for this test to avoid interference
    const chainRes = await request.post("/api/hotel-chains", {
      data: { name: `Chain ${crypto.randomUUID()}` },
    });
    const chain = await chainRes.json();
    const subBrand1Res = await request.post(
      `/api/hotel-chains/${chain.id}/hotel-chain-sub-brands`,
      { data: { name: `Sub1 ${crypto.randomUUID()}` } }
    );
    const subBrand1 = await subBrand1Res.json();

    const promoName = `Exclusion Remove Test ${crypto.randomUUID()}`;
    // Create promotion excluding Sub1
    const promoRes = await request.post("/api/promotions", {
      data: {
        name: promoName,
        type: "loyalty",
        hotelChainId: chain.id,
        exclusionSubBrandIds: [subBrand1.id],
        benefits: [
          { rewardType: "cashback", valueType: "fixed", value: 50, certType: null, sortOrder: 0 },
        ],
        isActive: true,
      },
    });
    expect(promoRes.ok()).toBeTruthy();
    const promo = await promoRes.json();

    // Create booking at excluded sub-brand
    const bookingRes = await request.post("/api/bookings", {
      data: {
        hotelChainId: chain.id,
        hotelChainSubBrandId: subBrand1.id,
        propertyName: `Sub1 Remove Test ${crypto.randomUUID()}`,
        checkIn: "2026-06-01",
        checkOut: "2026-06-03",
        numNights: 2,
        pretaxCost: 300,
        taxAmount: 50,
        totalCost: 350,
        currency: "USD",
        bookingSource: "direct_web",
      },
    });
    expect(bookingRes.ok()).toBeTruthy();
    const booking = await bookingRes.json();

    // Verify NOT applied initially
    const detailBeforeRes = await request.get(`/api/bookings/${booking.id}`);
    const detailBefore = await detailBeforeRes.json();
    const appliedBefore = (detailBefore.bookingPromotions ?? []).find(
      (bp: { promotionId: number }) => bp.promotionId === promo.id
    );
    expect(appliedBefore).toBeUndefined();

    // Remove the exclusion by updating promotion with empty exclusionSubBrandIds
    const updateRes = await request.put(`/api/promotions/${promo.id}`, {
      data: {
        exclusionSubBrandIds: [],
      },
    });
    expect(updateRes.ok()).toBeTruthy();

    // Verify NOW applied after exclusion removal
    const detailAfterRes = await request.get(`/api/bookings/${booking.id}`);
    const detailAfter = await detailAfterRes.json();
    const appliedAfter = (detailAfter.bookingPromotions ?? []).find(
      (bp: { promotionId: number }) => bp.promotionId === promo.id
    );
    expect(appliedAfter).toBeDefined();
    expect(Number(appliedAfter.appliedValue)).toBe(50);

    // Cleanup
    await request.delete(`/api/bookings/${booking.id}`);
    await request.delete(`/api/promotions/${promo.id}`);
  });
});
