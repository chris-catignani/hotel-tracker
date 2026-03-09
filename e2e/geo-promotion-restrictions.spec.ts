import crypto from "crypto";
import { test, expect } from "./fixtures";

/**
 * E2E tests for geo promotion restrictions (Issue #200 — PR 2).
 *
 * Verifies that allowedCountryCodes on a promotion's restrictions acts as a
 * structural match: the promotion is invisible for bookings in excluded countries
 * and for bookings with no countryCode.
 */

test.describe("Geography promotion restriction", () => {
  test("promotion with country restriction applies to matching-country booking", async ({
    request,
  }) => {
    const chains = await request.get("/api/hotel-chains");
    const chain = (await chains.json())[0];

    // Create a US-only promotion
    const promoRes = await request.post("/api/promotions", {
      data: {
        name: `Geo Promo US ${crypto.randomUUID()}`,
        type: "loyalty",
        benefits: [
          { rewardType: "cashback", valueType: "fixed", value: 50, certType: null, sortOrder: 0 },
        ],
        restrictions: { allowedCountryCodes: ["US"] },
      },
    });
    expect(promoRes.ok()).toBeTruthy();
    const promo = await promoRes.json();

    // Create a US booking
    const bookingRes = await request.post("/api/bookings", {
      data: {
        hotelChainId: chain.id,
        propertyName: `US Hotel ${crypto.randomUUID()}`,
        checkIn: "2025-07-01",
        checkOut: "2025-07-03",
        numNights: 2,
        pretaxCost: 200,
        taxAmount: 20,
        totalCost: 220,
        currency: "USD",
        countryCode: "US",
        city: "New York",
      },
    });
    const booking = await bookingRes.json();

    // Promotion should have been applied
    const bp = booking.bookingPromotions.find(
      (b: { promotionId: string }) => b.promotionId === promo.id
    );
    expect(bp).toBeDefined();
    expect(Number(bp.appliedValue)).toBe(50);

    await request.delete(`/api/bookings/${booking.id}`);
    await request.delete(`/api/promotions/${promo.id}`);
  });

  test("promotion with country restriction is invisible for wrong-country booking", async ({
    request,
  }) => {
    const chains = await request.get("/api/hotel-chains");
    const chain = (await chains.json())[0];

    const promoRes = await request.post("/api/promotions", {
      data: {
        name: `Geo Promo GB ${crypto.randomUUID()}`,
        type: "loyalty",
        benefits: [
          { rewardType: "cashback", valueType: "fixed", value: 50, certType: null, sortOrder: 0 },
        ],
        restrictions: { allowedCountryCodes: ["GB"] },
      },
    });
    const promo = await promoRes.json();

    // Create a MY booking (not GB)
    const bookingRes = await request.post("/api/bookings", {
      data: {
        hotelChainId: chain.id,
        propertyName: `MY Hotel ${crypto.randomUUID()}`,
        checkIn: "2025-08-01",
        checkOut: "2025-08-03",
        numNights: 2,
        pretaxCost: 200,
        taxAmount: 20,
        totalCost: 220,
        currency: "USD",
        countryCode: "MY",
        city: "Kuala Lumpur",
      },
    });
    const booking = await bookingRes.json();

    const bp = booking.bookingPromotions.find(
      (b: { promotionId: string }) => b.promotionId === promo.id
    );
    expect(bp).toBeUndefined();

    await request.delete(`/api/bookings/${booking.id}`);
    await request.delete(`/api/promotions/${promo.id}`);
  });

  test("promotion with country restriction is invisible for booking with no countryCode", async ({
    request,
  }) => {
    const chains = await request.get("/api/hotel-chains");
    const chain = (await chains.json())[0];

    const promoRes = await request.post("/api/promotions", {
      data: {
        name: `Geo Promo No Geo ${crypto.randomUUID()}`,
        type: "loyalty",
        benefits: [
          { rewardType: "cashback", valueType: "fixed", value: 50, certType: null, sortOrder: 0 },
        ],
        restrictions: { allowedCountryCodes: ["US"] },
      },
    });
    const promo = await promoRes.json();

    // Booking with no countryCode
    const bookingRes = await request.post("/api/bookings", {
      data: {
        hotelChainId: chain.id,
        propertyName: `No Geo Hotel ${crypto.randomUUID()}`,
        checkIn: "2025-09-01",
        checkOut: "2025-09-03",
        numNights: 2,
        pretaxCost: 200,
        taxAmount: 20,
        totalCost: 220,
        currency: "USD",
      },
    });
    const booking = await bookingRes.json();

    const bp = booking.bookingPromotions.find(
      (b: { promotionId: string }) => b.promotionId === promo.id
    );
    expect(bp).toBeUndefined();

    await request.delete(`/api/bookings/${booking.id}`);
    await request.delete(`/api/promotions/${promo.id}`);
  });

  test("promotion without country restriction applies regardless of booking location", async ({
    request,
  }) => {
    const chains = await request.get("/api/hotel-chains");
    const chain = (await chains.json())[0];

    const promoRes = await request.post("/api/promotions", {
      data: {
        name: `No Geo Restriction ${crypto.randomUUID()}`,
        type: "loyalty",
        benefits: [
          { rewardType: "cashback", valueType: "fixed", value: 25, certType: null, sortOrder: 0 },
        ],
      },
    });
    const promo = await promoRes.json();

    const bookingRes = await request.post("/api/bookings", {
      data: {
        hotelChainId: chain.id,
        propertyName: `JP Hotel ${crypto.randomUUID()}`,
        checkIn: "2025-10-01",
        checkOut: "2025-10-03",
        numNights: 2,
        pretaxCost: 200,
        taxAmount: 20,
        totalCost: 220,
        currency: "USD",
        countryCode: "JP",
        city: "Tokyo",
      },
    });
    const booking = await bookingRes.json();

    const bp = booking.bookingPromotions.find(
      (b: { promotionId: string }) => b.promotionId === promo.id
    );
    expect(bp).toBeDefined();

    await request.delete(`/api/bookings/${booking.id}`);
    await request.delete(`/api/promotions/${promo.id}`);
  });
});
