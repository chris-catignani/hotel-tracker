import { test, expect } from "./fixtures";

const YEAR = new Date().getFullYear();

/**
 * E2E tests for promotion auto-apply behavior on the booking detail page.
 * Covers issue #313: verifies that matching promotions surface in the cost
 * breakdown and Applied Promotions section, and that non-matching promotions
 * are absent.
 */
test.describe("Promotion auto-apply on booking detail", () => {
  test("matching promotion appears as a savings line item in the cost breakdown", async ({
    isolatedUser,
    testHotelChain,
  }) => {
    const { request, page } = isolatedUser;

    const promoName = `Auto-apply Promo ${crypto.randomUUID()}`;
    const promoRes = await request.post("/api/promotions", {
      data: {
        name: promoName,
        type: "loyalty",
        hotelChainId: testHotelChain.id,
        benefits: [{ rewardType: "cashback", valueType: "fixed", value: 50, sortOrder: 0 }],
      },
    });
    expect(promoRes.ok()).toBeTruthy();
    const promo = await promoRes.json();

    const bookingRes = await request.post("/api/bookings", {
      data: {
        hotelChainId: testHotelChain.id,
        propertyName: `Auto-apply Hotel ${crypto.randomUUID()}`,
        checkIn: `${YEAR}-07-01`,
        checkOut: `${YEAR}-07-04`,
        numNights: 3,
        pretaxCost: 300,
        taxAmount: 30,
        totalCost: 330,
        currency: "USD",
        bookingSource: "direct_web",
        loyaltyPointsEarned: 0,
      },
    });
    expect(bookingRes.ok()).toBeTruthy();
    const booking = await bookingRes.json();

    try {
      await page.goto(`/bookings/${booking.id}`);

      // The "Promotion Savings" toggle row should be visible with the $50 savings
      const promosToggle = page.getByTestId("breakdown-promos-toggle");
      await expect(promosToggle).toBeVisible();
      await expect(page.getByTestId("breakdown-promo-savings")).toHaveText("-$50.00");

      // Expanding the toggle should show the individual promotion entry
      await promosToggle.click();
      const promosList = page.getByTestId("breakdown-promos-list");
      await expect(promosList).toBeVisible();
      await expect(promosList.getByTestId(`breakdown-promo-item-${promo.id}`)).toHaveText(
        "-$50.00"
      );
      await expect(promosList).toContainText(promoName);
    } finally {
      await request.delete(`/api/bookings/${booking.id}`);
      await request.delete(`/api/promotions/${promo.id}`);
    }
  });

  test("applied promotions section lists the promotion by name and savings amount", async ({
    isolatedUser,
    testHotelChain,
  }) => {
    const { request, page } = isolatedUser;

    const promoName = `Applied Section Promo ${crypto.randomUUID()}`;
    const promoRes = await request.post("/api/promotions", {
      data: {
        name: promoName,
        type: "loyalty",
        hotelChainId: testHotelChain.id,
        benefits: [{ rewardType: "cashback", valueType: "fixed", value: 75, sortOrder: 0 }],
      },
    });
    expect(promoRes.ok()).toBeTruthy();
    const promo = await promoRes.json();

    const bookingRes = await request.post("/api/bookings", {
      data: {
        hotelChainId: testHotelChain.id,
        propertyName: `Applied Section Hotel ${crypto.randomUUID()}`,
        checkIn: `${YEAR}-08-01`,
        checkOut: `${YEAR}-08-04`,
        numNights: 3,
        pretaxCost: 300,
        taxAmount: 30,
        totalCost: 330,
        currency: "USD",
        bookingSource: "direct_web",
        loyaltyPointsEarned: 0,
      },
    });
    expect(bookingRes.ok()).toBeTruthy();
    const booking = await bookingRes.json();

    try {
      await page.goto(`/bookings/${booking.id}`);

      // The "Applied Promotions" card should be visible on desktop
      const appliedSection = page.getByTestId("applied-promos-desktop");
      await expect(appliedSection).toBeVisible();

      // Find the row for this promotion and verify name + applied value
      const promoRow = appliedSection.getByRole("row").filter({ hasText: promoName });
      await expect(promoRow.getByTestId("promo-name")).toHaveText(promoName);
      await expect(promoRow.getByTestId("promo-applied-value")).toHaveText("$75.00");
    } finally {
      await request.delete(`/api/bookings/${booking.id}`);
      await request.delete(`/api/promotions/${promo.id}`);
    }
  });

  test("non-matching promotion (outside stay date window) does not appear in booking detail", async ({
    isolatedUser,
    testHotelChain,
  }) => {
    const { request, page } = isolatedUser;

    // Promotion whose date window ends before the booking's check-in
    const promoName = `Non-match Promo ${crypto.randomUUID()}`;
    const promoRes = await request.post("/api/promotions", {
      data: {
        name: promoName,
        type: "loyalty",
        hotelChainId: testHotelChain.id,
        endDate: `${YEAR}-06-30`,
        benefits: [{ rewardType: "cashback", valueType: "fixed", value: 50, sortOrder: 0 }],
      },
    });
    expect(promoRes.ok()).toBeTruthy();
    const promo = await promoRes.json();

    // Booking checks in after the promotion's end date
    const bookingRes = await request.post("/api/bookings", {
      data: {
        hotelChainId: testHotelChain.id,
        propertyName: `Non-match Hotel ${crypto.randomUUID()}`,
        checkIn: `${YEAR}-07-15`,
        checkOut: `${YEAR}-07-18`,
        numNights: 3,
        pretaxCost: 300,
        taxAmount: 30,
        totalCost: 330,
        currency: "USD",
        bookingSource: "direct_web",
        loyaltyPointsEarned: 0,
      },
    });
    expect(bookingRes.ok()).toBeTruthy();
    const booking = await bookingRes.json();

    try {
      await page.goto(`/bookings/${booking.id}`);

      // No promotion savings row should appear in the cost breakdown
      await expect(page.getByTestId("breakdown-promos-toggle")).not.toBeVisible();

      // The "Applied Promotions" card should not render at all
      await expect(page.getByTestId("applied-promos-desktop")).not.toBeVisible();
    } finally {
      await request.delete(`/api/bookings/${booking.id}`);
      await request.delete(`/api/promotions/${promo.id}`);
    }
  });
});
