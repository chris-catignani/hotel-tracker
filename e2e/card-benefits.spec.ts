import { test, expect } from "./fixtures";
import { CREDIT_CARD_ID, USER_CREDIT_CARD_ID } from "../prisma/seed-ids";
import { HOTEL_ID } from "../src/lib/constants";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("Card Benefits — Settings CRUD (admin)", () => {
  test("creates, edits, and deletes a card benefit", async ({ page, request }) => {
    await page.goto("/settings");
    await page.getByRole("tab", { name: "Card Benefits" }).click();

    await expect(page.locator('[data-testid="tab-card-benefits"]')).toBeVisible();

    // Open Add dialog
    await page.getByTestId("add-card-benefit-button").click();

    await page.getByTestId("add-card-select").click();
    await page.getByRole("option").filter({ hasText: "AMEX Business Platinum" }).first().click();

    await page.getByTestId("add-description-input").fill("Quarterly hotel credit UI test");
    await page.getByTestId("add-value-input").fill("50");

    await page.getByTestId("add-period-select").click();
    await page.getByRole("option", { name: "Quarterly" }).click();

    await page.getByTestId("add-card-benefit-save").click();

    // Verify it appears in the desktop table (mobile view is hidden on desktop viewport)
    await expect(
      page.locator('[data-testid="card-benefit-row"]').filter({
        has: page
          .getByTestId("card-benefit-description")
          .filter({ hasText: "Quarterly hotel credit UI test" }),
      })
    ).toBeVisible();

    // Clean up via API
    const benefits = (await (await request.get("/api/card-benefits")).json()) as {
      id: string;
      description: string;
    }[];
    const created = benefits.find((b) => b.description === "Quarterly hotel credit UI test");
    if (created) {
      await request.delete(`/api/card-benefits/${created.id}`);
    }
  });
});

