import { test, expect } from "./fixtures";
import { HOTEL_ID } from "@/lib/constants";
import { CREDIT_CARD_ID, OTA_AGENCY_ID } from "../prisma/seed-ids";

test.describe("Booking Benefits in Cost Breakdown", () => {
  test("cash benefit appears expanded and reduces Net Cost", async ({ isolatedUser }) => {
    const { request, page } = isolatedUser;

    const bookingRes = await request.post("/api/bookings", {
      data: {
        accommodationType: "hotel",
        hotelChainId: HOTEL_ID.HYATT,
        propertyName: "Test Property",
        checkIn: "2025-06-01",
        checkOut: "2025-06-04",
        numNights: 3,
        pretaxCost: 300,
        taxAmount: 30,
        totalCost: 330,
        currency: "USD",
        benefits: [{ benefitType: "free_breakfast", dollarValue: 25 }],
      },
    });
    expect(bookingRes.ok()).toBeTruthy();
    const booking = await bookingRes.json();

    try {
      await page.goto(`/bookings/${booking.id}`);

      const benefitsToggle = page.getByTestId("breakdown-benefits-toggle");
      await expect(benefitsToggle).toBeVisible();
      await expect(page.getByTestId("breakdown-benefits-value")).toContainText("$25.00");

      await benefitsToggle.click();
      const benefitsList = page.getByTestId("breakdown-benefits-list");
      await expect(benefitsList).toBeVisible();
      await expect(benefitsList).toContainText("Free Breakfast");

      const netCost = page.getByTestId("breakdown-net-cost");
      // 330 - 25 (benefit) - 30 (loyalty: 300 × 5pts × $0.02) = $275.00
      await expect(netCost).toContainText("$275.00");
    } finally {
      await request.delete(`/api/bookings/${booking.id}`);
    }
  });

  test("fixed_per_night points benefit shows correct dollar value", async ({ isolatedUser }) => {
    const { request, page } = isolatedUser;

    // Hyatt: $0.02/pt (usdCentsPerPoint=0.02); 1000 pts × 3 nights × 0.02 = $60.00
    const bookingRes = await request.post("/api/bookings", {
      data: {
        accommodationType: "hotel",
        hotelChainId: HOTEL_ID.HYATT,
        propertyName: "Test Property",
        checkIn: "2025-06-01",
        checkOut: "2025-06-04",
        numNights: 3,
        pretaxCost: 300,
        taxAmount: 30,
        totalCost: 330,
        currency: "USD",
        benefits: [
          {
            benefitType: "other",
            label: "Bonus Points",
            pointsEarnType: "fixed_per_night",
            pointsAmount: 1000,
          },
        ],
      },
    });
    expect(bookingRes.ok()).toBeTruthy();
    const booking = await bookingRes.json();

    try {
      await page.goto(`/bookings/${booking.id}`);

      const benefitsToggle = page.getByTestId("breakdown-benefits-toggle");
      await expect(benefitsToggle).toBeVisible();

      await benefitsToggle.click();
      const benefitsList = page.getByTestId("breakdown-benefits-list");
      await expect(benefitsList).toContainText("Bonus Points");
      await expect(page.getByTestId("breakdown-benefits-value")).toContainText("$60.00");
    } finally {
      await request.delete(`/api/bookings/${booking.id}`);
    }
  });

  test("multiplier_on_base benefit shows correct dollar value", async ({ isolatedUser }) => {
    const { request, page } = isolatedUser;

    // Hyatt: basePointRate=5, pretaxCost=300, multiplier=2.0
    // extraPts = floor((2-1) × 5 × 300) = 1500 pts
    // value = 1500 × $0.02 = $30.00
    const bookingRes = await request.post("/api/bookings", {
      data: {
        accommodationType: "hotel",
        hotelChainId: HOTEL_ID.HYATT,
        propertyName: "Test Property",
        checkIn: "2025-06-01",
        checkOut: "2025-06-04",
        numNights: 3,
        pretaxCost: 300,
        taxAmount: 30,
        totalCost: 330,
        currency: "USD",
        benefits: [
          {
            benefitType: "other",
            label: "Double Base Points",
            pointsEarnType: "multiplier_on_base",
            pointsMultiplier: 2.0,
          },
        ],
      },
    });
    expect(bookingRes.ok()).toBeTruthy();
    const booking = await bookingRes.json();

    try {
      await page.goto(`/bookings/${booking.id}`);

      const benefitsToggle = page.getByTestId("breakdown-benefits-toggle");
      await expect(benefitsToggle).toBeVisible();
      await expect(page.getByTestId("breakdown-benefits-value")).toContainText("$30.00");
    } finally {
      await request.delete(`/api/bookings/${booking.id}`);
    }
  });

  test("Booking Benefits row is absent for a booking with purely informational benefits (no value)", async ({
    isolatedUser,
  }) => {
    const { request, page } = isolatedUser;

    const bookingRes = await request.post("/api/bookings", {
      data: {
        accommodationType: "hotel",
        hotelChainId: HOTEL_ID.HYATT,
        propertyName: "Test Property",
        checkIn: "2025-06-01",
        checkOut: "2025-06-02",
        numNights: 1,
        pretaxCost: 150,
        taxAmount: 15,
        totalCost: 165,
        currency: "USD",
        benefits: [
          { benefitType: "room_upgrade" }, // no dollarValue, no pointsEarnType
        ],
      },
    });
    expect(bookingRes.ok()).toBeTruthy();
    const booking = await bookingRes.json();

    try {
      await page.goto(`/bookings/${booking.id}`);
      await expect(page.getByTestId("breakdown-benefits-toggle")).not.toBeVisible();
    } finally {
      await request.delete(`/api/bookings/${booking.id}`);
    }
  });

  test("Booking Benefits row is absent for a booking with no benefits at all", async ({
    isolatedUser,
  }) => {
    const { request, page } = isolatedUser;

    const bookingRes = await request.post("/api/bookings", {
      data: {
        accommodationType: "hotel",
        hotelChainId: HOTEL_ID.HYATT,
        propertyName: "Test Property",
        checkIn: "2025-06-01",
        checkOut: "2025-06-02",
        numNights: 1,
        pretaxCost: 150,
        taxAmount: 15,
        totalCost: 165,
        currency: "USD",
        benefits: [],
      },
    });
    expect(bookingRes.ok()).toBeTruthy();
    const booking = await bookingRes.json();

    try {
      await page.goto(`/bookings/${booking.id}`);
      await expect(page.getByTestId("breakdown-benefits-toggle")).not.toBeVisible();
    } finally {
      await request.delete(`/api/bookings/${booking.id}`);
    }
  });

  test("detail page Booking Benefits card shows pts/night, pts, and multiplier values", async ({
    isolatedUser,
  }) => {
    const { request, page } = isolatedUser;

    const bookingRes = await request.post("/api/bookings", {
      data: {
        accommodationType: "hotel",
        hotelChainId: HOTEL_ID.HYATT,
        propertyName: "Test Property",
        checkIn: "2025-06-01",
        checkOut: "2025-06-04",
        numNights: 3,
        pretaxCost: 300,
        taxAmount: 30,
        totalCost: 330,
        currency: "USD",
        benefits: [
          {
            benefitType: "other",
            label: "Nightly Bonus",
            pointsEarnType: "fixed_per_night",
            pointsAmount: 1000,
          },
          {
            benefitType: "other",
            label: "Stay Bonus",
            pointsEarnType: "fixed_per_stay",
            pointsAmount: 5000,
          },
          {
            benefitType: "other",
            label: "Double Base",
            pointsEarnType: "multiplier_on_base",
            pointsMultiplier: 2.0,
          },
        ],
      },
    });
    expect(bookingRes.ok()).toBeTruthy();
    const booking = await bookingRes.json();

    try {
      await page.goto(`/bookings/${booking.id}`);

      const card = page.getByTestId("booking-benefits-card");
      await expect(card).toBeVisible();
      await expect(card).toContainText("1,000 pts/night");
      await expect(card).toContainText("5,000 pts");
      await expect(card).toContainText("2× multiplier");
    } finally {
      await request.delete(`/api/bookings/${booking.id}`);
    }
  });
});

test.describe("Booking Benefits form interactions", () => {
  test("switching from 'other' to named type clears label, and back to 'other' shows empty label", async ({
    isolatedUser,
  }) => {
    const { page } = isolatedUser;

    await page.goto("/bookings/new");

    await page.getByRole("button", { name: "+ Add Benefit" }).click();

    // Select "Other" type
    const typeSelect = page.getByTestId("benefit-type-select-0");
    await typeSelect.click();
    await page.getByRole("option", { name: "Other" }).click();

    // Type a label
    const labelInput = page.getByTestId("benefit-label-input-0");
    await expect(labelInput).toBeVisible();
    await labelInput.fill("My Custom Perk");
    await expect(labelInput).toHaveValue("My Custom Perk");

    // Switch to a named type — label input should disappear
    await typeSelect.click();
    await page.getByRole("option", { name: "Free Breakfast" }).click();
    await expect(page.getByTestId("benefit-label-input-0")).not.toBeVisible();

    // Switch back to "Other" — label input should be empty
    await typeSelect.click();
    await page.getByRole("option", { name: "Other" }).click();
    await expect(page.getByTestId("benefit-label-input-0")).toBeVisible();
    await expect(page.getByTestId("benefit-label-input-0")).toHaveValue("");
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
