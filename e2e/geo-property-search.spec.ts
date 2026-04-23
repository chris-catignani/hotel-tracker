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

test.describe("Local Property Search — combobox behavior", () => {
  test("typing a hotel name returns local results and selecting one confirms the property", async ({
    isolatedUser,
    adminRequest,
  }) => {
    const chains = await adminRequest.get("/api/hotel-chains");
    const chain = (await chains.json())[0];
    const uniqueName = `Local Search Hotel ${crypto.randomUUID().slice(0, 8)}`;

    const seedRes = await isolatedUser.request.post("/api/bookings", {
      data: {
        hotelChainId: chain.id,
        propertyName: uniqueName,
        checkIn: "2025-08-01",
        checkOut: "2025-08-03",
        numNights: 2,
        pretaxCost: 100,
        taxAmount: 10,
        totalCost: 110,
        currency: "USD",
      },
    });
    const seedBooking = await seedRes.json();

    try {
      await isolatedUser.page.goto("/bookings/new");
      await expect(isolatedUser.page.getByTestId("hotel-chain-select")).toBeVisible();
      await expect(isolatedUser.page.getByTestId("property-name-input")).toBeVisible();

      await isolatedUser.page.getByTestId("hotel-chain-select").click();
      await isolatedUser.page.getByRole("option", { name: chain.name }).click();

      const combobox = isolatedUser.page.getByTestId("property-name-input");
      await combobox.fill(uniqueName.slice(0, 12));

      await expect(isolatedUser.page.getByTestId("geo-suggestion-0")).toBeVisible();
      await expect(isolatedUser.page.getByTestId("geo-suggestion-0")).toContainText(
        uniqueName.slice(0, 12)
      );
      await expect(isolatedUser.page.getByTestId("geo-search-more")).toBeVisible();

      await isolatedUser.page.getByTestId("geo-suggestion-0").click();
      await expect(isolatedUser.page.getByTestId("property-name-input-confirmed")).toBeVisible();
    } finally {
      await isolatedUser.request.delete(`/api/bookings/${seedBooking.id}`);
    }
  });

  test("clicking 'Search more...' replaces local results with Places results and shows cant-find button", async ({
    isolatedUser,
    adminRequest,
  }) => {
    const chains = await adminRequest.get("/api/hotel-chains");
    const chain = (await chains.json())[0];

    await isolatedUser.page.route(
      (url) => url.pathname === "/api/geo/search",
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([
            {
              source: "places",
              placeId: "mocked-place-1",
              displayName: "Marriott Times Square",
              city: "New York",
              countryCode: "US",
              address: "1535 Broadway",
              latitude: 40.758,
              longitude: -73.985,
            },
          ]),
        });
      }
    );

    await isolatedUser.page.goto("/bookings/new");
    await expect(isolatedUser.page.getByTestId("hotel-chain-select")).toBeVisible();
    await expect(isolatedUser.page.getByTestId("property-name-input")).toBeVisible();

    await isolatedUser.page.getByTestId("hotel-chain-select").click();
    await isolatedUser.page.getByRole("option", { name: chain.name }).click();

    const combobox = isolatedUser.page.getByTestId("property-name-input");
    await combobox.fill("Marriott Times Square");

    await expect(isolatedUser.page.getByTestId("geo-search-more")).toBeVisible();

    await isolatedUser.page.getByTestId("geo-search-more").click();

    await expect(isolatedUser.page.getByTestId("geo-cant-find")).toBeVisible();
    await expect(isolatedUser.page.getByTestId("geo-search-more")).not.toBeVisible();
  });

  test("selecting a local result with no chain pre-selected auto-fills the chain dropdown", async ({
    isolatedUser,
    adminRequest,
  }) => {
    const chains = await adminRequest.get("/api/hotel-chains");
    const chain = (await chains.json())[0];
    const uniqueName = `AutoChain Hotel ${crypto.randomUUID().slice(0, 8)}`;

    const seedRes = await isolatedUser.request.post("/api/bookings", {
      data: {
        hotelChainId: chain.id,
        propertyName: uniqueName,
        checkIn: "2025-09-01",
        checkOut: "2025-09-03",
        numNights: 2,
        pretaxCost: 100,
        taxAmount: 10,
        totalCost: 110,
        currency: "USD",
      },
    });
    const seedBooking = await seedRes.json();

    try {
      await isolatedUser.page.goto("/bookings/new");
      await expect(isolatedUser.page.getByTestId("hotel-chain-select")).toBeVisible();
      await expect(isolatedUser.page.getByTestId("property-name-input")).toBeVisible();

      const combobox = isolatedUser.page.getByTestId("property-name-input");
      await combobox.fill(uniqueName.slice(0, 12));

      await expect(isolatedUser.page.getByTestId("geo-suggestion-0")).toBeVisible();
      await isolatedUser.page.getByTestId("geo-suggestion-0").click();

      const chainCombobox = isolatedUser.page.getByTestId("hotel-chain-select");
      await expect(chainCombobox).toContainText(chain.name);
    } finally {
      await isolatedUser.request.delete(`/api/bookings/${seedBooking.id}`);
    }
  });

  test("apartment search skips local and shows Places results directly", async ({
    isolatedUser,
  }) => {
    await isolatedUser.page.route(
      (url) => url.pathname === "/api/geo/search",
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([
            {
              source: "places",
              placeId: "mocked-place-2",
              displayName: "123 Main Street, Chicago",
              city: "Chicago",
              countryCode: "US",
              address: "123 Main Street",
              latitude: 41.878,
              longitude: -87.629,
            },
          ]),
        });
      }
    );

    await isolatedUser.page.goto("/bookings/new");
    await expect(isolatedUser.page.getByTestId("property-name-input")).toBeVisible();
    await expect(isolatedUser.page.getByTestId("accommodation-type-select")).toBeVisible();

    await isolatedUser.page.getByTestId("accommodation-type-select").click();
    await isolatedUser.page.getByRole("option", { name: /apartment/i }).click();

    const combobox = isolatedUser.page.getByTestId("property-name-input");
    await combobox.fill("123 Main Street");

    await expect(isolatedUser.page.getByTestId("geo-search-more")).not.toBeVisible();
    await expect(isolatedUser.page.getByTestId("geo-cant-find")).toBeVisible({ timeout: 5000 });
  });
});
