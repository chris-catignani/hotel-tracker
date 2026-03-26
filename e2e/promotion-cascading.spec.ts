/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, expect } from "./fixtures";
import crypto from "crypto";

const YEAR = new Date().getFullYear();

test.describe("Promotion Cascading Re-evaluation", () => {
  test("should update later stay rewards when earlier stay is edited (chronological consistency)", async ({
    isolatedUser,
    adminRequest,
    testHotelChain,
  }) => {
    // 1. Create a capped promotion: $100 max redemption, $50 per stay
    const promoName = `Cascading Promo ${crypto.randomUUID()}`;
    const promoRes = await isolatedUser.request.post("/api/promotions", {
      data: {
        name: promoName,
        type: "loyalty",
        hotelChainId: testHotelChain.id,
        restrictions: {
          maxRedemptionValue: 100, // Capped at $100
        },
        benefits: [
          {
            rewardType: "cashback",
            valueType: "fixed",
            value: 50,
            sortOrder: 0,
          },
        ],
      },
    });
    if (!promoRes.ok()) {
      console.log(`[ERROR] Promo creation failed:`, await promoRes.text());
    }
    expect(promoRes.ok()).toBeTruthy();
    const promo = await promoRes.json();

    // 2. Create Booking 1 (Jan 2026) -> Should get $50
    const booking1Res = await isolatedUser.request.post("/api/bookings", {
      data: {
        hotelChainId: testHotelChain.id,
        propertyName: "Stay 1",
        checkIn: `${YEAR}-01-01`,
        checkOut: `${YEAR}-01-03`,
        numNights: 2,
        pretaxCost: 200,
        taxAmount: 20,
        totalCost: 220,
      },
    });
    expect(booking1Res.ok()).toBeTruthy();
    const booking1 = await booking1Res.json();
    const bp1 = booking1.bookingPromotions.find((p: any) => p.promotionId === promo.id);
    expect(Number(bp1.appliedValue)).toBe(50);

    // 3. Create Booking 2 (Feb 2026) -> Should get $50 (Total $100, hits cap)
    const booking2Res = await isolatedUser.request.post("/api/bookings", {
      data: {
        hotelChainId: testHotelChain.id,
        propertyName: "Stay 2",
        checkIn: `${YEAR}-02-01`,
        checkOut: `${YEAR}-02-03`,
        numNights: 2,
        pretaxCost: 200,
        taxAmount: 20,
        totalCost: 220,
      },
    });
    expect(booking2Res.ok()).toBeTruthy();
    const booking2 = await booking2Res.json();
    const bp2 = booking2.bookingPromotions.find((p: any) => p.promotionId === promo.id);
    expect(Number(bp2.appliedValue)).toBe(50);

    // 4. Create Booking 3 (Mar 2026) -> Should get $0 (Capped)
    const booking3Res = await isolatedUser.request.post("/api/bookings", {
      data: {
        hotelChainId: testHotelChain.id,
        propertyName: "Stay 3",
        checkIn: `${YEAR}-03-01`,
        checkOut: `${YEAR}-03-03`,
        numNights: 2,
        pretaxCost: 200,
        taxAmount: 20,
        totalCost: 220,
      },
    });
    expect(booking3Res.ok()).toBeTruthy();
    const booking3 = await booking3Res.json();
    const bp3 = (booking3.bookingPromotions || []).find((p: any) => p.promotionId === promo.id);
    // Note: It might not even be matched if it was fully capped before our latest fix?
    // Actually, matched promotions always exist in the array now, even if 0 value.
    expect(bp3).toBeDefined();
    expect(Number(bp3.appliedValue)).toBe(0);

    // 5. EDIT Booking 1 to be ineligible (change hotel chain)
    // Create another hotel chain first
    const otherHotelRes = await adminRequest.post("/api/hotel-chains", {
      data: { name: "Other Chain", loyaltyProgram: "Other", basePointRate: 0 },
    });
    const otherHotel = await otherHotelRes.json();

    const updateRes = await isolatedUser.request.put(`/api/bookings/${booking1.id}`, {
      data: {
        hotelChainId: otherHotel.id,
      },
    });
    if (!updateRes.ok()) {
      console.log(`[ERROR] Update failed:`, await updateRes.text());
    }
    expect(updateRes.ok()).toBeTruthy();

    // 6. Verify Booking 3 now has $50 reward automatically
    const finalBooking3Res = await isolatedUser.request.get(
      `/api/bookings/${booking3.id}?includePromotions=true`
    );
    expect(finalBooking3Res.ok()).toBeTruthy();
    const finalBooking3 = await finalBooking3Res.json();
    const finalBp3 = (finalBooking3.bookingPromotions || []).find(
      (p: any) => p.promotionId === promo.id
    );
    expect(finalBp3).toBeDefined();
    expect(Number(finalBp3.appliedValue)).toBe(50);

    // Cleanup
    await isolatedUser.request.delete(`/api/bookings/${booking1.id}`);
    await isolatedUser.request.delete(`/api/bookings/${booking2.id}`);
    await isolatedUser.request.delete(`/api/bookings/${booking3.id}`);
    await isolatedUser.request.delete(`/api/promotions/${promo.id}`);
    await adminRequest.delete(`/api/hotel-chains/${otherHotel.id}`);
  });

  test("should update later stay rewards when earlier stay is deleted", async ({
    isolatedUser,
    testHotelChain,
  }) => {
    // 1. Create a capped promotion: $50 max redemption
    const promoRes = await isolatedUser.request.post("/api/promotions", {
      data: {
        name: `Delete Cascading ${crypto.randomUUID()}`,
        type: "loyalty",
        hotelChainId: testHotelChain.id,
        restrictions: { maxRedemptionValue: 50 },
        benefits: [{ rewardType: "cashback", valueType: "fixed", value: 50, sortOrder: 0 }],
      },
    });
    if (!promoRes.ok()) {
      console.log(`[ERROR] Promo creation 2 failed:`, await promoRes.text());
    }
    expect(promoRes.ok()).toBeTruthy();
    const promo = await promoRes.json();

    // 2. Booking 1 (Jan) gets the $50
    const b1Res = await isolatedUser.request.post("/api/bookings", {
      data: {
        hotelChainId: testHotelChain.id,
        propertyName: "Jan Stay",
        checkIn: `${YEAR}-01-01`,
        checkOut: `${YEAR}-01-02`,
        numNights: 1,
        pretaxCost: 100,
        taxAmount: 10,
        totalCost: 110,
      },
    });
    expect(b1Res.ok()).toBeTruthy();
    const b1 = await b1Res.json();

    // 3. Booking 2 (Feb) gets $0 (capped)
    const b2Res = await isolatedUser.request.post("/api/bookings", {
      data: {
        hotelChainId: testHotelChain.id,
        propertyName: "Feb Stay",
        checkIn: `${YEAR}-02-01`,
        checkOut: `${YEAR}-02-02`,
        numNights: 1,
        pretaxCost: 100,
        taxAmount: 10,
        totalCost: 110,
      },
    });
    expect(b2Res.ok()).toBeTruthy();
    const b2 = await b2Res.json();
    const bp2Initial = (b2.bookingPromotions || []).find((p: any) => p.promotionId === promo.id);
    expect(bp2Initial).toBeDefined();
    expect(Number(bp2Initial.appliedValue)).toBe(0);

    // 4. DELETE Booking 1
    const delRes = await isolatedUser.request.delete(`/api/bookings/${b1.id}`);
    if (!delRes.ok()) {
      console.log(`[ERROR] Delete failed:`, await delRes.text());
    }
    expect(delRes.ok()).toBeTruthy();

    // 5. Verify Booking 2 now has $50
    const b2FinalRes = await isolatedUser.request.get(
      `/api/bookings/${b2.id}?includePromotions=true`
    );
    const b2Final = await b2FinalRes.json();
    const bp2Final = (b2Final.bookingPromotions || []).find((p: any) => p.promotionId === promo.id);
    expect(bp2Final).toBeDefined();
    expect(Number(bp2Final.appliedValue)).toBe(50);

    // Cleanup
    await isolatedUser.request.delete(`/api/bookings/${b2.id}`);
    await isolatedUser.request.delete(`/api/promotions/${promo.id}`);
  });

  test("should auto-apply a new promotion to an existing matching booking", async ({
    isolatedUser,
    testHotelChain,
  }) => {
    const bookingRes = await isolatedUser.request.post("/api/bookings", {
      data: {
        hotelChainId: testHotelChain.id,
        propertyName: `Cascade Create ${crypto.randomUUID()}`,
        checkIn: `${YEAR}-04-01`,
        checkOut: `${YEAR}-04-03`,
        numNights: 2,
        pretaxCost: 200,
        taxAmount: 20,
        totalCost: 220,
      },
    });
    expect(bookingRes.ok()).toBeTruthy();
    const booking = await bookingRes.json();

    const promoRes = await isolatedUser.request.post("/api/promotions", {
      data: {
        name: `Auto Apply ${crypto.randomUUID()}`,
        type: "loyalty",
        hotelChainId: testHotelChain.id,
        benefits: [{ rewardType: "cashback", valueType: "fixed", value: 30, sortOrder: 0 }],
      },
    });
    expect(promoRes.ok()).toBeTruthy();
    const promo = await promoRes.json();

    try {
      const refreshRes = await isolatedUser.request.get(`/api/bookings/${booking.id}`);
      expect(refreshRes.ok()).toBeTruthy();
      const refreshed = await refreshRes.json();
      const bp = (refreshed.bookingPromotions ?? []).find((p: any) => p.promotionId === promo.id);
      expect(bp).toBeDefined();
      expect(Number(bp.appliedValue)).toBe(30);
    } finally {
      await isolatedUser.request.delete(`/api/bookings/${booking.id}`);
      await isolatedUser.request.delete(`/api/promotions/${promo.id}`);
    }
  });

  test("should remove a promotion from its booking when the promotion is deleted", async ({
    isolatedUser,
    testHotelChain,
  }) => {
    const bookingRes = await isolatedUser.request.post("/api/bookings", {
      data: {
        hotelChainId: testHotelChain.id,
        propertyName: `Cascade Delete ${crypto.randomUUID()}`,
        checkIn: `${YEAR}-05-01`,
        checkOut: `${YEAR}-05-03`,
        numNights: 2,
        pretaxCost: 200,
        taxAmount: 20,
        totalCost: 220,
      },
    });
    expect(bookingRes.ok()).toBeTruthy();
    const booking = await bookingRes.json();

    const promoRes = await isolatedUser.request.post("/api/promotions", {
      data: {
        name: `Delete Promo ${crypto.randomUUID()}`,
        type: "loyalty",
        hotelChainId: testHotelChain.id,
        benefits: [{ rewardType: "cashback", valueType: "fixed", value: 40, sortOrder: 0 }],
      },
    });
    expect(promoRes.ok()).toBeTruthy();
    const promo = await promoRes.json();

    // Confirm promo is applied
    const beforeRes = await isolatedUser.request.get(`/api/bookings/${booking.id}`);
    const before = await beforeRes.json();
    expect(
      (before.bookingPromotions ?? []).some((p: any) => p.promotionId === promo.id)
    ).toBeTruthy();

    try {
      // Delete the promotion
      const delRes = await isolatedUser.request.delete(`/api/promotions/${promo.id}`);
      expect(delRes.ok()).toBeTruthy();

      // Confirm promo is gone from booking
      const afterRes = await isolatedUser.request.get(`/api/bookings/${booking.id}`);
      const after = await afterRes.json();
      expect(
        (after.bookingPromotions ?? []).some((p: any) => p.promotionId === promo.id)
      ).toBeFalsy();
    } finally {
      await isolatedUser.request.delete(`/api/bookings/${booking.id}`);
      // promo already deleted; ignore 404
      await isolatedUser.request.delete(`/api/promotions/${promo.id}`).catch(() => {});
    }
  });

  test("should apply/remove a promotion to a booking when criteria change", async ({
    isolatedUser,
    adminRequest,
    testHotelChain,
  }) => {
    // Create a second chain to scope the promo to initially (no match)
    const otherChainRes = await adminRequest.post("/api/hotel-chains", {
      data: { name: `Other Chain ${crypto.randomUUID()}` },
    });
    expect(otherChainRes.ok()).toBeTruthy();
    const otherChain = await otherChainRes.json();

    const bookingRes = await isolatedUser.request.post("/api/bookings", {
      data: {
        hotelChainId: testHotelChain.id,
        propertyName: `Cascade Update ${crypto.randomUUID()}`,
        checkIn: `${YEAR}-06-01`,
        checkOut: `${YEAR}-06-03`,
        numNights: 2,
        pretaxCost: 200,
        taxAmount: 20,
        totalCost: 220,
      },
    });
    expect(bookingRes.ok()).toBeTruthy();
    const booking = await bookingRes.json();

    // Promo scoped to otherChain → no match with booking
    const promoRes = await isolatedUser.request.post("/api/promotions", {
      data: {
        name: `Update Criteria ${crypto.randomUUID()}`,
        type: "loyalty",
        hotelChainId: otherChain.id,
        benefits: [{ rewardType: "cashback", valueType: "fixed", value: 50, sortOrder: 0 }],
      },
    });
    expect(promoRes.ok()).toBeTruthy();
    const promo = await promoRes.json();

    try {
      // No match yet
      const noMatchRes = await isolatedUser.request.get(`/api/bookings/${booking.id}`);
      const noMatch = await noMatchRes.json();
      expect(
        (noMatch.bookingPromotions ?? []).some((p: any) => p.promotionId === promo.id)
      ).toBeFalsy();

      // Update promo to match testHotelChain → booking gains it
      const gainRes = await isolatedUser.request.put(`/api/promotions/${promo.id}`, {
        data: { hotelChainId: testHotelChain.id },
      });
      expect(gainRes.ok()).toBeTruthy();

      const gainedRes = await isolatedUser.request.get(`/api/bookings/${booking.id}`);
      const gained = await gainedRes.json();
      const gainedBp = (gained.bookingPromotions ?? []).find(
        (p: any) => p.promotionId === promo.id
      );
      expect(gainedBp).toBeDefined();
      expect(Number(gainedBp.appliedValue)).toBe(50);

      // Revert promo back to otherChain → booking loses it
      const loseRes = await isolatedUser.request.put(`/api/promotions/${promo.id}`, {
        data: { hotelChainId: otherChain.id },
      });
      expect(loseRes.ok()).toBeTruthy();

      const lostRes = await isolatedUser.request.get(`/api/bookings/${booking.id}`);
      const lost = await lostRes.json();
      expect(
        (lost.bookingPromotions ?? []).some((p: any) => p.promotionId === promo.id)
      ).toBeFalsy();
    } finally {
      await isolatedUser.request.delete(`/api/bookings/${booking.id}`);
      await isolatedUser.request.delete(`/api/promotions/${promo.id}`);
      await adminRequest.delete(`/api/hotel-chains/${otherChain.id}`);
    }
  });
});
