import { test, expect } from "./fixtures";
import crypto from "crypto";
import { HOTEL_ID } from "../src/lib/constants";
import { CREDIT_CARD_ID, SHOPPING_PORTAL_ID } from "../prisma/seed-ids";

const ACCOR_ID = HOTEL_ID.ACCOR;
const ACCOR_QANTAS_EARN_ID = "cpartnership0accorqantas1";

const YEAR = new Date().getFullYear();
const PAST_YEAR = YEAR - 1;
// Use Hyatt — it has a pointType seeded, so loyaltyPointsEarned will auto-calculate
// and loyaltyPostingStatus will initialize to "pending".
const HYATT_ID = HOTEL_ID.HYATT;

test.describe("Earnings Tracker", () => {
  test("shows needs-attention bookings by default", async ({ isolatedUser }) => {
    const propertyName = `Earnings Tracker Test Hotel ${crypto.randomUUID()}`;
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
      await isolatedUser.page.goto("/earnings-tracker");

      await expect(
        isolatedUser.page.getByRole("heading", { name: "Earnings Tracker" })
      ).toBeVisible();
      await expect(isolatedUser.page.getByText(propertyName)).toBeVisible();

      // "Needs Attention" filter button should be active
      const needsAttentionBtn = isolatedUser.page.getByTestId("earnings-filter-needs-attention");
      await expect(needsAttentionBtn).toHaveClass(/bg-background/);
    } finally {
      await isolatedUser.request.delete(`/api/bookings/${booking.id}`);
    }
  });

  test("All Bookings toggle shows all bookings", async ({ isolatedUser }) => {
    // Create a past apartment booking — apartment bookings have no earnings tracker statuses
    // (no loyalty, no card reward, no portal, no promotions), so it won't appear
    // in needs-attention. This avoids cross-test interference from globally-matched promotions.
    const propertyName = `Past Earnings Tracker Apt ${crypto.randomUUID()}`;
    const res = await isolatedUser.request.post("/api/bookings", {
      data: {
        accommodationType: "apartment",
        hotelChainId: null,
        propertyName,
        checkIn: `${PAST_YEAR}-03-10`,
        checkOut: `${PAST_YEAR}-03-15`,
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
      await isolatedUser.page.goto("/earnings-tracker");
      await expect(
        isolatedUser.page.getByRole("heading", { name: "Earnings Tracker" })
      ).toBeVisible();
      await expect(isolatedUser.page.getByText(propertyName)).toHaveCount(0);

      // Click "All Bookings" to see everything
      await isolatedUser.page.getByTestId("earnings-filter-all").click();
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
      await isolatedUser.page.goto("/earnings-tracker");

      const loyaltyCell = isolatedUser.page.getByTestId(`loyalty-cell-${booking.id}`);

      // Initial state: Pending
      await expect(loyaltyCell).toContainText("⏳");

      // Click -> Posted
      await loyaltyCell.click();
      await expect(loyaltyCell).toContainText("✓");

      // Click -> Failed
      await loyaltyCell.click();
      await expect(loyaltyCell).toContainText("✗");

      // Click -> Pending
      await loyaltyCell.click();
      await expect(loyaltyCell).toContainText("⏳");

      // Reload and verify persistence
      await isolatedUser.page.reload();
      const loyaltyCellAfterReload = isolatedUser.page.getByTestId(`loyalty-cell-${booking.id}`);
      await expect(loyaltyCellAfterReload).toContainText("⏳");
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
    const propertyName = `Accor Partnership Test ${crypto.randomUUID()}`;
    const bookingRes = await isolatedUser.request.post("/api/bookings", {
      data: {
        hotelChainId: ACCOR_ID,
        propertyName,
        checkIn: `${PAST_YEAR}-06-10`,
        checkOut: `${PAST_YEAR}-06-15`,
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
      await isolatedUser.page.goto("/earnings-tracker");
      await isolatedUser.page.getByTestId("earnings-filter-all").click();
      await expect(
        isolatedUser.page.getByRole("heading", { name: "Earnings Tracker" })
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
      await isolatedUser.page.goto("/earnings-tracker");

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

  test("card reward cell cycles its status", async ({ isolatedUser }) => {
    // Chase Sapphire Reserve: 4x UR points → non-zero cardReward triggers the cell
    const uccRes = await isolatedUser.request.post("/api/user-credit-cards", {
      data: { creditCardId: CREDIT_CARD_ID.CHASE_SAPPHIRE_RESERVE },
    });
    expect(uccRes.ok()).toBeTruthy();
    const { id: userCreditCardId } = await uccRes.json();

    const propertyName = `Card Reward Cycle ${crypto.randomUUID()}`;
    const bookingRes = await isolatedUser.request.post("/api/bookings", {
      data: {
        hotelChainId: HYATT_ID,
        propertyName,
        checkIn: `${YEAR}-11-20`,
        checkOut: `${YEAR}-11-25`,
        numNights: 5,
        pretaxCost: 400,
        taxAmount: 80,
        totalCost: 480,
        currency: "USD",
        bookingSource: "direct_web",
        countryCode: "US",
        city: "New York",
        userCreditCardId,
      },
    });
    expect(bookingRes.ok()).toBeTruthy();
    const booking = await bookingRes.json();

    try {
      await isolatedUser.page.goto("/earnings-tracker");

      const cardRewardCell = isolatedUser.page.getByTestId(`card-reward-cell-${booking.id}`);

      // Initial state: Pending
      await expect(cardRewardCell).toContainText("⏳");

      // Click → Posted
      await cardRewardCell.click();
      await expect(cardRewardCell).toContainText("✓");

      // Click → Failed
      await cardRewardCell.click();
      await expect(cardRewardCell).toContainText("✗");

      // Click → Pending
      await cardRewardCell.click();
      await expect(cardRewardCell).toContainText("⏳");
    } finally {
      await isolatedUser.request.delete(`/api/bookings/${booking.id}`);
      await isolatedUser.request.delete(`/api/user-credit-cards/${userCreditCardId}`);
    }
  });

  test("portal cashback cell cycles its status", async ({ isolatedUser }) => {
    const propertyName = `Portal Cycle ${crypto.randomUUID()}`;
    const bookingRes = await isolatedUser.request.post("/api/bookings", {
      data: {
        hotelChainId: HYATT_ID,
        propertyName,
        checkIn: `${YEAR}-11-25`,
        checkOut: `${YEAR}-11-30`,
        numNights: 5,
        pretaxCost: 400,
        taxAmount: 80,
        totalCost: 480,
        currency: "USD",
        bookingSource: "direct_web",
        countryCode: "US",
        city: "New York",
        shoppingPortalId: SHOPPING_PORTAL_ID.RAKUTEN,
        portalCashbackRate: 0.05,
        portalCashbackOnTotal: false,
      },
    });
    expect(bookingRes.ok()).toBeTruthy();
    const booking = await bookingRes.json();

    try {
      await isolatedUser.page.goto("/earnings-tracker");

      const portalCell = isolatedUser.page.getByTestId(`portal-cashback-cell-${booking.id}`);

      // Initial state: Pending
      await expect(portalCell).toContainText("⏳");

      // Click → Posted
      await portalCell.click();
      await expect(portalCell).toContainText("✓");

      // Click → Failed
      await portalCell.click();
      await expect(portalCell).toContainText("✗");

      // Click → Pending
      await portalCell.click();
      await expect(portalCell).toContainText("⏳");
    } finally {
      await isolatedUser.request.delete(`/api/bookings/${booking.id}`);
    }
  });

  test("card benefit cell cycles its status", async ({
    isolatedUser,
    adminRequest,
    testHotelChain,
  }) => {
    const uccRes = await isolatedUser.request.post("/api/user-credit-cards", {
      data: { creditCardId: CREDIT_CARD_ID.AMEX_BUSINESS_PLATINUM },
    });
    expect(uccRes.ok()).toBeTruthy();
    const { id: userCreditCardId } = await uccRes.json();

    const benefitRes = await adminRequest.post("/api/card-benefits", {
      data: {
        creditCardId: CREDIT_CARD_ID.AMEX_BUSINESS_PLATINUM,
        description: "Test earnings tracker credit",
        value: 50,
        period: "quarterly",
        hotelChainId: testHotelChain.id,
        isActive: true,
      },
    });
    expect(benefitRes.ok()).toBeTruthy();
    const { id: benefitId } = await benefitRes.json();

    const propertyName = `Card Benefit Cycle ${crypto.randomUUID()}`;
    const bookingRes = await isolatedUser.request.post("/api/bookings", {
      data: {
        hotelChainId: testHotelChain.id,
        propertyName,
        checkIn: `${YEAR}-12-01`,
        checkOut: `${YEAR}-12-05`,
        numNights: 4,
        pretaxCost: 400,
        taxAmount: 40,
        totalCost: 440,
        currency: "USD",
        bookingSource: "direct_web",
        countryCode: "US",
        city: "Chicago",
        userCreditCardId,
      },
    });
    expect(bookingRes.ok()).toBeTruthy();
    const booking = await bookingRes.json();

    try {
      await isolatedUser.page.goto("/earnings-tracker");

      const cardBenefitCell = isolatedUser.page.getByTestId(`card-benefit-cell-${booking.id}`);

      // Initial state: Pending
      await expect(cardBenefitCell).toContainText("⏳");

      // Click → Posted
      await cardBenefitCell.click();
      await expect(cardBenefitCell).toContainText("✓");

      // Click → Failed
      await cardBenefitCell.click();
      await expect(cardBenefitCell).toContainText("✗");

      // Click → Pending
      await cardBenefitCell.click();
      await expect(cardBenefitCell).toContainText("⏳");
    } finally {
      await isolatedUser.request.delete(`/api/bookings/${booking.id}`);
      await isolatedUser.request.delete(`/api/user-credit-cards/${userCreditCardId}`);
      await adminRequest.delete(`/api/card-benefits/${benefitId}`);
    }
  });

  test("booking with only $0 pre-qualifying promotions leaves Needs Attention when all visible items posted", async ({
    isolatedUser,
  }) => {
    // Create a promotion that requires 1 prerequisite stay — so the FIRST booking
    // is pre-qualifying (appliedValue=0, isPreQualifying=true) and invisible in the grid.
    const promoName = `PreQual Promo ${crypto.randomUUID()}`;
    const promoRes = await isolatedUser.request.post("/api/promotions", {
      data: {
        name: promoName,
        type: "loyalty",
        hotelChainId: HYATT_ID,
        benefits: [{ rewardType: "cashback", valueType: "fixed", value: 50, sortOrder: 0 }],
        restrictions: { prerequisiteStayCount: 1 },
      },
    });
    expect(promoRes.ok()).toBeTruthy();
    const promo = await promoRes.json();

    // Create a PAST Hyatt booking — loyalty auto-sets to pending; promo attaches as pre-qualifying ($0).
    const propertyName = `PreQual Hotel ${crypto.randomUUID()}`;
    const bookingRes = await isolatedUser.request.post("/api/bookings", {
      data: {
        hotelChainId: HYATT_ID,
        propertyName,
        checkIn: `${PAST_YEAR}-11-01`,
        checkOut: `${PAST_YEAR}-11-05`,
        numNights: 4,
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
      await isolatedUser.page.goto("/earnings-tracker");
      await expect(
        isolatedUser.page.getByRole("heading", { name: "Earnings Tracker" })
      ).toBeVisible();

      // Booking should appear in Needs Attention (loyalty is pending)
      await expect(isolatedUser.page.getByText(propertyName)).toBeVisible();

      // Mark loyalty as posted — now all visible items are posted
      // (the $0 pre-qualifying promo is hidden and must NOT keep the booking in Needs Attention)
      const loyaltyCell = isolatedUser.page.getByTestId(`loyalty-cell-${booking.id}`);
      await loyaltyCell.click();
      await expect(loyaltyCell).toContainText("✓");

      // Reload — booking should now be GONE from Needs Attention
      await isolatedUser.page.reload();
      await expect(isolatedUser.page.getByText(propertyName)).toHaveCount(0);
    } finally {
      await isolatedUser.request.delete(`/api/bookings/${booking.id}`);
      await isolatedUser.request.delete(`/api/promotions/${promo.id}`);
    }
  });

  test("perks cell cycles its status", async ({ isolatedUser }) => {
    const propertyName = `Perks Cycle ${crypto.randomUUID()}`;
    const bookingRes = await isolatedUser.request.post("/api/bookings", {
      data: {
        hotelChainId: HYATT_ID,
        propertyName,
        checkIn: `${YEAR}-12-05`,
        checkOut: `${YEAR}-12-10`,
        numNights: 5,
        pretaxCost: 400,
        taxAmount: 80,
        totalCost: 480,
        currency: "USD",
        bookingSource: "direct_web",
        countryCode: "US",
        city: "New York",
        benefits: [{ benefitType: "free_breakfast", dollarValue: 25 }],
      },
    });
    expect(bookingRes.ok()).toBeTruthy();
    const booking = await bookingRes.json();

    try {
      await isolatedUser.page.goto("/earnings-tracker");

      const perksCell = isolatedUser.page.getByTestId(`perks-cell-${booking.id}`);

      // Initial state: Pending
      await expect(perksCell).toContainText("⏳");

      // Click → Posted
      await perksCell.click();
      await expect(perksCell).toContainText("✓");

      // Click → Failed
      await perksCell.click();
      await expect(perksCell).toContainText("✗");

      // Click → Pending
      await perksCell.click();
      await expect(perksCell).toContainText("⏳");
    } finally {
      await isolatedUser.request.delete(`/api/bookings/${booking.id}`);
    }
  });
});
