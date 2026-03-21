import crypto from "crypto";
import { test, expect } from "./fixtures";

const YEAR = new Date().getFullYear();

/**
 * E2E tests for multi-currency support.
 *
 * Past non-USD bookings: exchange rate is fetched from the external API at creation time
 * and stored on the booking. The detail page shows native cost + "≈ $X.XX" with no "(est.)".
 *
 * Future non-USD bookings: exchange rate is null at creation. The detail page resolves the
 * current cached rate from the DB (if available) and shows "≈ $X.XX (est.)".
 *
 * USD bookings: no conversion display shown.
 */
test.describe("Multi-Currency Support", () => {
  test("USD booking shows no currency conversion on detail page", async ({ page, request }) => {
    const chains = await request.get("/api/hotel-chains");
    const chain = (await chains.json())[0];

    const propertyName = `USD Booking ${crypto.randomUUID()}`;
    const bookingRes = await request.post("/api/bookings", {
      data: {
        hotelChainId: chain.id,
        propertyName,
        checkIn: "2024-06-01",
        checkOut: "2024-06-03",
        numNights: 2,
        pretaxCost: 200,
        taxAmount: 20,
        totalCost: 220,
        currency: "USD",
        bookingSource: "direct_web",
      },
    });
    expect(bookingRes.ok()).toBeTruthy();
    const booking = await bookingRes.json();

    try {
      await page.goto(`/bookings/${booking.id}`);

      // USD bookings should NOT show a native cost or USD equivalent element
      await expect(page.getByTestId("total-cost-native")).not.toBeAttached();
      await expect(page.getByTestId("total-cost-usd-equivalent")).not.toBeAttached();

      // Should still show the total cost in the USD cost element
      await expect(page.getByTestId("total-cost-usd")).toHaveText("$220.00");
    } finally {
      await request.delete(`/api/bookings/${booking.id}`);
    }
  });

  test("past non-USD booking shows native cost and locked USD equivalent (no est.)", async ({
    page,
    request,
  }) => {
    const chains = await request.get("/api/hotel-chains");
    const chain = (await chains.json())[0];

    const propertyName = `EUR Past Booking ${crypto.randomUUID()}`;
    // Use a recent past date with EUR — the external exchange API has data from March 2024+
    const bookingRes = await request.post("/api/bookings", {
      data: {
        hotelChainId: chain.id,
        propertyName,
        checkIn: "2024-06-01",
        checkOut: "2024-06-03",
        numNights: 2,
        pretaxCost: 200,
        taxAmount: 20,
        totalCost: 220,
        currency: "EUR",
        bookingSource: "direct_web",
      },
    });
    expect(bookingRes.ok()).toBeTruthy();
    const booking = await bookingRes.json();

    try {
      await page.goto(`/bookings/${booking.id}`);

      // Native cost should be shown in EUR format
      const nativeCost = page.getByTestId("total-cost-native");
      await expect(nativeCost).toBeVisible();
      await expect(nativeCost).toContainText("€");

      // USD equivalent should be shown without "(est.)"
      const usdEquivalent = page.getByTestId("total-cost-usd-equivalent");
      await expect(usdEquivalent).toBeVisible();
      await expect(usdEquivalent).toContainText("$");
      await expect(usdEquivalent).not.toContainText("est.");
    } finally {
      await request.delete(`/api/bookings/${booking.id}`);
    }
  });

  test("future non-USD booking shows estimated USD equivalent when cached rate exists", async ({
    page,
    request,
  }) => {
    const chains = await request.get("/api/hotel-chains");
    const chain = (await chains.json())[0];

    // Populate the ExchangeRate cache for EUR via the cron endpoint
    const cronRes = await request.get("/api/cron/refresh-exchange-rates", {
      headers: { Authorization: `Bearer ${process.env.CRON_SECRET || "test-cron-secret"}` },
    });
    expect(cronRes.ok()).toBeTruthy();

    const futureCheckIn = new Date();
    futureCheckIn.setDate(futureCheckIn.getDate() + 30);
    const futureCheckOut = new Date(futureCheckIn);
    futureCheckOut.setDate(futureCheckOut.getDate() + 2);
    const checkIn = futureCheckIn.toISOString().split("T")[0];
    const checkOut = futureCheckOut.toISOString().split("T")[0];

    const propertyName = `EUR Future Booking ${crypto.randomUUID()}`;
    const bookingRes = await request.post("/api/bookings", {
      data: {
        hotelChainId: chain.id,
        propertyName,
        checkIn,
        checkOut,
        numNights: 2,
        pretaxCost: 200,
        taxAmount: 20,
        totalCost: 220,
        currency: "EUR",
        bookingSource: "direct_web",
      },
    });
    expect(bookingRes.ok()).toBeTruthy();
    const booking = await bookingRes.json();

    try {
      await page.goto(`/bookings/${booking.id}`);

      // Native cost should be shown in EUR format
      const nativeCost = page.getByTestId("total-cost-native");
      await expect(nativeCost).toBeVisible();
      await expect(nativeCost).toContainText("€");

      // USD equivalent should be shown with "(est.)" label
      const usdEquivalent = page.getByTestId("total-cost-usd-equivalent");
      await expect(usdEquivalent).toBeVisible();
      await expect(usdEquivalent).toContainText("$");
      await expect(usdEquivalent).toContainText("est.");

      // Loyalty points should show "(est.)" if the hotel chain earns points
      const loyaltyPoints = page.getByTestId("loyalty-points-earned");
      if (await loyaltyPoints.isVisible()) {
        await expect(loyaltyPoints).toContainText("est.");
      }
    } finally {
      await request.delete(`/api/bookings/${booking.id}`);
    }
  });

  test("clicking non-USD price in bookings list shows native currency popover", async ({
    page,
    request,
  }) => {
    const chains = await request.get("/api/hotel-chains");
    const chain = (await chains.json())[0];

    const propertyName = `EUR Popover Test ${crypto.randomUUID()}`;
    const bookingRes = await request.post("/api/bookings", {
      data: {
        hotelChainId: chain.id,
        propertyName,
        checkIn: `${YEAR}-01-15`,
        checkOut: `${YEAR}-01-17`,
        numNights: 2,
        pretaxCost: 180,
        taxAmount: 20,
        totalCost: 200,
        currency: "EUR",
        bookingSource: "direct_web",
      },
    });
    expect(bookingRes.ok()).toBeTruthy();
    const booking = await bookingRes.json();

    try {
      await page.goto("/bookings");

      const row = page.getByTestId(`booking-row-${booking.id}`);
      await expect(row).toBeVisible();

      // The cost cell should show a clickable trigger (dotted underline)
      const trigger = row.getByTestId("cost-popover-trigger");
      await expect(trigger).toBeVisible();

      // Click to open popover
      await trigger.click();

      // Popover should show the native EUR amount
      const popover = page.getByTestId("cost-popover-content");
      await expect(popover).toBeVisible();
      await expect(popover).toContainText("€");
      await expect(popover).toContainText("200");
      await expect(popover).toContainText("Locked at check-in rate");
    } finally {
      await request.delete(`/api/bookings/${booking.id}`);
    }
  });
});
