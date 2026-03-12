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

test.describe("Spirit code inline edit", () => {
  test("can set a spirit code on a property from the price watch list page", async ({
    page,
    request,
    testBooking,
  }) => {
    // Get propertyId from the booking
    const bookingRes = await request.get(`/api/bookings/${testBooking.id}`);
    const booking = await bookingRes.json();
    const propertyId = booking.propertyId;

    // Create a price watch via API
    const createRes = await request.post("/api/price-watches", {
      data: { propertyId, isEnabled: true, bookingId: testBooking.id },
    });
    const watch = await createRes.json();

    await page.goto("/price-watch");

    // Scope to the desktop table row to avoid the hidden mobile card duplicate
    const row = page.getByTestId(`price-watch-row-${watch.id}`);
    await row.getByTestId(`edit-spirit-code-${propertyId}`).click();

    // Type the spirit code and press Enter
    const input = row.getByTestId(`spirit-code-input-${propertyId}`);
    await input.fill("testcode");
    await input.press("Enter");

    // Input should disappear and code should be visible
    await expect(input).not.toBeVisible();
    await expect(row.getByText("testcode")).toBeVisible();

    // Cleanup
    await request.put(`/api/properties/${propertyId}`, {
      data: { chainPropertyId: null },
    });
    await request.delete(`/api/price-watches/${watch.id}`);
  });

  test("cancelling edit does not save the spirit code", async ({ page, request, testBooking }) => {
    // Get propertyId from the booking
    const bookingRes = await request.get(`/api/bookings/${testBooking.id}`);
    const booking = await bookingRes.json();
    const propertyId = booking.propertyId;

    // Create a price watch via API
    const createRes = await request.post("/api/price-watches", {
      data: { propertyId, isEnabled: true, bookingId: testBooking.id },
    });
    const watch = await createRes.json();

    await page.goto("/price-watch");

    // Scope to the desktop table row to avoid the hidden mobile card duplicate
    const row = page.getByTestId(`price-watch-row-${watch.id}`);
    await row.getByTestId(`edit-spirit-code-${propertyId}`).click();

    // Type something, then cancel by pressing Escape
    const input = row.getByTestId(`spirit-code-input-${propertyId}`);
    await input.fill("shouldnotbesaved");
    await input.press("Escape");

    // Input should be gone
    await expect(input).not.toBeVisible();

    // The typed value should not appear on the page
    await expect(page.getByText("shouldnotbesaved")).not.toBeVisible();

    // Cleanup
    await request.delete(`/api/price-watches/${watch.id}`);
  });
});

test.describe("Price watch on booking pages", () => {
  test("price watch card is visible on the new booking page", async ({ page }) => {
    await page.goto("/bookings/new");
    // Check the unique description text inside the card (avoids matching the nav link)
    await expect(
      page.getByText("Get alerted when cash or award prices drop below your thresholds.")
    ).toBeVisible();
    await expect(page.getByTestId("new-booking-price-watch-toggle")).toBeVisible();
  });

  test("price watch toggle on new booking page reveals threshold inputs", async ({ page }) => {
    await page.goto("/bookings/new");

    // Threshold inputs should not be visible initially
    await expect(page.getByTestId("new-booking-cash-threshold")).not.toBeVisible();

    // Click the toggle
    await page.getByTestId("new-booking-price-watch-toggle").click();

    // Inputs should now be visible
    await expect(page.getByTestId("new-booking-cash-threshold")).toBeVisible();
    await expect(page.getByTestId("new-booking-award-threshold")).toBeVisible();
  });

  test("price watch card is visible on the edit booking page", async ({ page, testBooking }) => {
    await page.goto(`/bookings/${testBooking.id}/edit`);
    await expect(page.getByTestId("price-watch-toggle")).toBeVisible();
  });
});
