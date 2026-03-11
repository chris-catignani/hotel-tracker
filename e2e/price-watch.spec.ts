import { test, expect } from "./fixtures";

/**
 * E2E tests for price watch API.
 * Tests the create, read, update, delete lifecycle via API calls.
 * UI interaction tests are not included as they require a live scraper.
 */

test.describe("Price Watch API", () => {
  test("can create a price watch for a booking and retrieve it", async ({
    request,
    testBooking,
  }) => {
    // Get the property id from the booking
    const bookingRes = await request.get(`/api/bookings/${testBooking.id}`);
    expect(bookingRes.ok()).toBeTruthy();
    const booking = await bookingRes.json();
    const propertyId = booking.propertyId;

    // Create a price watch
    const createRes = await request.post("/api/price-watches", {
      data: {
        propertyId,
        isEnabled: true,
        bookingId: testBooking.id,
        cashThreshold: 200,
        awardThreshold: 30000,
      },
    });
    expect(createRes.ok()).toBeTruthy();
    const watch = await createRes.json();
    expect(watch.isEnabled).toBe(true);
    expect(watch.property.id).toBe(propertyId);
    expect(watch.bookings).toHaveLength(1);
    expect(watch.bookings[0].bookingId).toBe(testBooking.id);
    expect(Number(watch.bookings[0].cashThreshold)).toBe(200);
    expect(watch.bookings[0].awardThreshold).toBe(30000);

    // GET /api/price-watches lists it
    const listRes = await request.get("/api/price-watches");
    expect(listRes.ok()).toBeTruthy();
    const list = await listRes.json();
    expect(list.some((w: { id: string }) => w.id === watch.id)).toBe(true);

    // GET /api/price-watches/[id]
    const getRes = await request.get(`/api/price-watches/${watch.id}`);
    expect(getRes.ok()).toBeTruthy();
    const fetched = await getRes.json();
    expect(fetched.id).toBe(watch.id);

    // Booking now has priceWatchBooking
    const bookingRes2 = await request.get(`/api/bookings/${testBooking.id}`);
    const updatedBooking = await bookingRes2.json();
    expect(updatedBooking.priceWatchBooking).not.toBeNull();
    expect(updatedBooking.priceWatchBooking.priceWatchId).toBe(watch.id);

    // Toggle disabled
    const putRes = await request.put(`/api/price-watches/${watch.id}`, {
      data: { isEnabled: false },
    });
    expect(putRes.ok()).toBeTruthy();
    const updated = await putRes.json();
    expect(updated.isEnabled).toBe(false);

    // Delete
    const deleteRes = await request.delete(`/api/price-watches/${watch.id}`);
    expect(deleteRes.ok()).toBeTruthy();

    // Confirm deleted
    const getAfterDelete = await request.get(`/api/price-watches/${watch.id}`);
    expect(getAfterDelete.status()).toBe(404);
  });

  test("creating a watch twice for the same property upserts (does not duplicate)", async ({
    request,
    testBooking,
  }) => {
    const bookingRes = await request.get(`/api/bookings/${testBooking.id}`);
    const booking = await bookingRes.json();
    const propertyId = booking.propertyId;

    const create1 = await request.post("/api/price-watches", {
      data: { propertyId, isEnabled: true },
    });
    const watch1 = await create1.json();

    const create2 = await request.post("/api/price-watches", {
      data: { propertyId, isEnabled: false },
    });
    const watch2 = await create2.json();

    // Same watch id (upserted)
    expect(watch1.id).toBe(watch2.id);
    expect(watch2.isEnabled).toBe(false);

    // Cleanup
    await request.delete(`/api/price-watches/${watch1.id}`);
  });

  test("snapshots endpoint returns empty array before any fetches", async ({
    request,
    testBooking,
  }) => {
    const bookingRes = await request.get(`/api/bookings/${testBooking.id}`);
    const booking = await bookingRes.json();

    const createRes = await request.post("/api/price-watches", {
      data: { propertyId: booking.propertyId, isEnabled: true },
    });
    const watch = await createRes.json();

    const snapshotsRes = await request.get(`/api/price-watches/${watch.id}/snapshots`);
    expect(snapshotsRes.ok()).toBeTruthy();
    const snapshots = await snapshotsRes.json();
    expect(snapshots).toHaveLength(0);

    // Cleanup
    await request.delete(`/api/price-watches/${watch.id}`);
  });
});
