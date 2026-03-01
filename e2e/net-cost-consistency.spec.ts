import { test, expect } from "./fixtures";
import { HOTEL_ID } from "../src/lib/constants";

/**
 * This test verifies that the "Net/Night" and "Net Cost" values are consistent
 * across the Dashboard, Bookings List, and Booking Detail pages.
 */
test.describe("Net Cost Consistency", () => {
  // Use serial mode to avoid race conditions on the dashboard's "Recent Bookings" list
  test.describe.configure({ mode: "serial" });

  test("should show consistent Net/Night with boosted card rewards", async ({
    page,
    request,
    testHotelChain,
  }) => {
    // 1. Create a credit card with a boosted reward rule for our test chain
    const cardRes = await request.post("/api/credit-cards", {
      data: {
        name: `Boosted Card ${crypto.randomUUID()}`,
        rewardType: "points",
        rewardRate: 1,
        pointTypeId: "c8974es8z9vnwdgt934zrlare", // Ultimate Rewards (2¢)
        rewardRules: [
          {
            hotelChainId: testHotelChain.id,
            rewardType: "multiplier",
            rewardValue: 10,
          },
        ],
      },
    });
    const creditCard = await cardRes.json();

    const propertyName = `CC Consistency ${crypto.randomUUID()}`;
    const totalCost = 250;
    const numNights = 2;

    // Net Cost Calculation: 250 - (250 * 10 * 0.02) = 250 - 50 = 200
    // Net/Night: 200 / 2 = 100
    const expectedNetPerNight = "$100.00";
    const expectedNetCost = "$200.00";

    const bookingRes = await request.post("/api/bookings", {
      data: {
        hotelChainId: testHotelChain.id,
        propertyName,
        checkIn: "1990-01-01",
        checkOut: "1990-01-03",
        numNights,
        pretaxCost: 200,
        taxAmount: 50,
        totalCost,
        creditCardId: creditCard.id,
        currency: "USD",
        bookingSource: "direct_web",
      },
    });
    const booking = await bookingRes.json();

    try {
      await page.goto("/");
      const dashboardRow = page.getByTestId(`booking-row-${booking.id}`);
      await expect(dashboardRow).toBeVisible();
      await expect(dashboardRow.getByTestId("booking-net-per-night")).toHaveText(
        expectedNetPerNight
      );

      await page.goto("/bookings");
      const listRow = page.getByTestId(`booking-row-${booking.id}`);
      await expect(listRow).toBeVisible();
      await expect(listRow.getByTestId("booking-net-per-night")).toHaveText(expectedNetPerNight);

      await page.goto(`/bookings/${booking.id}`);
      await expect(page.getByTestId("breakdown-net-cost")).toHaveText(expectedNetCost);
    } finally {
      await request.delete(`/api/bookings/${booking.id}`);
      await request.delete(`/api/credit-cards/${creditCard.id}`);
    }
  });

  test("should show consistent Net/Night with active promotions", async ({
    page,
    request,
    testHotelChain,
  }) => {
    // 1. Create a promotion with fixed $50 cashback
    const promoRes = await request.post("/api/promotions", {
      data: {
        name: `Consistency Promo ${crypto.randomUUID()}`,
        type: "loyalty",
        hotelChainId: testHotelChain.id,
        benefits: [
          {
            rewardType: "cashback",
            valueType: "fixed",
            value: 50,
            sortOrder: 0,
          },
        ],
      },
    });
    const promotion = await promoRes.json();

    const propertyName = `Promo Consistency ${crypto.randomUUID()}`;
    const totalCost = 300;
    const numNights = 2;

    // Net Cost Calculation: 300 - 50 = 250
    // Net/Night: 250 / 2 = 125
    const expectedNetPerNight = "$125.00";
    const expectedNetCost = "$250.00";

    const bookingRes = await request.post("/api/bookings", {
      data: {
        hotelChainId: testHotelChain.id,
        propertyName,
        checkIn: "1990-02-01",
        checkOut: "1990-02-03",
        numNights,
        pretaxCost: 250,
        taxAmount: 50,
        totalCost,
        currency: "USD",
        bookingSource: "direct_web",
      },
    });
    const booking = await bookingRes.json();

    try {
      await page.goto("/");
      const dashboardRow = page.getByTestId(`booking-row-${booking.id}`);
      await expect(dashboardRow).toBeVisible();
      await expect(dashboardRow.getByTestId("booking-net-per-night")).toHaveText(
        expectedNetPerNight
      );

      await page.goto("/bookings");
      const listRow = page.getByTestId(`booking-row-${booking.id}`);
      await expect(listRow).toBeVisible();
      await expect(listRow.getByTestId("booking-net-per-night")).toHaveText(expectedNetPerNight);

      await page.goto(`/bookings/${booking.id}`);
      await expect(page.getByTestId("breakdown-net-cost")).toHaveText(expectedNetCost);
    } finally {
      await request.delete(`/api/bookings/${booking.id}`);
      await request.delete(`/api/promotions/${promotion.id}`);
    }
  });

  test("should show consistent Net/Night with loyalty earnings and elite bonus", async ({
    page,
    request,
  }) => {
    // Using Hyatt (cxjdwg32a8xf7by36md0mdvuu) - 2¢ per point
    // Global Setup seeds Hyatt with Globalist status (30% bonus)
    // Base rate is 5 pts/$.
    // For $350 pretax: 350 * 5 = 1750 base pts.
    // 30% bonus: 1750 * 0.3 = 525 bonus pts.
    // Total: 1750 + 525 = 2275 pts.
    const propertyName = `Loyalty Consistency ${crypto.randomUUID()}`;
    const totalCost = 400;
    const numNights = 2;
    const pretaxCost = 350;
    const pointsEarned = 2275;

    // Net Cost Calculation: 400 - (2275 * 0.02) = 400 - 45.50 = 354.50
    // Net/Night: 354.50 / 2 = 177.25
    const expectedNetPerNight = "$177.25";
    const expectedNetCost = "$354.50";

    const bookingRes = await request.post("/api/bookings", {
      data: {
        hotelChainId: HOTEL_ID.HYATT,
        propertyName,
        checkIn: "1990-03-01",
        checkOut: "1990-03-03",
        numNights,
        pretaxCost,
        taxAmount: 50,
        totalCost,
        loyaltyPointsEarned: pointsEarned,
        currency: "USD",
        bookingSource: "direct_web",
      },
    });
    const booking = await bookingRes.json();

    try {
      await page.goto("/");
      const dashboardRow = page.getByTestId(`booking-row-${booking.id}`);
      await expect(dashboardRow).toBeVisible();
      await expect(dashboardRow.getByTestId("booking-net-per-night")).toHaveText(
        expectedNetPerNight
      );

      await page.goto("/bookings");
      const listRow = page.getByTestId(`booking-row-${booking.id}`);
      await expect(listRow).toBeVisible();
      await expect(listRow.getByTestId("booking-net-per-night")).toHaveText(expectedNetPerNight);

      await page.goto(`/bookings/${booking.id}`);
      await expect(page.getByTestId("breakdown-net-cost")).toHaveText(expectedNetCost);
    } finally {
      await request.delete(`/api/bookings/${booking.id}`);
    }
  });

  test("should show consistent Net/Night with portal cashback (points-based)", async ({
    page,
    request,
  }) => {
    // 1. Create a portal that gives 5 pts/$
    const portalRes = await request.post("/api/portals", {
      data: {
        name: `Consistency Portal ${crypto.randomUUID()}`,
        rewardType: "points",
        pointTypeId: "c8974es8z9vnwdgt934zrlare", // Ultimate Rewards (2¢)
      },
    });
    const portal = await portalRes.json();

    const propertyName = `Portal Consistency ${crypto.randomUUID()}`;
    const totalCost = 300;
    const numNights = 1;

    // Portal Cashback Calculation:
    // Basis (pretax) = 200. Rate = 5 pts/$. Pt Value = 0.02.
    // Cashback = 200 * 5 * 0.02 = $20.00
    // Net Cost = 300 - 20 = 280
    // Net/Night = 280 / 1 = 280
    const expectedNetPerNight = "$280.00";
    const expectedNetCost = "$280.00";

    const bookingRes = await request.post("/api/bookings", {
      data: {
        hotelChainId: HOTEL_ID.HYATT,
        propertyName,
        checkIn: "1990-04-01",
        checkOut: "1990-04-02",
        numNights,
        pretaxCost: 200,
        taxAmount: 100,
        totalCost,
        shoppingPortalId: portal.id,
        portalCashbackRate: 5,
        portalCashbackOnTotal: false,
        loyaltyPointsEarned: 0, // Prevent automatic Hyatt point calculation from adding extra value
        currency: "USD",
        bookingSource: "direct_web",
      },
    });
    const booking = await bookingRes.json();

    try {
      await page.goto("/");
      const dashboardRow = page.getByTestId(`booking-row-${booking.id}`);
      await expect(dashboardRow).toBeVisible();
      await expect(dashboardRow.getByTestId("booking-net-per-night")).toHaveText(
        expectedNetPerNight
      );

      await page.goto("/bookings");
      const listRow = page.getByTestId(`booking-row-${booking.id}`);
      await expect(listRow).toBeVisible();
      await expect(listRow.getByTestId("booking-net-per-night")).toHaveText(expectedNetPerNight);

      await page.goto(`/bookings/${booking.id}`);
      await expect(page.getByTestId("breakdown-net-cost")).toHaveText(expectedNetCost);
    } finally {
      await request.delete(`/api/bookings/${booking.id}`);
      await request.delete(`/api/portals/${portal.id}`);
    }
  });
});
