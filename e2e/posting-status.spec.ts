import { test, expect } from "./fixtures";
import crypto from "crypto";
import { HOTEL_ID } from "../src/lib/constants";

const ACCOR_ID = HOTEL_ID.ACCOR;
const ACCOR_QANTAS_EARN_ID = "cpartnership0accorqantas1";

const YEAR = new Date().getFullYear();
// Use Hyatt — it has a pointType seeded, so loyaltyPointsEarned will auto-calculate
// and loyaltyPostingStatus will initialize to "pending".
const HYATT_ID = HOTEL_ID.HYATT;

test.describe("Posting Status", () => {
  test("shows needs-attention bookings by default", async ({ isolatedUser }) => {
    const propertyName = `Posting Test Hotel ${crypto.randomUUID()}`;
    const res = await isolatedUser.request.post("/api/bookings", {
      data: {
        hotelChainId: HYATT_ID,
        propertyName,
        checkIn: `${YEAR}-11-10`,
        checkOut: `${YEAR}-11-15`,
        numNights: 5,
        pretaxCost: 400,
        taxAmount: 80,
        totalCost: 480,
        currency: "USD",
        bookingSource: "direct_web",
        countryCode: "US",
        city: "New York",
      },
    });
    expect(res.ok()).toBeTruthy();
    const booking = await res.json();

    try {
      await isolatedUser.page.goto("/posting-status");

      await expect(
        isolatedUser.page.getByRole("heading", { name: "Posting Status" })
      ).toBeVisible();
      await expect(isolatedUser.page.getByText(propertyName)).toBeVisible();

      // "Needs Attention" filter button should be active (has primary background)
      const needsAttentionLink = isolatedUser.page.getByRole("link", {
        name: "Needs Attention",
      });
      await expect(needsAttentionLink).toHaveClass(/bg-primary/);
    } finally {
      await isolatedUser.request.delete(`/api/bookings/${booking.id}`);
    }
  });

  test("All Bookings toggle shows all bookings", async ({ isolatedUser }) => {
    // Create a past apartment booking — apartment bookings have no posting statuses
    // (no loyalty, no card reward, no portal, no promotions), so it won't appear
    // in needs-attention. This avoids cross-test interference from globally-matched promotions.
    const pastYear = YEAR - 1;
    const propertyName = `Past Posting Apt ${crypto.randomUUID()}`;
    const res = await isolatedUser.request.post("/api/bookings", {
      data: {
        accommodationType: "apartment",
        hotelChainId: null,
        propertyName,
        checkIn: `${pastYear}-03-10`,
        checkOut: `${pastYear}-03-15`,
        numNights: 5,
        pretaxCost: 400,
        taxAmount: 80,
        totalCost: 480,
        currency: "USD",
        bookingSource: "direct_web",
        countryCode: "US",
        city: "Chicago",
      },
    });
    expect(res.ok()).toBeTruthy();
    const booking = await res.json();

    try {
      // Default view = needs-attention: past apartment booking should be hidden
      await isolatedUser.page.goto("/posting-status");
      await expect(
        isolatedUser.page.getByRole("heading", { name: "Posting Status" })
      ).toBeVisible();
      await expect(isolatedUser.page.getByText(propertyName)).toHaveCount(0);

      // Click "All Bookings" to see everything
      await isolatedUser.page.getByRole("link", { name: "All Bookings" }).click();
      await expect(isolatedUser.page.getByText(propertyName)).toBeVisible();
    } finally {
      await isolatedUser.request.delete(`/api/bookings/${booking.id}`);
    }
  });

  test("clicking a single-item loyalty cell cycles its status", async ({ isolatedUser }) => {
    const propertyName = `Loyalty Cycle Hotel ${crypto.randomUUID()}`;
    const res = await isolatedUser.request.post("/api/bookings", {
      data: {
        hotelChainId: HYATT_ID,
        propertyName,
        checkIn: `${YEAR}-12-10`,
        checkOut: `${YEAR}-12-15`,
        numNights: 5,
        pretaxCost: 400,
        taxAmount: 80,
        totalCost: 480,
        currency: "USD",
        bookingSource: "direct_web",
        countryCode: "US",
        city: "New York",
      },
    });
    expect(res.ok()).toBeTruthy();
    const booking = await res.json();

    try {
      await isolatedUser.page.goto("/posting-status");

      const loyaltyCell = isolatedUser.page.getByTestId(`loyalty-cell-${booking.id}`);

      // Initial state: Pending
      await expect(loyaltyCell).toContainText("Pending");

      // Click -> Posted
      await loyaltyCell.click();
      await expect(loyaltyCell).toContainText("Posted");

      // Click -> Failed
      await loyaltyCell.click();
      await expect(loyaltyCell).toContainText("Failed");

      // Click -> Pending
      await loyaltyCell.click();
      await expect(loyaltyCell).toContainText("Pending");

      // Reload and verify persistence
      await isolatedUser.page.reload();
      const loyaltyCellAfterReload = isolatedUser.page.getByTestId(`loyalty-cell-${booking.id}`);
      await expect(loyaltyCellAfterReload).toContainText("Pending");
    } finally {
      await isolatedUser.request.delete(`/api/bookings/${booking.id}`);
    }
  });

  test("partnership earn cell shows point count not dollar amount", async ({ isolatedUser }) => {
    // Enable Accor–Qantas earn for this user
    const enableRes = await isolatedUser.request.post("/api/user-partnership-earns", {
      data: { partnershipEarnId: ACCOR_QANTAS_EARN_ID, isEnabled: true },
    });
    expect(enableRes.ok()).toBeTruthy();

    // Past USD booking at Accor APAC (AU) — lockedExchangeRate will be 1 (USD)
    // pretaxCostUSD=400, pretaxAUD≈640 (rate ~0.625), pointsEarned≈1920 — far above earnedValue (~$23)
    const pastYear = YEAR - 1;
    const propertyName = `Accor Partnership Test ${crypto.randomUUID()}`;
    const bookingRes = await isolatedUser.request.post("/api/bookings", {
      data: {
        hotelChainId: ACCOR_ID,
        propertyName,
        checkIn: `${pastYear}-06-10`,
        checkOut: `${pastYear}-06-15`,
        numNights: 5,
        pretaxCost: 400,
        taxAmount: 40,
        totalCost: 440,
        currency: "USD",
        bookingSource: "direct_web",
        countryCode: "AU",
        city: "Sydney",
      },
    });
    expect(bookingRes.ok()).toBeTruthy();
    const booking = await bookingRes.json();

    try {
      await isolatedUser.page.goto("/posting-status?filter=all");
      await expect(
        isolatedUser.page.getByRole("heading", { name: "Posting Status" })
      ).toBeVisible();

      const partnerCell = isolatedUser.page.getByTestId(`partners-cell-${booking.id}`);
      await expect(partnerCell).toBeVisible();

      // The cell should show a point count (hundreds+), not a dollar amount (single/double digits).
      // Correct: "1,920 QP pts · Pending" — buggy: "23 pts · Pending"
      const cellText = await partnerCell.textContent();
      const match = cellText?.match(/^([\d,]+)/);
      expect(match).not.toBeNull();
      const pointCount = parseInt(match![1].replace(/,/g, ""), 10);
      expect(pointCount).toBeGreaterThan(100);
    } finally {
      await isolatedUser.request.delete(`/api/bookings/${booking.id}`);
      // Disable the earn so it doesn't affect other tests for this user
      await isolatedUser.request.post("/api/user-partnership-earns", {
        data: { partnershipEarnId: ACCOR_QANTAS_EARN_ID, isEnabled: false },
      });
    }
  });

  test("multi-item promotions cell expands and collapses", async ({ isolatedUser }) => {
    // Create 2 promotions that will match the booking
    const promo1Name = `Promo A ${crypto.randomUUID()}`;
    const promo1Res = await isolatedUser.request.post("/api/promotions", {
      data: {
        name: promo1Name,
        type: "loyalty",
        hotelChainId: HYATT_ID,
        benefits: [
          {
            rewardType: "cashback",
            valueType: "fixed",
            value: 25,
            certType: null,
            sortOrder: 0,
          },
        ],
      },
    });
    expect(promo1Res.ok()).toBeTruthy();
    const promo1 = await promo1Res.json();

    const promo2Name = `Promo B ${crypto.randomUUID()}`;
    const promo2Res = await isolatedUser.request.post("/api/promotions", {
      data: {
        name: promo2Name,
        type: "loyalty",
        hotelChainId: HYATT_ID,
        benefits: [
          {
            rewardType: "cashback",
            valueType: "fixed",
            value: 50,
            certType: null,
            sortOrder: 0,
          },
        ],
      },
    });
    expect(promo2Res.ok()).toBeTruthy();
    const promo2 = await promo2Res.json();

    // Create booking (promotions auto-attach)
    const propertyName = `Multi Promo Hotel ${crypto.randomUUID()}`;
    const bookingRes = await isolatedUser.request.post("/api/bookings", {
      data: {
        hotelChainId: HYATT_ID,
        propertyName,
        checkIn: `${YEAR}-12-20`,
        checkOut: `${YEAR}-12-25`,
        numNights: 5,
        pretaxCost: 400,
        taxAmount: 80,
        totalCost: 480,
        currency: "USD",
        bookingSource: "direct_web",
        countryCode: "US",
        city: "New York",
      },
    });
    expect(bookingRes.ok()).toBeTruthy();
    const booking = await bookingRes.json();

    try {
      await isolatedUser.page.goto("/posting-status");

      const promoCell = isolatedUser.page.getByTestId(`promotions-cell-${booking.id}`);
      await expect(promoCell).toBeVisible();

      // Click to expand
      await promoCell.click();
      const expandRow = isolatedUser.page.getByTestId(`promotions-expand-${booking.id}`);
      await expect(expandRow).toBeVisible();

      // Click again to collapse
      await promoCell.click();
      await expect(expandRow).not.toBeVisible();
    } finally {
      await isolatedUser.request.delete(`/api/bookings/${booking.id}`);
      await isolatedUser.request.delete(`/api/promotions/${promo1.id}`);
      await isolatedUser.request.delete(`/api/promotions/${promo2.id}`);
    }
  });
});
