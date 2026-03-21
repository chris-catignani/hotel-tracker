import crypto from "crypto";
import type { APIRequestContext } from "@playwright/test";
import { test, expect } from "./fixtures";

/**
 * E2E tests for geo promotion restrictions (Issue #200 — PR 2).
 *
 * Verifies that allowedCountryCodes on a promotion's restrictions acts as a
 * structural match: the promotion is invisible for bookings in excluded countries
 * and for bookings with no countryCode.
 */

test.describe("Geography promotion restriction", () => {
  const createGeoPromo = async (
    request: APIRequestContext,
    promoIds: string[],
    data: Record<string, unknown>
  ) => {
    const promoRes = await request.post("/api/promotions", { data });
    expect(promoRes.ok()).toBeTruthy();
    const promo = await promoRes.json();
    promoIds.push(promo.id);
    return promo;
  };

  const createBooking = async (
    request: APIRequestContext,
    bookingIds: string[],
    data: Record<string, unknown>
  ) => {
    const bookingRes = await request.post("/api/bookings", { data });
    expect(bookingRes.ok()).toBeTruthy();
    const booking = await bookingRes.json();
    bookingIds.push(booking.id);
    return booking;
  };

  test("promotion with country restriction applies to matching-country booking", async ({
    isolatedUser,
    adminRequest,
  }) => {
    const localPromoIds: string[] = [];
    const localBookingIds: string[] = [];
    try {
      const chains = await adminRequest.get("/api/hotel-chains");
      const chain = (await chains.json())[0];

      const promo = await createGeoPromo(isolatedUser.request, localPromoIds, {
        name: `Geo Promo US ${crypto.randomUUID()}`,
        type: "loyalty",
        hotelChainId: chain.id,
        benefits: [
          { rewardType: "cashback", valueType: "fixed", value: 50, certType: null, sortOrder: 0 },
        ],
        restrictions: { allowedCountryCodes: ["US"] },
      });

      const booking = await createBooking(isolatedUser.request, localBookingIds, {
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
      });

      const bp = booking.bookingPromotions.find(
        (b: { promotionId: string }) => b.promotionId === promo.id
      );
      expect(bp).toBeDefined();
      expect(Number(bp.appliedValue)).toBe(50);
    } finally {
      for (const id of localBookingIds) await isolatedUser.request.delete(`/api/bookings/${id}`);
      for (const id of localPromoIds) await isolatedUser.request.delete(`/api/promotions/${id}`);
    }
  });

  test("promotion with country restriction is invisible for wrong-country booking", async ({
    isolatedUser,
    adminRequest,
  }) => {
    const localPromoIds: string[] = [];
    const localBookingIds: string[] = [];
    try {
      const chains = await adminRequest.get("/api/hotel-chains");
      const chain = (await chains.json())[0];

      const promo = await createGeoPromo(isolatedUser.request, localPromoIds, {
        name: `Geo Promo GB ${crypto.randomUUID()}`,
        type: "loyalty",
        hotelChainId: chain.id,
        benefits: [
          { rewardType: "cashback", valueType: "fixed", value: 50, certType: null, sortOrder: 0 },
        ],
        restrictions: { allowedCountryCodes: ["GB"] },
      });

      const booking = await createBooking(isolatedUser.request, localBookingIds, {
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
      });

      const bp = booking.bookingPromotions.find(
        (b: { promotionId: string }) => b.promotionId === promo.id
      );
      expect(bp).toBeUndefined();
    } finally {
      for (const id of localBookingIds) await isolatedUser.request.delete(`/api/bookings/${id}`);
      for (const id of localPromoIds) await isolatedUser.request.delete(`/api/promotions/${id}`);
    }
  });

  test("promotion with country restriction is invisible for booking with no countryCode", async ({
    isolatedUser,
    adminRequest,
  }) => {
    const localPromoIds: string[] = [];
    const localBookingIds: string[] = [];
    try {
      const chains = await adminRequest.get("/api/hotel-chains");
      const chain = (await chains.json())[0];

      const promo = await createGeoPromo(isolatedUser.request, localPromoIds, {
        name: `Geo Promo No Geo ${crypto.randomUUID()}`,
        type: "loyalty",
        hotelChainId: chain.id,
        benefits: [
          { rewardType: "cashback", valueType: "fixed", value: 50, certType: null, sortOrder: 0 },
        ],
        restrictions: { allowedCountryCodes: ["US"] },
      });

      const booking = await createBooking(isolatedUser.request, localBookingIds, {
        hotelChainId: chain.id,
        propertyName: `No Geo Hotel ${crypto.randomUUID()}`,
        checkIn: "2025-09-01",
        checkOut: "2025-09-03",
        numNights: 2,
        pretaxCost: 200,
        taxAmount: 20,
        totalCost: 220,
        currency: "USD",
      });

      const bp = booking.bookingPromotions.find(
        (b: { promotionId: string }) => b.promotionId === promo.id
      );
      expect(bp).toBeUndefined();
    } finally {
      for (const id of localBookingIds) await isolatedUser.request.delete(`/api/bookings/${id}`);
      for (const id of localPromoIds) await isolatedUser.request.delete(`/api/promotions/${id}`);
    }
  });

  test("promotion without country restriction applies regardless of booking location", async ({
    isolatedUser,
    adminRequest,
  }) => {
    const localPromoIds: string[] = [];
    const localBookingIds: string[] = [];
    try {
      const chains = await adminRequest.get("/api/hotel-chains");
      const chain = (await chains.json())[0];

      const promo = await createGeoPromo(isolatedUser.request, localPromoIds, {
        name: `No Geo Restriction ${crypto.randomUUID()}`,
        type: "loyalty",
        hotelChainId: chain.id,
        benefits: [
          { rewardType: "cashback", valueType: "fixed", value: 25, certType: null, sortOrder: 0 },
        ],
      });

      const booking = await createBooking(isolatedUser.request, localBookingIds, {
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
      });

      const bp = booking.bookingPromotions.find(
        (b: { promotionId: string }) => b.promotionId === promo.id
      );
      expect(bp).toBeDefined();
    } finally {
      for (const id of localBookingIds) await isolatedUser.request.delete(`/api/bookings/${id}`);
      for (const id of localPromoIds) await isolatedUser.request.delete(`/api/promotions/${id}`);
    }
  });
});
