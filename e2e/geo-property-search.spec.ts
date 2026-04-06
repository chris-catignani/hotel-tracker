import crypto from "crypto";
import { test, expect } from "./fixtures";

/**
 * E2E tests for geographic property search (Issue #200 — PR 1).
 *
 * These tests verify:
 * 1. Bookings can be saved with countryCode/city via the API
 * 2. The booking detail page shows the location when countryCode/city are present
 * 3. Bookings without geo data still work normally
 */

test.describe("Geo Property Search — Booking with location data", () => {
  test("booking detail page shows location when countryCode and city are present", async ({
    isolatedUser,
    adminRequest,
  }) => {
    const chains = await adminRequest.get("/api/hotel-chains");
    const chain = (await chains.json())[0];

    const uniqueName = `Geo Test Hotel ${crypto.randomUUID()}`;
    const res = await isolatedUser.request.post("/api/bookings", {
      data: {
        hotelChainId: chain.id,
        propertyName: uniqueName,
        checkIn: "2025-08-01",
        checkOut: "2025-08-03",
        numNights: 2,
        pretaxCost: 200,
        taxAmount: 20,
        totalCost: 220,
        currency: "USD",
        countryCode: "US",
        city: "New York",
      },
    });
    expect(res.ok()).toBeTruthy();
    const booking = await res.json();

    await isolatedUser.page.goto(`/bookings/${booking.id}`);
    await expect(isolatedUser.page.getByTestId("booking-location")).toBeVisible();
    await expect(isolatedUser.page.getByTestId("booking-location")).toContainText("New York");
    await expect(isolatedUser.page.getByTestId("booking-location")).toContainText("US");

    // Cleanup
    await isolatedUser.request.delete(`/api/bookings/${booking.id}`);
  });

  test("booking detail page does not show location when geo data is absent", async ({
    isolatedUser,
    adminRequest,
  }) => {
    const chains = await adminRequest.get("/api/hotel-chains");
    const chain = (await chains.json())[0];

    const uniqueName = `Geo Test Hotel ${crypto.randomUUID()}`;
    const res = await isolatedUser.request.post("/api/bookings", {
      data: {
        hotelChainId: chain.id,
        propertyName: uniqueName,
        checkIn: "2025-08-01",
        checkOut: "2025-08-03",
        numNights: 2,
        pretaxCost: 200,
        taxAmount: 20,
        totalCost: 220,
        currency: "USD",
        bookingSource: "direct_web",
      },
    });
    const booking = await res.json();

    try {
      await isolatedUser.page.goto(`/bookings/${booking.id}`);
      await expect(isolatedUser.page.getByTestId("hero-property-name")).toBeVisible();
      await expect(isolatedUser.page.getByTestId("booking-location")).not.toBeVisible();
    } finally {
      await isolatedUser.request.delete(`/api/bookings/${booking.id}`);
    }
  });

  test("booking with countryCode is saved and returned by GET API", async ({
    isolatedUser,
    adminRequest,
  }) => {
    const chains = await adminRequest.get("/api/hotel-chains");
    const chain = (await chains.json())[0];

    const uniqueName = `Geo API Test ${crypto.randomUUID()}`;
    const createRes = await isolatedUser.request.post("/api/bookings", {
      data: {
        hotelChainId: chain.id,
        propertyName: uniqueName,
        checkIn: "2025-09-10",
        checkOut: "2025-09-12",
        numNights: 2,
        pretaxCost: 300,
        taxAmount: 30,
        totalCost: 330,
        currency: "USD",
        countryCode: "GB",
        city: "London",
      },
    });
    expect(createRes.ok()).toBeTruthy();
    const created = await createRes.json();
    expect(created.property.countryCode).toBe("GB");
    expect(created.property.city).toBe("London");

    // Verify GET returns the geo data too
    const getRes = await isolatedUser.request.get(`/api/bookings/${created.id}`);
    expect(getRes.ok()).toBeTruthy();
    const fetched = await getRes.json();
    expect(fetched.property.countryCode).toBe("GB");
    expect(fetched.property.city).toBe("London");

    // Cleanup
    await isolatedUser.request.delete(`/api/bookings/${created.id}`);
  });

  test("booking geo data can be updated via PUT", async ({ isolatedUser, adminRequest }) => {
    const chains = await adminRequest.get("/api/hotel-chains");
    const chain = (await chains.json())[0];

    const uniqueName = `Geo Update Test ${crypto.randomUUID()}`;
    const createRes = await isolatedUser.request.post("/api/bookings", {
      data: {
        hotelChainId: chain.id,
        propertyName: uniqueName,
        checkIn: "2025-10-01",
        checkOut: "2025-10-03",
        numNights: 2,
        pretaxCost: 150,
        taxAmount: 15,
        totalCost: 165,
        currency: "USD",
      },
    });
    const created = await createRes.json();
    expect(created.property.countryCode).toBeNull();

    // Update with geo data
    const putRes = await isolatedUser.request.put(`/api/bookings/${created.id}`, {
      data: { countryCode: "MY", city: "Kuala Lumpur" },
    });
    expect(putRes.ok()).toBeTruthy();
    const updated = await putRes.json();
    expect(updated.property.countryCode).toBe("MY");
    expect(updated.property.city).toBe("Kuala Lumpur");

    // Cleanup
    await isolatedUser.request.delete(`/api/bookings/${created.id}`);
  });
});
