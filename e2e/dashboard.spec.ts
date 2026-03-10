import crypto from "crypto";
import { test, expect } from "./fixtures";

/**
 * E2E tests for the dashboard page.
 *
 * Key behaviors tested:
 * - Savings breakdown line items use getNetCostBreakdown (consistent with total savings)
 * - Avg/Night stat card breaks down by payment type (cash, points, certs)
 * - All booking types (cash, points, certs) contribute to savings stats
 */

test.describe("Dashboard", () => {
  test("savings breakdown portal cashback reflects booking portal rate", async ({
    page,
    request,
  }) => {
    const chains = await request.get("/api/hotel-chains");
    const chain = (await chains.json())[0];

    const portals = await request.get("/api/portals");
    const portal = (await portals.json())[0];

    // Create a cash booking with a known portal cashback rate
    const propertyName = `Dashboard Portal Test ${crypto.randomUUID()}`;
    const bookingRes = await request.post("/api/bookings", {
      data: {
        hotelChainId: chain.id,
        propertyName,
        checkIn: "2025-03-01",
        checkOut: "2025-03-04",
        numNights: 3,
        pretaxCost: 300,
        taxAmount: 30,
        totalCost: 330,
        currency: "USD",
        bookingSource: "direct_web",
        shoppingPortalId: portal.id,
        portalCashbackRate: 0.05,
        portalCashbackOnTotal: false,
      },
    });
    expect(bookingRes.ok()).toBeTruthy();
    const booking = await bookingRes.json();

    try {
      await page.goto("/");

      // Portal cashback line item should be visible and show a positive dollar amount
      const portalEl = page.getByTestId("savings-breakdown-portal");
      await expect(portalEl).toBeVisible();
      const portalText = await portalEl.textContent();
      expect(portalText).toMatch(/^\$\d/);
      expect(portalText).not.toBe("$0");

      // Total savings should also be visible
      await expect(page.getByTestId("savings-breakdown-total")).toBeVisible();
    } finally {
      await request.delete(`/api/bookings/${booking.id}`);
    }
  });

  test("avg/night cash column shows dollar value for cash booking", async ({ page, request }) => {
    const chains = await request.get("/api/hotel-chains");
    const chain = (await chains.json())[0];

    const propertyName = `Dashboard Cash Avg Test ${crypto.randomUUID()}`;
    const bookingRes = await request.post("/api/bookings", {
      data: {
        hotelChainId: chain.id,
        propertyName,
        checkIn: "2025-03-01",
        checkOut: "2025-03-04",
        numNights: 3,
        pretaxCost: 300,
        taxAmount: 30,
        totalCost: 330,
        currency: "USD",
        bookingSource: "direct_web",
      },
    });
    expect(bookingRes.ok()).toBeTruthy();
    const booking = await bookingRes.json();

    try {
      await page.goto("/");

      // Cash avg/night should show a dollar value (not "—")
      const cashAvg = page.getByTestId("stat-value-avg-cash-net-per-night");
      await expect(cashAvg).toBeVisible();
      const text = await cashAvg.textContent();
      expect(text).toMatch(/^\$/);
      expect(text).not.toBe("—");
    } finally {
      await request.delete(`/api/bookings/${booking.id}`);
    }
  });

  test("avg/night points column shows pts value for points booking", async ({ page, request }) => {
    const chains = await request.get("/api/hotel-chains");
    const chain = (await chains.json())[0];

    const propertyName = `Dashboard Points Avg Test ${crypto.randomUUID()}`;
    const bookingRes = await request.post("/api/bookings", {
      data: {
        hotelChainId: chain.id,
        propertyName,
        checkIn: "2025-03-01",
        checkOut: "2025-03-04",
        numNights: 3,
        pretaxCost: 0,
        taxAmount: 0,
        totalCost: 0,
        currency: "USD",
        bookingSource: "direct_web",
        pointsRedeemed: 60000,
      },
    });
    expect(bookingRes.ok()).toBeTruthy();
    const booking = await bookingRes.json();

    try {
      await page.goto("/");

      // Points avg/night should show a "pts" value (not "—")
      const pointsAvg = page.getByTestId("stat-value-avg-points-per-night");
      await expect(pointsAvg).toBeVisible();
      const text = await pointsAvg.textContent();
      expect(text).toContain("pts");
      expect(text).not.toBe("—");
    } finally {
      await request.delete(`/api/bookings/${booking.id}`);
    }
  });

  test("avg/night certs column shows pts value for cert booking", async ({ page, request }) => {
    // Use Marriott chain so marriott_35k certs are valid
    const chains = await request.get("/api/hotel-chains");
    const marriott = (await chains.json()).find(
      (c: { name: string }) => c.name === "Marriott Bonvoy"
    );
    // Fall back to first chain if Marriott not seeded
    const chain = marriott ?? (await (await request.get("/api/hotel-chains")).json())[0];

    const propertyName = `Dashboard Certs Avg Test ${crypto.randomUUID()}`;
    const bookingRes = await request.post("/api/bookings", {
      data: {
        hotelChainId: chain.id,
        propertyName,
        checkIn: "2025-03-01",
        checkOut: "2025-03-04",
        numNights: 3,
        pretaxCost: 0,
        taxAmount: 0,
        totalCost: 0,
        currency: "USD",
        bookingSource: "direct_web",
        certificates: [
          { certType: "marriott_35k" },
          { certType: "marriott_35k" },
          { certType: "marriott_35k" },
        ],
      },
    });
    expect(bookingRes.ok()).toBeTruthy();
    const booking = await bookingRes.json();

    try {
      await page.goto("/");

      // Certs avg/night should show a "pts" value (not "—")
      const certsAvg = page.getByTestId("stat-value-avg-certs-per-night");
      await expect(certsAvg).toBeVisible();
      const text = await certsAvg.textContent();
      expect(text).toContain("pts");
      expect(text).not.toBe("—");
    } finally {
      await request.delete(`/api/bookings/${booking.id}`);
    }
  });
});
