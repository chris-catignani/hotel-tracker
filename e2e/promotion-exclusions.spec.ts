import { test, expect } from "./fixtures";

test.describe("Promotion sub-brand scope (exclude)", () => {
  test("Promotion exclusion: booking at excluded sub-brand does NOT get promotion applied", async ({
    request,
    testHotelChain,
    testSubBrand,
  }) => {
    const subBrand1 = await testSubBrand();

    const promoName = `Exclusion Test ${crypto.randomUUID()}`;
    const promoRes = await request.post("/api/promotions", {
      data: {
        name: promoName,
        type: "loyalty",
        hotelChainId: testHotelChain.id,
        restrictions: { subBrandExcludeIds: [subBrand1.id] },
        benefits: [
          { rewardType: "cashback", valueType: "fixed", value: 50, certType: null, sortOrder: 0 },
        ],
      },
    });
    expect(promoRes.ok()).toBeTruthy();
    const promo = await promoRes.json();

    // Create a booking at the excluded sub-brand
    const bookingRes = await request.post("/api/bookings", {
      data: {
        hotelChainId: testHotelChain.id,
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
      (bp: { promotionId: string }) => bp.promotionId === promo.id
    );
    expect(applied).toBeUndefined();

    // Cleanup
    await request.delete(`/api/bookings/${booking.id}`);
    await request.delete(`/api/promotions/${promo.id}`);
  });

  test("Promotion exclusion: booking at non-excluded sub-brand DOES get promotion applied", async ({
    request,
    testHotelChain,
    testSubBrand,
  }) => {
    const subBrand1 = await testSubBrand();
    const subBrand2 = await testSubBrand();

    const promoName = `Exclusion Test ${crypto.randomUUID()}`;
    const promoRes = await request.post("/api/promotions", {
      data: {
        name: promoName,
        type: "loyalty",
        hotelChainId: testHotelChain.id,
        restrictions: { subBrandExcludeIds: [subBrand1.id] },
        benefits: [
          { rewardType: "cashback", valueType: "fixed", value: 50, certType: null, sortOrder: 0 },
        ],
      },
    });
    expect(promoRes.ok()).toBeTruthy();
    const promo = await promoRes.json();

    // Create a booking at Sub2 (not excluded)
    const bookingRes = await request.post("/api/bookings", {
      data: {
        hotelChainId: testHotelChain.id,
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
      (bp: { promotionId: string }) => bp.promotionId === promo.id
    );
    expect(applied).toBeDefined();
    expect(Number(applied.appliedValue)).toBe(50);

    // Cleanup
    await request.delete(`/api/bookings/${booking.id}`);
    await request.delete(`/api/promotions/${promo.id}`);
  });

  test("Promotion exclusion: removing an exclusion causes previously-skipped booking to get promotion applied", async ({
    request,
    testHotelChain,
    testSubBrand,
  }) => {
    const subBrand1 = await testSubBrand();

    const promoName = `Exclusion Remove Test ${crypto.randomUUID()}`;
    const promoRes = await request.post("/api/promotions", {
      data: {
        name: promoName,
        type: "loyalty",
        hotelChainId: testHotelChain.id,
        restrictions: { subBrandExcludeIds: [subBrand1.id] },
        benefits: [
          { rewardType: "cashback", valueType: "fixed", value: 50, certType: null, sortOrder: 0 },
        ],
      },
    });
    expect(promoRes.ok()).toBeTruthy();
    const promo = await promoRes.json();

    // Create booking at excluded sub-brand
    const bookingRes = await request.post("/api/bookings", {
      data: {
        hotelChainId: testHotelChain.id,
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
      (bp: { promotionId: string }) => bp.promotionId === promo.id
    );
    expect(appliedBefore).toBeUndefined();

    // Remove the exclusion by updating promotion with empty subBrandExcludeIds
    const updateRes = await request.put(`/api/promotions/${promo.id}`, {
      data: {
        restrictions: { subBrandExcludeIds: [] },
      },
    });
    expect(updateRes.ok()).toBeTruthy();

    // Verify NOW applied after exclusion removal
    const detailAfterRes = await request.get(`/api/bookings/${booking.id}`);
    const detailAfter = await detailAfterRes.json();
    const appliedAfter = (detailAfter.bookingPromotions ?? []).find(
      (bp: { promotionId: string }) => bp.promotionId === promo.id
    );
    expect(appliedAfter).toBeDefined();
    expect(Number(appliedAfter.appliedValue)).toBe(50);

    // Cleanup
    await request.delete(`/api/bookings/${booking.id}`);
    await request.delete(`/api/promotions/${promo.id}`);
  });
});