test.describe("Card Benefits — Auto-apply on booking", () => {
  test("benefit is applied when booking matches card and hotel chain", async ({ request }) => {
    const benefit = await request.post("/api/card-benefits", {
      data: {
        creditCardId: CREDIT_CARD_ID.AMEX_BUSINESS_PLATINUM,
        description: "Test Hilton quarterly credit",
        value: 50,
        period: "quarterly",
        hotelChainId: HOTEL_ID.HILTON,
        isActive: true,
      },
    });
    const { id: benefitId } = (await benefit.json()) as { id: string };

    const bookingRes = await request.post("/api/bookings", {
      data: {
        hotelChainId: HOTEL_ID.HILTON,
        propertyName: "Test Hilton for Card Benefits",
        checkIn: "2025-04-01",
        checkOut: "2025-04-03",
        numNights: 2,
        pretaxCost: 200,
        taxAmount: 20,
        totalCost: 220,
        currency: "USD",
        bookingSource: "direct_web",
        countryCode: "US",
        city: "Chicago",
        userCreditCardId: USER_CREDIT_CARD_ID.AMEX_BUSINESS_PLATINUM,
      },
    });
    const booking = (await bookingRes.json()) as {
      id: string;
      bookingCardBenefits: { cardBenefitId: string; appliedValue: string | number }[];
    };

    try {
      const matched = booking.bookingCardBenefits.find((b) => b.cardBenefitId === benefitId);
      expect(matched).toBeTruthy();
      expect(Number(matched!.appliedValue)).toBe(50);
    } finally {
      await request.delete(`/api/bookings/${booking.id}`);
      await request.delete(`/api/card-benefits/${benefitId}`);
    }
  });

  test("benefit is NOT applied when hotel chain does not match", async ({ request }) => {
    const benefit = await request.post("/api/card-benefits", {
      data: {
        creditCardId: CREDIT_CARD_ID.AMEX_BUSINESS_PLATINUM,
        description: "Test Hilton only credit",
        value: 50,
        period: "quarterly",
        hotelChainId: HOTEL_ID.HILTON, // Hilton only
        isActive: true,
      },
    });
    const { id: benefitId } = (await benefit.json()) as { id: string };

    // Book at Marriott
    const bookingRes = await request.post("/api/bookings", {
      data: {
        hotelChainId: HOTEL_ID.MARRIOTT,
        propertyName: "Test Marriott no benefit",
        checkIn: "2025-04-01",
        checkOut: "2025-04-03",
        numNights: 2,
        pretaxCost: 200,
        taxAmount: 20,
        totalCost: 220,
        currency: "USD",
        bookingSource: "direct_web",
        countryCode: "US",
        city: "Chicago",
        userCreditCardId: USER_CREDIT_CARD_ID.AMEX_BUSINESS_PLATINUM,
      },
    });
    const booking = (await bookingRes.json()) as {
      id: string;
      bookingCardBenefits: { cardBenefitId: string }[];
    };

    try {
      const matched = booking.bookingCardBenefits.find((b) => b.cardBenefitId === benefitId);
      expect(matched).toBeUndefined();
    } finally {
      await request.delete(`/api/bookings/${booking.id}`);
      await request.delete(`/api/card-benefits/${benefitId}`);
    }
  });

  test("quarterly cap is respected across two bookings in same quarter", async ({ request }) => {
    const benefit = await request.post("/api/card-benefits", {
      data: {
        creditCardId: CREDIT_CARD_ID.AMEX_BUSINESS_PLATINUM,
        description: "Test quarterly cap credit",
        value: 50,
        period: "quarterly",
        hotelChainId: HOTEL_ID.HILTON,
        isActive: true,
      },
    });
    const { id: benefitId } = (await benefit.json()) as { id: string };

    const bookingData = {
      hotelChainId: HOTEL_ID.HILTON,
      checkIn: "2025-04-05",
      checkOut: "2025-04-07",
      numNights: 2,
      pretaxCost: 300,
      taxAmount: 30,
      totalCost: 330,
      currency: "USD",
      bookingSource: "direct_web",
      countryCode: "US",
      city: "Orlando",
      userCreditCardId: USER_CREDIT_CARD_ID.AMEX_BUSINESS_PLATINUM,
    };

    const res1 = await request.post("/api/bookings", {
      data: { ...bookingData, propertyName: "Test Hilton Cap A" },
    });
    const booking1 = (await res1.json()) as {
      id: string;
      bookingCardBenefits: { cardBenefitId: string; appliedValue: string | number }[];
    };

    const res2 = await request.post("/api/bookings", {
      data: { ...bookingData, propertyName: "Test Hilton Cap B" },
    });
    const booking2 = (await res2.json()) as {
      id: string;
      bookingCardBenefits: { cardBenefitId: string; appliedValue: string | number }[];
    };

    try {
      // First booking: $50 applied
      const match1 = booking1.bookingCardBenefits.find((b) => b.cardBenefitId === benefitId);
      expect(Number(match1?.appliedValue)).toBe(50);
      // Second booking same quarter: cap exhausted, benefit not applied
      const match2 = booking2.bookingCardBenefits.find((b) => b.cardBenefitId === benefitId);
      expect(match2).toBeUndefined();
    } finally {
      await request.delete(`/api/bookings/${booking1.id}`);
      await request.delete(`/api/bookings/${booking2.id}`);
      await request.delete(`/api/card-benefits/${benefitId}`);
    }
  });

  test("inactive benefit is NOT applied", async ({ request }) => {
    const benefit = await request.post("/api/card-benefits", {
      data: {
        creditCardId: CREDIT_CARD_ID.AMEX_BUSINESS_PLATINUM,
        description: "Test inactive credit",
        value: 50,
        period: "quarterly",
        hotelChainId: HOTEL_ID.HILTON,
        isActive: false,
      },
    });
    const { id: benefitId } = (await benefit.json()) as { id: string };

    const bookingRes = await request.post("/api/bookings", {
      data: {
        hotelChainId: HOTEL_ID.HILTON,
        propertyName: "Test Hilton inactive benefit",
        checkIn: "2025-04-01",
        checkOut: "2025-04-03",
        numNights: 2,
        pretaxCost: 200,
        taxAmount: 20,
        totalCost: 220,
        currency: "USD",
        bookingSource: "direct_web",
        countryCode: "US",
        city: "Chicago",
        userCreditCardId: USER_CREDIT_CARD_ID.AMEX_BUSINESS_PLATINUM,
      },
    });
    const booking = (await bookingRes.json()) as {
      id: string;
      bookingCardBenefits: { cardBenefitId: string }[];
    };

    try {
      const matched = booking.bookingCardBenefits.find((b) => b.cardBenefitId === benefitId);
      expect(matched).toBeUndefined();
    } finally {
      await request.delete(`/api/bookings/${booking.id}`);
      await request.delete(`/api/card-benefits/${benefitId}`);
    }
  });

  test("benefit is applied on booking update when card instance is added", async ({ request }) => {
    // Create benefit first
    const benefit = await request.post("/api/card-benefits", {
      data: {
        creditCardId: CREDIT_CARD_ID.AMEX_BUSINESS_PLATINUM,
        description: "Test update apply credit",
        value: 50,
        period: "quarterly",
        hotelChainId: HOTEL_ID.HILTON,
        isActive: true,
      },
    });
    const { id: benefitId } = (await benefit.json()) as { id: string };

    // Start with no card instance — benefit should not apply
    const bookingRes = await request.post("/api/bookings", {
      data: {
        hotelChainId: HOTEL_ID.HILTON,
        propertyName: "Test Hilton update card",
        checkIn: "2025-10-01",
        checkOut: "2025-10-03",
        numNights: 2,
        pretaxCost: 200,
        taxAmount: 20,
        totalCost: 220,
        currency: "USD",
        bookingSource: "direct_web",
        countryCode: "US",
        city: "Miami",
        userCreditCardId: null,
      },
    });
    const booking = (await bookingRes.json()) as {
      id: string;
      bookingCardBenefits: { cardBenefitId: string }[];
    };

    const noneYet = booking.bookingCardBenefits.find((b) => b.cardBenefitId === benefitId);
    expect(noneYet).toBeUndefined();

    try {
      // Update booking to add the card instance
      const updateRes = await request.put(`/api/bookings/${booking.id}`, {
        data: { userCreditCardId: USER_CREDIT_CARD_ID.AMEX_BUSINESS_PLATINUM },
      });
      const updated = (await updateRes.json()) as {
        bookingCardBenefits: { cardBenefitId: string; appliedValue: string | number }[];
      };
      const matched = updated.bookingCardBenefits.find((b) => b.cardBenefitId === benefitId);
      expect(matched).toBeTruthy();
      expect(Number(matched!.appliedValue)).toBe(50);
    } finally {
      await request.delete(`/api/bookings/${booking.id}`);
      await request.delete(`/api/card-benefits/${benefitId}`);
    }
  });
});
