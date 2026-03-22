import { test, expect } from "./fixtures";
import { CREDIT_CARD_ID, OTA_AGENCY_ID } from "../prisma/seed-ids";
import { HOTEL_ID } from "../src/lib/constants";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("Card Benefits — Settings CRUD (admin)", () => {
  test("creates a card benefit", async ({ adminPage, adminRequest }) => {
    await adminPage.goto("/settings");
    await adminPage.getByRole("tab", { name: "Credit Cards" }).click();

    await expect(adminPage.locator('[data-testid="tab-credit-cards"]')).toBeVisible();

    // Expand AMEX Business Platinum accordion to reveal the benefits section
    await adminPage
      .getByTestId(`accordion-header-${CREDIT_CARD_ID.AMEX_BUSINESS_PLATINUM}`)
      .click();

    // Open Add dialog
    await adminPage.getByTestId("add-card-benefit-button").click();

    await adminPage.getByTestId("add-description-input").fill("Quarterly hotel credit UI test");
    await adminPage.getByTestId("add-value-input").fill("50");

    await adminPage.getByTestId("add-period-select").click();
    await adminPage.getByRole("option", { name: "Quarterly" }).click();

    await adminPage.getByTestId("add-card-benefit-save").click();

    // Verify it appears in the benefits table (desktop viewport)
    await expect(
      adminPage.locator('[data-testid="card-benefit-row"]').filter({
        has: adminPage
          .getByTestId("card-benefit-description")
          .filter({ hasText: "Quarterly hotel credit UI test" }),
      })
    ).toBeVisible();

    // Clean up via API
    const benefits = (await (await adminRequest.get("/api/card-benefits")).json()) as {
      id: string;
      description: string;
    }[];
    const created = benefits.find((b) => b.description === "Quarterly hotel credit UI test");
    if (created) {
      await adminRequest.delete(`/api/card-benefits/${created.id}`);
    }
  });
});

