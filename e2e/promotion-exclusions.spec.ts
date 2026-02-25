import { test, expect } from "./fixtures";

// Reference data (seeded): Marriott chain ID=2, sub-brands: Marriott Vacation Club ID=2023, Courtyard ID=2008
const MARRIOTT_CHAIN_ID = 2;
const MVC_SUB_BRAND_ID = 2023; // excluded
const COURTYARD_SUB_BRAND_ID = 2008; // not excluded

test.describe("Promotion exclusions", () => {
  test("booking at excluded sub-brand does NOT get promotion applied", async ({ request }) => {
    const promoName = `Exclusion Test ${crypto.randomUUID()}`;
    // Create a loyalty promotion for Marriott that excludes Marriott Vacation Club
    const promoRes = await request.post("/api/promotions", {
      data: {
        name: promoName,
        type: "loyalty",
        hotelChainId: MARRIOTT_CHAIN_ID,
        exclusionSubBrandIds: [MVC_SUB_BRAND_ID],
        benefits: [
          { rewardType: "cashback", valueType: "fixed", value: 50, certType: null, sortOrder: 0 },
        ],
        isActive: true,
      },
    });
    expect(promoRes.ok()).toBeTruthy();
    const promo = await promoRes.json();

    // Create a booking at the excluded sub-brand (Marriott Vacation Club)
    const bookingRes = await request.post("/api/bookings", {
      data: {
        hotelChainId: MARRIOTT_CHAIN_ID,
        hotelChainSubBrandId: MVC_SUB_BRAND_ID,
        propertyName: `MVC Test ${crypto.randomUUID()}`,
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
    const promoName = `Exclusion Test ${crypto.randomUUID()}`;
    // Create a loyalty promotion for Marriott that excludes MVC (but not Courtyard)
    const promoRes = await request.post("/api/promotions", {
      data: {
        name: promoName,
        type: "loyalty",
        hotelChainId: MARRIOTT_CHAIN_ID,
        exclusionSubBrandIds: [MVC_SUB_BRAND_ID],
        benefits: [
          { rewardType: "cashback", valueType: "fixed", value: 50, certType: null, sortOrder: 0 },
        ],
        isActive: true,
      },
    });
    expect(promoRes.ok()).toBeTruthy();
    const promo = await promoRes.json();

    // Create a booking at Courtyard (not excluded)
    const bookingRes = await request.post("/api/bookings", {
      data: {
        hotelChainId: MARRIOTT_CHAIN_ID,
        hotelChainSubBrandId: COURTYARD_SUB_BRAND_ID,
        propertyName: `Courtyard Test ${crypto.randomUUID()}`,
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
    const promoName = `Exclusion Remove Test ${crypto.randomUUID()}`;
    // Create promotion excluding MVC
    const promoRes = await request.post("/api/promotions", {
      data: {
        name: promoName,
        type: "loyalty",
        hotelChainId: MARRIOTT_CHAIN_ID,
        exclusionSubBrandIds: [MVC_SUB_BRAND_ID],
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
        hotelChainId: MARRIOTT_CHAIN_ID,
        hotelChainSubBrandId: MVC_SUB_BRAND_ID,
        propertyName: `MVC Remove Test ${crypto.randomUUID()}`,
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
