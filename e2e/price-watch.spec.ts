import crypto from "crypto";
import { test, expect } from "./fixtures";

/**
 * E2E tests for price watch API.
 * Tests the create, read, update, delete lifecycle via API calls.
 * UI interaction tests are not included as they require a live scraper.
 */

test.describe("Price Watch API", () => {
  test("can create a price watch for a booking and retrieve it", async ({ testBooking }) => {
    // Get the property id from the booking
    const bookingRes = await testBooking.request.get(`/api/bookings/${testBooking.id}`);
    expect(bookingRes.ok()).toBeTruthy();
    const booking = await bookingRes.json();
    const propertyId = booking.propertyId;

    // Create a price watch
    const createRes = await testBooking.request.post("/api/price-watches", {
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
    const listRes = await testBooking.request.get("/api/price-watches");
    expect(listRes.ok()).toBeTruthy();
    const list = await listRes.json();
    expect(list.some((w: { id: string }) => w.id === watch.id)).toBe(true);

    // GET /api/price-watches/[id]
    const getRes = await testBooking.request.get(`/api/price-watches/${watch.id}`);
    expect(getRes.ok()).toBeTruthy();
    const fetched = await getRes.json();
    expect(fetched.id).toBe(watch.id);

    // Booking now has priceWatchBooking
    const bookingRes2 = await testBooking.request.get(`/api/bookings/${testBooking.id}`);
    const updatedBooking = await bookingRes2.json();
    expect(updatedBooking.priceWatchBooking).not.toBeNull();
    expect(updatedBooking.priceWatchBooking.priceWatchId).toBe(watch.id);

    // Toggle disabled
    const putRes = await testBooking.request.put(`/api/price-watches/${watch.id}`, {
      data: { isEnabled: false },
    });
    expect(putRes.ok()).toBeTruthy();
    const updated = await putRes.json();
    expect(updated.isEnabled).toBe(false);

    // Delete
    const deleteRes = await testBooking.request.delete(`/api/price-watches/${watch.id}`);
    expect(deleteRes.ok()).toBeTruthy();

    // Confirm deleted
    const getAfterDelete = await testBooking.request.get(`/api/price-watches/${watch.id}`);
    expect(getAfterDelete.status()).toBe(404);
  });

  test("creating a watch twice for the same property upserts (does not duplicate)", async ({
    testBooking,
  }) => {
    const bookingRes = await testBooking.request.get(`/api/bookings/${testBooking.id}`);
    const booking = await bookingRes.json();
    const propertyId = booking.propertyId;

    const create1 = await testBooking.request.post("/api/price-watches", {
      data: { propertyId, isEnabled: true },
    });
    const watch1 = await create1.json();

    const create2 = await testBooking.request.post("/api/price-watches", {
      data: { propertyId, isEnabled: false },
    });
    const watch2 = await create2.json();

    // Same watch id (upserted)
    expect(watch1.id).toBe(watch2.id);
    expect(watch2.isEnabled).toBe(false);

    // Cleanup
    await testBooking.request.delete(`/api/price-watches/${watch1.id}`);
  });

  test("list response includes hotel chain name on property", async ({ testBooking }) => {
    const bookingRes = await testBooking.request.get(`/api/bookings/${testBooking.id}`);
    const booking = await bookingRes.json();

    const createRes = await testBooking.request.post("/api/price-watches", {
      data: { propertyId: booking.propertyId, isEnabled: true, bookingId: testBooking.id },
    });
    const watch = await createRes.json();

    const listRes = await testBooking.request.get("/api/price-watches");
    const list = await listRes.json();
    const found = list.find((w: { id: string }) => w.id === watch.id);

    expect(found.property.hotelChain).not.toBeNull();
    expect(typeof found.property.hotelChain.name).toBe("string");

    // Cleanup
    await testBooking.request.delete(`/api/price-watches/${watch.id}`);
  });

  test("snapshots endpoint returns empty array before any fetches", async ({ testBooking }) => {
    const bookingRes = await testBooking.request.get(`/api/bookings/${testBooking.id}`);
    const booking = await bookingRes.json();

    const createRes = await testBooking.request.post("/api/price-watches", {
      data: { propertyId: booking.propertyId, isEnabled: true },
    });
    const watch = await createRes.json();

    const snapshotsRes = await testBooking.request.get(`/api/price-watches/${watch.id}/snapshots`);
    expect(snapshotsRes.ok()).toBeTruthy();
    const snapshots = await snapshotsRes.json();
    expect(snapshots).toHaveLength(0);

    // Cleanup
    await testBooking.request.delete(`/api/price-watches/${watch.id}`);
  });
});

test.describe("Spirit code inline edit", () => {
  // Spirit code edits require admin (PUT /api/properties is admin-only).
  // These tests create a temporary admin booking and navigate as admin.
  test("can set a spirit code on a property from the price watch list page", async ({
    adminPage,
    adminRequest,
  }) => {
    // Create a temporary admin booking for this test
    const chains = await adminRequest.get("/api/hotel-chains");
    const chain = (await chains.json())[0];
    const bookingRes = await adminRequest.post("/api/bookings", {
      data: {
        hotelChainId: chain.id,
        propertyName: `Spirit Code Test ${crypto.randomUUID()}`,
        checkIn: `${new Date().getFullYear()}-09-01`,
        checkOut: `${new Date().getFullYear()}-09-03`,
        numNights: 2,
        pretaxCost: 200,
        taxAmount: 20,
        totalCost: 220,
        currency: "USD",
        bookingSource: "direct_web",
        countryCode: "US",
        city: "Chicago",
      },
    });
    const booking = await bookingRes.json();
    const propertyId = booking.propertyId;

    // Create a price watch via API
    const createRes = await adminRequest.post("/api/price-watches", {
      data: { propertyId, isEnabled: true, bookingId: booking.id },
    });
    const watch = await createRes.json();

    await adminPage.goto("/price-watch");

    // Scope to the desktop table row to avoid the hidden mobile card duplicate
    const row = adminPage.getByTestId(`price-watch-row-${watch.id}`);
    await row.getByTestId(`edit-spirit-code-${propertyId}`).click();

    // Type the spirit code and press Enter
    const input = row.getByTestId(`spirit-code-input-${propertyId}`);
    await input.fill("testcode");
    await input.press("Enter");

    // Input should disappear and code should be visible (auto-uppercased)
    await expect(input).not.toBeVisible();
    await expect(row.getByText("TESTCODE")).toBeVisible();

    // Cleanup
    await adminRequest.put(`/api/properties/${propertyId}`, {
      data: { chainPropertyId: null },
    });
    await adminRequest.delete(`/api/price-watches/${watch.id}`);
    await adminRequest.delete(`/api/bookings/${booking.id}`);
  });

  test("cancelling edit does not save the spirit code", async ({ adminPage, adminRequest }) => {
    // Create a temporary admin booking for this test
    const chains = await adminRequest.get("/api/hotel-chains");
    const chain = (await chains.json())[0];
    const bookingRes = await adminRequest.post("/api/bookings", {
      data: {
        hotelChainId: chain.id,
        propertyName: `Spirit Code Cancel Test ${crypto.randomUUID()}`,
        checkIn: `${new Date().getFullYear()}-09-05`,
        checkOut: `${new Date().getFullYear()}-09-07`,
        numNights: 2,
        pretaxCost: 200,
        taxAmount: 20,
        totalCost: 220,
        currency: "USD",
        bookingSource: "direct_web",
        countryCode: "US",
        city: "Chicago",
      },
    });
    const booking = await bookingRes.json();
    const propertyId = booking.propertyId;

    // Create a price watch via API
    const createRes = await adminRequest.post("/api/price-watches", {
      data: { propertyId, isEnabled: true, bookingId: booking.id },
    });
    const watch = await createRes.json();

    await adminPage.goto("/price-watch");

    // Scope to the desktop table row to avoid the hidden mobile card duplicate
    const row = adminPage.getByTestId(`price-watch-row-${watch.id}`);
    await row.getByTestId(`edit-spirit-code-${propertyId}`).click();

    // Type something, then cancel by pressing Escape
    const input = row.getByTestId(`spirit-code-input-${propertyId}`);
    await input.fill("shouldnotbesaved");
    await input.press("Escape");

    // Input should be gone
    await expect(input).not.toBeVisible();

    // The typed value should not appear on the page
    await expect(adminPage.getByText("shouldnotbesaved")).not.toBeVisible();

    // Cleanup
    await adminRequest.delete(`/api/price-watches/${watch.id}`);
    await adminRequest.delete(`/api/bookings/${booking.id}`);
  });
});

test.describe("Price watch on booking detail page", () => {
  test("price watch toggle is visible on booking detail page", async ({ testBooking }) => {
    await testBooking.page.goto(`/bookings/${testBooking.id}`);
    await expect(testBooking.page.getByTestId("price-watch-toggle")).toBeVisible();
  });

  test("enabling price watch via API shows threshold inputs on detail page", async ({
    testBooking,
  }) => {
    const bookingRes = await testBooking.request.get(`/api/bookings/${testBooking.id}`);
    const booking = await bookingRes.json();

    const createRes = await testBooking.request.post("/api/price-watches", {
      data: {
        propertyId: booking.propertyId,
        isEnabled: true,
        bookingId: testBooking.id,
        cashThreshold: 300,
        awardThreshold: 20000,
      },
    });
    const watch = await createRes.json();

    await testBooking.page.goto(`/bookings/${testBooking.id}`);

    await expect(testBooking.page.getByTestId("cash-threshold-input")).toBeVisible();
    await expect(testBooking.page.getByTestId("award-threshold-input")).toBeVisible();
    await expect(testBooking.page.getByText(/No price data yet/i)).toBeVisible();

    // Cleanup
    await testBooking.request.delete(`/api/price-watches/${watch.id}`);
  });
});

test.describe("Chain name display", () => {
  test("price watch page shows hotel chain name in property column", async ({
    adminPage,
    adminRequest,
  }) => {
    const chains = await adminRequest.get("/api/hotel-chains");
    const chain = (await chains.json())[0];

    const bookingRes = await adminRequest.post("/api/bookings", {
      data: {
        hotelChainId: chain.id,
        propertyName: `Chain Name Display Test ${crypto.randomUUID()}`,
        checkIn: `${new Date().getFullYear()}-10-01`,
        checkOut: `${new Date().getFullYear()}-10-03`,
        numNights: 2,
        pretaxCost: 200,
        taxAmount: 20,
        totalCost: 220,
        currency: "USD",
        bookingSource: "direct_web",
        countryCode: "US",
        city: "Chicago",
      },
    });
    const booking = await bookingRes.json();

    const createRes = await adminRequest.post("/api/price-watches", {
      data: { propertyId: booking.propertyId, isEnabled: true, bookingId: booking.id },
    });
    const watch = await createRes.json();

    await adminPage.goto("/price-watch");

    const row = adminPage.getByTestId(`price-watch-row-${watch.id}`);
    await expect(row.getByText(chain.name)).toBeVisible();

    // Cleanup
    await adminRequest.delete(`/api/price-watches/${watch.id}`);
    await adminRequest.delete(`/api/bookings/${booking.id}`);
  });
});

test.describe("Booking chain sync", () => {
  test("updating booking hotel chain updates the property chain visible on the price watch list", async ({
    isolatedUser,
    adminRequest,
  }) => {
    const chains = await adminRequest.get("/api/hotel-chains");
    const chainList = await chains.json();
    const chainA = chainList[0];
    const chainB = chainList[1];

    const bookingRes = await isolatedUser.request.post("/api/bookings", {
      data: {
        hotelChainId: chainA.id,
        propertyName: `Chain Sync Test ${crypto.randomUUID()}`,
        checkIn: `${new Date().getFullYear() + 1}-03-01`,
        checkOut: `${new Date().getFullYear() + 1}-03-03`,
        numNights: 2,
        pretaxCost: 0,
        taxAmount: 0,
        totalCost: 0,
        currency: "USD",
      },
    });
    const booking = await bookingRes.json();

    const watchRes = await isolatedUser.request.post("/api/price-watches", {
      data: { propertyId: booking.propertyId, isEnabled: true, bookingId: booking.id },
    });
    const watch = await watchRes.json();

    // Verify initial chain
    const listBefore = await (await isolatedUser.request.get("/api/price-watches")).json();
    const watchBefore = listBefore.find((w: { id: string }) => w.id === watch.id);
    expect(watchBefore.property.hotelChain.name).toBe(chainA.name);

    // Update booking to chain B — this should also update the property's chain
    await isolatedUser.request.put(`/api/bookings/${booking.id}`, {
      data: { hotelChainId: chainB.id, propertyId: booking.propertyId },
    });

    const listAfter = await (await isolatedUser.request.get("/api/price-watches")).json();
    const watchAfter = listAfter.find((w: { id: string }) => w.id === watch.id);
    expect(watchAfter.property.hotelChain.name).toBe(chainB.name);

    // Cleanup
    await isolatedUser.request.delete(`/api/price-watches/${watch.id}`);
    await isolatedUser.request.delete(`/api/bookings/${booking.id}`);
  });
});

test.describe("Price watch on booking pages", () => {
  test("price watch card is visible on the new booking page", async ({ isolatedUser }) => {
    await isolatedUser.page.goto("/bookings/new");
    // Check the unique description text inside the card (avoids matching the nav link)
    await expect(
      isolatedUser.page.getByText(
        "Get alerted when cash or award prices drop below your thresholds."
      )
    ).toBeVisible();
    await expect(isolatedUser.page.getByTestId("new-booking-price-watch-toggle")).toBeVisible();
  });

  test("price watch toggle on new booking page reveals threshold inputs", async ({
    isolatedUser,
  }) => {
    await isolatedUser.page.goto("/bookings/new");

    // Threshold inputs should not be visible initially
    await expect(isolatedUser.page.getByTestId("new-booking-cash-threshold")).not.toBeVisible();

    // Click the toggle
    await isolatedUser.page.getByTestId("new-booking-price-watch-toggle").click();

    // Inputs should now be visible
    await expect(isolatedUser.page.getByTestId("new-booking-cash-threshold")).toBeVisible();
    await expect(isolatedUser.page.getByTestId("new-booking-award-threshold")).toBeVisible();
  });

  test("price watch card is visible on the edit booking page", async ({ testBooking }) => {
    await testBooking.page.goto(`/bookings/${testBooking.id}/edit`);
    await expect(testBooking.page.getByTestId("price-watch-toggle")).toBeVisible();
  });
});
