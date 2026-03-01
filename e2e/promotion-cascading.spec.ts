/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, expect } from "./fixtures";
import crypto from "crypto";

test.describe("Promotion Cascading Re-evaluation", () => {
  test("should update later stay rewards when earlier stay is edited (chronological consistency)", async ({
    request,
    testHotelChain,
  }) => {
    // 1. Create a capped promotion: $100 max redemption, $50 per stay
    const promoName = `Cascading Promo ${crypto.randomUUID()}`;
    const promoRes = await request.post("/api/promotions", {
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
    const booking1Res = await request.post("/api/bookings", {
      data: {
        hotelChainId: testHotelChain.id,
        propertyName: "Stay 1",
        checkIn: "2026-01-01",
        checkOut: "2026-01-03",
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
    const booking2Res = await request.post("/api/bookings", {
      data: {
        hotelChainId: testHotelChain.id,
        propertyName: "Stay 2",
        checkIn: "2026-02-01",
        checkOut: "2026-02-03",
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
    const booking3Res = await request.post("/api/bookings", {
      data: {
        hotelChainId: testHotelChain.id,
        propertyName: "Stay 3",
        checkIn: "2026-03-01",
        checkOut: "2026-03-03",
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
    const otherHotelRes = await request.post("/api/hotel-chains", {
      data: { name: "Other Chain", loyaltyProgram: "Other", basePointRate: 0 },
    });
    const otherHotel = await otherHotelRes.json();

    const updateRes = await request.put(`/api/bookings/${booking1.id}`, {
      data: {
        hotelChainId: otherHotel.id,
      },
    });
    if (!updateRes.ok()) {
      console.log(`[ERROR] Update failed:`, await updateRes.text());
    }
    expect(updateRes.ok()).toBeTruthy();

    // 6. Verify Booking 3 now has $50 reward automatically
    const finalBooking3Res = await request.get(
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
    await request.delete(`/api/bookings/${booking1.id}`);
    await request.delete(`/api/bookings/${booking2.id}`);
    await request.delete(`/api/bookings/${booking3.id}`);
    await request.delete(`/api/promotions/${promo.id}`);
    await request.delete(`/api/hotel-chains/${otherHotel.id}`);
  });

  test("should update later stay rewards when earlier stay is deleted", async ({
    request,
    testHotelChain,
  }) => {
    // 1. Create a capped promotion: $50 max redemption
    const promoRes = await request.post("/api/promotions", {
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
    const b1Res = await request.post("/api/bookings", {
      data: {
        hotelChainId: testHotelChain.id,
        propertyName: "Jan Stay",
        checkIn: "2026-01-01",
        checkOut: "2026-01-02",
        numNights: 1,
        pretaxCost: 100,
        taxAmount: 10,
        totalCost: 110,
      },
    });
    expect(b1Res.ok()).toBeTruthy();
    const b1 = await b1Res.json();

    // 3. Booking 2 (Feb) gets $0 (capped)
    const b2Res = await request.post("/api/bookings", {
      data: {
        hotelChainId: testHotelChain.id,
        propertyName: "Feb Stay",
        checkIn: "2026-02-01",
        checkOut: "2026-02-02",
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
    const delRes = await request.delete(`/api/bookings/${b1.id}`);
    if (!delRes.ok()) {
      console.log(`[ERROR] Delete failed:`, await delRes.text());
    }
    expect(delRes.ok()).toBeTruthy();

    // 5. Verify Booking 2 now has $50
    const b2FinalRes = await request.get(`/api/bookings/${b2.id}?includePromotions=true`);
    const b2Final = await b2FinalRes.json();
    const bp2Final = (b2Final.bookingPromotions || []).find((p: any) => p.promotionId === promo.id);
    expect(bp2Final).toBeDefined();
    expect(Number(bp2Final.appliedValue)).toBe(50);

    // Cleanup
    await request.delete(`/api/bookings/${b2.id}`);
    await request.delete(`/api/promotions/${promo.id}`);
  });
});