// Each test in this group uses `isolatedUser` to get a fresh user with their
// own UserCreditCard created inline. This prevents parallel chromium/webkit runs from
// sharing bookings and accidentally exhausting each other's benefit caps.
test.describe("Card Benefits — Auto-apply on booking", () => {
  test("benefit is applied when booking matches card and hotel chain", async ({
    adminRequest,
    isolatedUser,
  }) => {
    const uccRes = await isolatedUser.request.post("/api/user-credit-cards", {
      data: { creditCardId: CREDIT_CARD_ID.AMEX_BUSINESS_PLATINUM },
    });
    const { id: userCreditCardId } = (await uccRes.json()) as { id: string };

    const benefit = await adminRequest.post("/api/card-benefits", {
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

    const bookingRes = await isolatedUser.request.post("/api/bookings", {
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
        userCreditCardId,
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
      await isolatedUser.request.delete(`/api/bookings/${booking.id}`);
      await isolatedUser.request.delete(`/api/user-credit-cards/${userCreditCardId}`);
      await adminRequest.delete(`/api/card-benefits/${benefitId}`);
    }
  });

  test("benefit is NOT applied when hotel chain does not match", async ({
    adminRequest,
    isolatedUser,
  }) => {
    const uccRes = await isolatedUser.request.post("/api/user-credit-cards", {
      data: { creditCardId: CREDIT_CARD_ID.AMEX_BUSINESS_PLATINUM },
    });
    const { id: userCreditCardId } = (await uccRes.json()) as { id: string };

    const benefit = await adminRequest.post("/api/card-benefits", {
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
    const bookingRes = await isolatedUser.request.post("/api/bookings", {
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
        userCreditCardId,
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
      await isolatedUser.request.delete(`/api/bookings/${booking.id}`);
      await isolatedUser.request.delete(`/api/user-credit-cards/${userCreditCardId}`);
      await adminRequest.delete(`/api/card-benefits/${benefitId}`);
    }
  });

  test("quarterly cap is respected across two bookings in same quarter", async ({
    adminRequest,
    isolatedUser,
  }) => {
    const uccRes = await isolatedUser.request.post("/api/user-credit-cards", {
      data: { creditCardId: CREDIT_CARD_ID.AMEX_BUSINESS_PLATINUM },
    });
    const { id: userCreditCardId } = (await uccRes.json()) as { id: string };

    const benefit = await adminRequest.post("/api/card-benefits", {
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
      userCreditCardId,
    };

    const res1 = await isolatedUser.request.post("/api/bookings", {
      data: { ...bookingData, propertyName: "Test Hilton Cap A" },
    });
    const booking1 = (await res1.json()) as {
      id: string;
      bookingCardBenefits: { cardBenefitId: string; appliedValue: string | number }[];
    };

    const res2 = await isolatedUser.request.post("/api/bookings", {
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
      await isolatedUser.request.delete(`/api/bookings/${booking1.id}`);
      await isolatedUser.request.delete(`/api/bookings/${booking2.id}`);
      await isolatedUser.request.delete(`/api/user-credit-cards/${userCreditCardId}`);
      await adminRequest.delete(`/api/card-benefits/${benefitId}`);
    }
  });

  test("inactive benefit is NOT applied", async ({ adminRequest, isolatedUser }) => {
    const uccRes = await isolatedUser.request.post("/api/user-credit-cards", {
      data: { creditCardId: CREDIT_CARD_ID.AMEX_BUSINESS_PLATINUM },
    });
    const { id: userCreditCardId } = (await uccRes.json()) as { id: string };

    const benefit = await adminRequest.post("/api/card-benefits", {
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

    const bookingRes = await isolatedUser.request.post("/api/bookings", {
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
        userCreditCardId,
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
      await isolatedUser.request.delete(`/api/bookings/${booking.id}`);
      await isolatedUser.request.delete(`/api/user-credit-cards/${userCreditCardId}`);
      await adminRequest.delete(`/api/card-benefits/${benefitId}`);
    }
  });

  test("earlier booking created after the fact claims the credit", async ({
    adminRequest,
    isolatedUser,
  }) => {
    const uccRes = await isolatedUser.request.post("/api/user-credit-cards", {
      data: { creditCardId: CREDIT_CARD_ID.AMEX_BUSINESS_PLATINUM },
    });
    const { id: userCreditCardId } = (await uccRes.json()) as { id: string };

    // $50 quarterly Hilton credit
    const benefit = await adminRequest.post("/api/card-benefits", {
      data: {
        creditCardId: CREDIT_CARD_ID.AMEX_BUSINESS_PLATINUM,
        description: "Test re-eval on earlier booking",
        value: 50,
        period: "quarterly",
        hotelChainId: HOTEL_ID.HILTON,
        isActive: true,
      },
    });
    const { id: benefitId } = (await benefit.json()) as { id: string };

    // Create a later booking first — it claims the $50
    const laterRes = await isolatedUser.request.post("/api/bookings", {
      data: {
        hotelChainId: HOTEL_ID.HILTON,
        propertyName: "Test Hilton Later",
        checkIn: "2025-07-20",
        checkOut: "2025-07-22",
        numNights: 2,
        pretaxCost: 200,
        taxAmount: 20,
        totalCost: 220,
        currency: "USD",
        bookingSource: "direct_web",
        countryCode: "US",
        city: "Dallas",
        userCreditCardId,
      },
    });
    const laterBooking = (await laterRes.json()) as {
      id: string;
      bookingCardBenefits: { cardBenefitId: string; appliedValue: string | number }[];
    };
    expect(
      Number(
        laterBooking.bookingCardBenefits.find((b) => b.cardBenefitId === benefitId)?.appliedValue
      )
    ).toBe(50);

    // Now create an earlier booking in the same quarter — it should claim the credit
    const earlierRes = await isolatedUser.request.post("/api/bookings", {
      data: {
        hotelChainId: HOTEL_ID.HILTON,
        propertyName: "Test Hilton Earlier",
        checkIn: "2025-07-05",
        checkOut: "2025-07-07",
        numNights: 2,
        pretaxCost: 200,
        taxAmount: 20,
        totalCost: 220,
        currency: "USD",
        bookingSource: "direct_web",
        countryCode: "US",
        city: "Dallas",
        userCreditCardId,
      },
    });
    const earlierBooking = (await earlierRes.json()) as {
      id: string;
      bookingCardBenefits: { cardBenefitId: string; appliedValue: string | number }[];
    };

    try {
      // Earlier booking should now have the $50 credit
      expect(
        Number(
          earlierBooking.bookingCardBenefits.find((b) => b.cardBenefitId === benefitId)
            ?.appliedValue
        )
      ).toBe(50);

      // Later booking should have been re-evaluated and lost the credit
      const laterRefetch = (await (
        await isolatedUser.request.get(`/api/bookings/${laterBooking.id}`)
      ).json()) as {
        bookingCardBenefits: { cardBenefitId: string }[];
      };
      expect(
        laterRefetch.bookingCardBenefits.find((b) => b.cardBenefitId === benefitId)
      ).toBeUndefined();
    } finally {
      await isolatedUser.request.delete(`/api/bookings/${earlierBooking.id}`);
      await isolatedUser.request.delete(`/api/bookings/${laterBooking.id}`);
      await isolatedUser.request.delete(`/api/user-credit-cards/${userCreditCardId}`);
      await adminRequest.delete(`/api/card-benefits/${benefitId}`);
    }
  });

  test("deleting a booking releases its credit to the next eligible booking", async ({
    adminRequest,
    isolatedUser,
  }) => {
    const uccRes = await isolatedUser.request.post("/api/user-credit-cards", {
      data: { creditCardId: CREDIT_CARD_ID.AMEX_BUSINESS_PLATINUM },
    });
    const { id: userCreditCardId } = (await uccRes.json()) as { id: string };

    const benefit = await adminRequest.post("/api/card-benefits", {
      data: {
        creditCardId: CREDIT_CARD_ID.AMEX_BUSINESS_PLATINUM,
        description: "Test re-eval on delete",
        value: 50,
        period: "quarterly",
        hotelChainId: HOTEL_ID.HILTON,
        isActive: true,
      },
    });
    const { id: benefitId } = (await benefit.json()) as { id: string };

    const bookingData = {
      hotelChainId: HOTEL_ID.HILTON,
      checkIn: "2025-07-10",
      checkOut: "2025-07-12",
      numNights: 2,
      pretaxCost: 200,
      taxAmount: 20,
      totalCost: 220,
      currency: "USD",
      bookingSource: "direct_web",
      countryCode: "US",
      city: "Phoenix",
      userCreditCardId,
    };

    // First booking claims the $50
    const res1 = await isolatedUser.request.post("/api/bookings", {
      data: { ...bookingData, propertyName: "Test Hilton Delete A" },
    });
    const booking1 = (await res1.json()) as {
      id: string;
      bookingCardBenefits: { cardBenefitId: string; appliedValue: string | number }[];
    };
    expect(
      Number(booking1.bookingCardBenefits.find((b) => b.cardBenefitId === benefitId)?.appliedValue)
    ).toBe(50);

    // Second booking in same quarter gets nothing
    const res2 = await isolatedUser.request.post("/api/bookings", {
      data: {
        ...bookingData,
        checkIn: "2025-07-15",
        checkOut: "2025-07-17",
        propertyName: "Test Hilton Delete B",
      },
    });
    const booking2 = (await res2.json()) as {
      id: string;
      bookingCardBenefits: { cardBenefitId: string }[];
    };
    expect(booking2.bookingCardBenefits.find((b) => b.cardBenefitId === benefitId)).toBeUndefined();

    try {
      // Delete booking1 — booking2 should now get the $50
      await isolatedUser.request.delete(`/api/bookings/${booking1.id}`);

      const booking2Refetch = (await (
        await isolatedUser.request.get(`/api/bookings/${booking2.id}`)
      ).json()) as {
        bookingCardBenefits: { cardBenefitId: string; appliedValue: string | number }[];
      };
      expect(
        Number(
          booking2Refetch.bookingCardBenefits.find((b) => b.cardBenefitId === benefitId)
            ?.appliedValue
        )
      ).toBe(50);
    } finally {
      await isolatedUser.request.delete(`/api/bookings/${booking2.id}`);
      await isolatedUser.request.delete(`/api/user-credit-cards/${userCreditCardId}`);
      await adminRequest.delete(`/api/card-benefits/${benefitId}`);
    }
  });

  test("prepaid booking booked earlier claims credit over later postpaid booking in same period", async ({
    adminRequest,
    isolatedUser,
  }) => {
    const uccRes = await isolatedUser.request.post("/api/user-credit-cards", {
      data: { creditCardId: CREDIT_CARD_ID.AMEX_BUSINESS_PLATINUM },
    });
    const { id: userCreditCardId } = (await uccRes.json()) as { id: string };

    const benefit = await adminRequest.post("/api/card-benefits", {
      data: {
        creditCardId: CREDIT_CARD_ID.AMEX_BUSINESS_PLATINUM,
        description: "Test prepaid priority",
        value: 50,
        period: "quarterly",
        hotelChainId: HOTEL_ID.HILTON,
        isActive: true,
      },
    });
    const { id: benefitId } = (await benefit.json()) as { id: string };

    // Postpaid booking: checkIn July 20 → chargeDate = July 20 (Q3)
    const postpaidRes = await isolatedUser.request.post("/api/bookings", {
      data: {
        hotelChainId: HOTEL_ID.HILTON,
        propertyName: "Test Hilton Postpaid",
        checkIn: "2025-07-20",
        checkOut: "2025-07-22",
        numNights: 2,
        pretaxCost: 200,
        taxAmount: 20,
        totalCost: 220,
        currency: "USD",
        bookingSource: "direct_web",
        countryCode: "US",
        city: "Seattle",
        userCreditCardId,
        paymentTiming: "postpaid",
      },
    });
    const postpaidBooking = (await postpaidRes.json()) as {
      id: string;
      bookingCardBenefits: { cardBenefitId: string; appliedValue: string | number }[];
    };
    // Postpaid booking initially claims the credit (only booking so far)
    expect(
      Number(
        postpaidBooking.bookingCardBenefits.find((b) => b.cardBenefitId === benefitId)?.appliedValue
      )
    ).toBe(50);

    // Prepaid booking: bookingDate July 5 (Q3), stay in August — chargeDate = July 5
    const prepaidRes = await isolatedUser.request.post("/api/bookings", {
      data: {
        hotelChainId: HOTEL_ID.HILTON,
        propertyName: "Test Hilton Prepaid",
        checkIn: "2025-08-10",
        checkOut: "2025-08-12",
        numNights: 2,
        pretaxCost: 200,
        taxAmount: 20,
        totalCost: 220,
        currency: "USD",
        bookingSource: "direct_web",
        countryCode: "US",
        city: "Seattle",
        userCreditCardId,
        paymentTiming: "prepaid",
        bookingDate: "2025-07-05",
      },
    });
    const prepaidBooking = (await prepaidRes.json()) as {
      id: string;
      bookingCardBenefits: { cardBenefitId: string; appliedValue: string | number }[];
    };

    try {
      // Prepaid booking (chargeDate July 5) should claim the credit over postpaid (chargeDate July 20)
      expect(
        Number(
          prepaidBooking.bookingCardBenefits.find((b) => b.cardBenefitId === benefitId)
            ?.appliedValue
        )
      ).toBe(50);

      // Postpaid booking should have been re-evaluated and lost the credit
      const postpaidRefetch = (await (
        await isolatedUser.request.get(`/api/bookings/${postpaidBooking.id}`)
      ).json()) as {
        bookingCardBenefits: { cardBenefitId: string }[];
      };
      expect(
        postpaidRefetch.bookingCardBenefits.find((b) => b.cardBenefitId === benefitId)
      ).toBeUndefined();
    } finally {
      await isolatedUser.request.delete(`/api/bookings/${prepaidBooking.id}`);
      await isolatedUser.request.delete(`/api/bookings/${postpaidBooking.id}`);
      await isolatedUser.request.delete(`/api/user-credit-cards/${userCreditCardId}`);
      await adminRequest.delete(`/api/card-benefits/${benefitId}`);
    }
  });

  test("benefit is applied on booking update when card instance is added", async ({
    adminRequest,
    isolatedUser,
  }) => {
    const uccRes = await isolatedUser.request.post("/api/user-credit-cards", {
      data: { creditCardId: CREDIT_CARD_ID.AMEX_BUSINESS_PLATINUM },
    });
    const { id: userCreditCardId } = (await uccRes.json()) as { id: string };

    // Create benefit first
    const benefit = await adminRequest.post("/api/card-benefits", {
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
    const bookingRes = await isolatedUser.request.post("/api/bookings", {
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
      const updateRes = await isolatedUser.request.put(`/api/bookings/${booking.id}`, {
        data: { userCreditCardId },
      });
      const updated = (await updateRes.json()) as {
        bookingCardBenefits: { cardBenefitId: string; appliedValue: string | number }[];
      };
      const matched = updated.bookingCardBenefits.find((b) => b.cardBenefitId === benefitId);
      expect(matched).toBeTruthy();
      expect(Number(matched!.appliedValue)).toBe(50);
    } finally {
      await isolatedUser.request.delete(`/api/bookings/${booking.id}`);
      await isolatedUser.request.delete(`/api/user-credit-cards/${userCreditCardId}`);
      await adminRequest.delete(`/api/card-benefits/${benefitId}`);
    }
  });

  test("maxValuePerBooking caps applied value per booking", async ({
    adminRequest,
    isolatedUser,
  }) => {
    const uccRes = await isolatedUser.request.post("/api/user-credit-cards", {
      data: { creditCardId: CREDIT_CARD_ID.AMEX_BUSINESS_PLATINUM },
    });
    const { id: userCreditCardId } = (await uccRes.json()) as { id: string };

    // $500 annual benefit, capped at $250 per booking
    const benefit = await adminRequest.post("/api/card-benefits", {
      data: {
        creditCardId: CREDIT_CARD_ID.AMEX_BUSINESS_PLATINUM,
        description: "Test max per booking cap",
        value: 500,
        maxValuePerBooking: 250,
        period: "annual",
        hotelChainId: HOTEL_ID.HILTON,
        isActive: true,
      },
    });
    const { id: benefitId } = (await benefit.json()) as { id: string };

    // First booking: $300 total cost — should get $250 (capped), not $300
    const res1 = await isolatedUser.request.post("/api/bookings", {
      data: {
        hotelChainId: HOTEL_ID.HILTON,
        propertyName: "Test Max Cap A",
        checkIn: "2025-04-01",
        checkOut: "2025-04-03",
        numNights: 2,
        pretaxCost: 270,
        taxAmount: 30,
        totalCost: 300,
        currency: "USD",
        bookingSource: "direct_web",
        countryCode: "US",
        city: "Chicago",
        userCreditCardId,
      },
    });
    const booking1 = (await res1.json()) as {
      id: string;
      bookingCardBenefits: { cardBenefitId: string; appliedValue: string | number }[];
    };

    // Second booking: should get $250 (remaining $250 from the $500 annual pool)
    const res2 = await isolatedUser.request.post("/api/bookings", {
      data: {
        hotelChainId: HOTEL_ID.HILTON,
        propertyName: "Test Max Cap B",
        checkIn: "2025-05-01",
        checkOut: "2025-05-03",
        numNights: 2,
        pretaxCost: 270,
        taxAmount: 30,
        totalCost: 300,
        currency: "USD",
        bookingSource: "direct_web",
        countryCode: "US",
        city: "Chicago",
        userCreditCardId,
      },
    });
    const booking2 = (await res2.json()) as {
      id: string;
      bookingCardBenefits: { cardBenefitId: string; appliedValue: string | number }[];
    };

    try {
      const match1 = booking1.bookingCardBenefits.find((b) => b.cardBenefitId === benefitId);
      expect(Number(match1?.appliedValue)).toBe(250);

      const match2 = booking2.bookingCardBenefits.find((b) => b.cardBenefitId === benefitId);
      expect(Number(match2?.appliedValue)).toBe(250);
    } finally {
      await isolatedUser.request.delete(`/api/bookings/${booking1.id}`);
      await isolatedUser.request.delete(`/api/bookings/${booking2.id}`);
      await isolatedUser.request.delete(`/api/user-credit-cards/${userCreditCardId}`);
      await adminRequest.delete(`/api/card-benefits/${benefitId}`);
    }
  });

  test("benefit is NOT applied to bookings outside startDate/endDate range", async ({
    adminRequest,
    isolatedUser,
  }) => {
    const uccRes = await isolatedUser.request.post("/api/user-credit-cards", {
      data: { creditCardId: CREDIT_CARD_ID.AMEX_BUSINESS_PLATINUM },
    });
    const { id: userCreditCardId } = (await uccRes.json()) as { id: string };

    // Benefit valid only for Q3 2025 (July–Sep)
    const benefit = await adminRequest.post("/api/card-benefits", {
      data: {
        creditCardId: CREDIT_CARD_ID.AMEX_BUSINESS_PLATINUM,
        description: "Test date range filter",
        value: 50,
        period: "quarterly",
        hotelChainId: HOTEL_ID.HILTON,
        isActive: true,
        startDate: "2025-07-01",
        endDate: "2025-09-30",
      },
    });
    const { id: benefitId } = (await benefit.json()) as { id: string };

    // Booking BEFORE startDate (April → Q2) — should NOT apply
    const beforeRes = await isolatedUser.request.post("/api/bookings", {
      data: {
        hotelChainId: HOTEL_ID.HILTON,
        propertyName: "Test Hilton Before Start",
        checkIn: "2025-04-10",
        checkOut: "2025-04-12",
        numNights: 2,
        pretaxCost: 200,
        taxAmount: 20,
        totalCost: 220,
        currency: "USD",
        bookingSource: "direct_web",
        countryCode: "US",
        city: "Chicago",
        userCreditCardId,
      },
    });
    const beforeBooking = (await beforeRes.json()) as {
      id: string;
      bookingCardBenefits: { cardBenefitId: string }[];
    };

    // Booking WITHIN range (July → Q3) — should apply
    const withinRes = await isolatedUser.request.post("/api/bookings", {
      data: {
        hotelChainId: HOTEL_ID.HILTON,
        propertyName: "Test Hilton Within Range",
        checkIn: "2025-07-15",
        checkOut: "2025-07-17",
        numNights: 2,
        pretaxCost: 200,
        taxAmount: 20,
        totalCost: 220,
        currency: "USD",
        bookingSource: "direct_web",
        countryCode: "US",
        city: "Chicago",
        userCreditCardId,
      },
    });
    const withinBooking = (await withinRes.json()) as {
      id: string;
      bookingCardBenefits: { cardBenefitId: string; appliedValue: string | number }[];
    };

    // Booking AFTER endDate (October → Q4) — should NOT apply
    const afterRes = await isolatedUser.request.post("/api/bookings", {
      data: {
        hotelChainId: HOTEL_ID.HILTON,
        propertyName: "Test Hilton After End",
        checkIn: "2025-10-10",
        checkOut: "2025-10-12",
        numNights: 2,
        pretaxCost: 200,
        taxAmount: 20,
        totalCost: 220,
        currency: "USD",
        bookingSource: "direct_web",
        countryCode: "US",
        city: "Chicago",
        userCreditCardId,
      },
    });
    const afterBooking = (await afterRes.json()) as {
      id: string;
      bookingCardBenefits: { cardBenefitId: string }[];
    };

    try {
      expect(
        beforeBooking.bookingCardBenefits.find((b) => b.cardBenefitId === benefitId)
      ).toBeUndefined();
      expect(
        Number(
          withinBooking.bookingCardBenefits.find((b) => b.cardBenefitId === benefitId)?.appliedValue
        )
      ).toBe(50);
      expect(
        afterBooking.bookingCardBenefits.find((b) => b.cardBenefitId === benefitId)
      ).toBeUndefined();
    } finally {
      await isolatedUser.request.delete(`/api/bookings/${beforeBooking.id}`);
      await isolatedUser.request.delete(`/api/bookings/${withinBooking.id}`);
      await isolatedUser.request.delete(`/api/bookings/${afterBooking.id}`);
      await isolatedUser.request.delete(`/api/user-credit-cards/${userCreditCardId}`);
      await adminRequest.delete(`/api/card-benefits/${benefitId}`);
    }
  });

  test("OTA restriction: benefit applies only when booking OTA matches", async ({
    adminRequest,
    isolatedUser,
  }) => {
    const uccRes = await isolatedUser.request.post("/api/user-credit-cards", {
      data: { creditCardId: CREDIT_CARD_ID.AMEX_BUSINESS_PLATINUM },
    });
    const { id: userCreditCardId } = (await uccRes.json()) as { id: string };

    // Benefit restricted to AMEX FHR bookings only
    const benefit = await adminRequest.post("/api/card-benefits", {
      data: {
        creditCardId: CREDIT_CARD_ID.AMEX_BUSINESS_PLATINUM,
        description: "Test OTA restriction",
        value: 100,
        period: "annual",
        isActive: true,
        otaAgencyIds: [OTA_AGENCY_ID.AMEX_FHR],
      },
    });
    const { id: benefitId } = (await benefit.json()) as { id: string };

    // Booking via AMEX FHR — should apply
    const fhrRes = await isolatedUser.request.post("/api/bookings", {
      data: {
        hotelChainId: HOTEL_ID.HILTON,
        propertyName: "Test FHR Booking",
        checkIn: "2025-04-10",
        checkOut: "2025-04-12",
        numNights: 2,
        pretaxCost: 200,
        taxAmount: 20,
        totalCost: 220,
        currency: "USD",
        bookingSource: "ota",
        otaAgencyId: OTA_AGENCY_ID.AMEX_FHR,
        countryCode: "US",
        city: "Miami",
        userCreditCardId,
      },
    });
    const fhrBooking = (await fhrRes.json()) as {
      id: string;
      bookingCardBenefits: { cardBenefitId: string; appliedValue: string | number }[];
    };

    // Booking via Chase The Edit (different OTA) — should NOT apply
    const chaseRes = await isolatedUser.request.post("/api/bookings", {
      data: {
        hotelChainId: HOTEL_ID.HILTON,
        propertyName: "Test Chase Edit Booking",
        checkIn: "2025-05-10",
        checkOut: "2025-05-12",
        numNights: 2,
        pretaxCost: 200,
        taxAmount: 20,
        totalCost: 220,
        currency: "USD",
        bookingSource: "ota",
        otaAgencyId: OTA_AGENCY_ID.CHASE_EDIT,
        countryCode: "US",
        city: "Miami",
        userCreditCardId,
      },
    });
    const chaseBooking = (await chaseRes.json()) as {
      id: string;
      bookingCardBenefits: { cardBenefitId: string }[];
    };

    try {
      expect(
        Number(
          fhrBooking.bookingCardBenefits.find((b) => b.cardBenefitId === benefitId)?.appliedValue
        )
      ).toBe(100);
      expect(
        chaseBooking.bookingCardBenefits.find((b) => b.cardBenefitId === benefitId)
      ).toBeUndefined();
    } finally {
      await isolatedUser.request.delete(`/api/bookings/${fhrBooking.id}`);
      await isolatedUser.request.delete(`/api/bookings/${chaseBooking.id}`);
      await isolatedUser.request.delete(`/api/user-credit-cards/${userCreditCardId}`);
      await adminRequest.delete(`/api/card-benefits/${benefitId}`);
    }
  });

  test("benefit is NOT applied to bookings before the card was opened", async ({
    adminRequest,
    isolatedUser,
  }) => {
    const uccRes = await isolatedUser.request.post("/api/user-credit-cards", {
      data: { creditCardId: CREDIT_CARD_ID.AMEX_BUSINESS_PLATINUM },
    });
    const { id: userCreditCardId } = (await uccRes.json()) as { id: string };

    // Set the card's openedDate to June 1 — after the April booking but before July
    await isolatedUser.request.put(`/api/user-credit-cards/${userCreditCardId}`, {
      data: { openedDate: "2025-06-01" },
    });

    const benefit = await adminRequest.post("/api/card-benefits", {
      data: {
        creditCardId: CREDIT_CARD_ID.AMEX_BUSINESS_PLATINUM,
        description: "Test card open date filter",
        value: 50,
        period: "quarterly",
        hotelChainId: HOTEL_ID.HILTON,
        isActive: true,
      },
    });
    const { id: benefitId } = (await benefit.json()) as { id: string };

    // Booking BEFORE card opened: checkIn April (Q2, card opened June 1) → should NOT apply
    const beforeRes = await isolatedUser.request.post("/api/bookings", {
      data: {
        hotelChainId: HOTEL_ID.HILTON,
        propertyName: "Test Hilton Before Open",
        checkIn: "2025-04-10",
        checkOut: "2025-04-12",
        numNights: 2,
        pretaxCost: 200,
        taxAmount: 20,
        totalCost: 220,
        currency: "USD",
        bookingSource: "direct_web",
        countryCode: "US",
        city: "Atlanta",
        userCreditCardId,
      },
    });
    const beforeBooking = (await beforeRes.json()) as {
      id: string;
      bookingCardBenefits: { cardBenefitId: string }[];
    };

    // Booking AFTER card opened: checkIn July (Q3) → should apply
    const afterRes = await isolatedUser.request.post("/api/bookings", {
      data: {
        hotelChainId: HOTEL_ID.HILTON,
        propertyName: "Test Hilton After Open",
        checkIn: "2025-07-10",
        checkOut: "2025-07-12",
        numNights: 2,
        pretaxCost: 200,
        taxAmount: 20,
        totalCost: 220,
        currency: "USD",
        bookingSource: "direct_web",
        countryCode: "US",
        city: "Atlanta",
        userCreditCardId,
      },
    });
    const afterBooking = (await afterRes.json()) as {
      id: string;
      bookingCardBenefits: { cardBenefitId: string; appliedValue: string | number }[];
    };

    try {
      expect(
        beforeBooking.bookingCardBenefits.find((b) => b.cardBenefitId === benefitId)
      ).toBeUndefined();
      expect(
        Number(
          afterBooking.bookingCardBenefits.find((b) => b.cardBenefitId === benefitId)?.appliedValue
        )
      ).toBe(50);
    } finally {
      await isolatedUser.request.delete(`/api/bookings/${beforeBooking.id}`);
      await isolatedUser.request.delete(`/api/bookings/${afterBooking.id}`);
      await isolatedUser.request.delete(`/api/user-credit-cards/${userCreditCardId}`);
      await adminRequest.delete(`/api/card-benefits/${benefitId}`);
    }
  });
});
