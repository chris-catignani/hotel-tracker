import { test, expect } from "./fixtures";

test.describe("Promotions CRUD", () => {
  test("should display promotions page with Add Promotion button", async ({ page }) => {
    await page.goto("/promotions");
    await expect(page.getByRole("heading", { name: /Promotions/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Add Promotion/i })).toBeVisible();
  });

  test("should show a created promotion in the list", async ({ page, testPromotion }) => {
    await page.goto("/promotions");
    await expect(page.getByText(testPromotion.name)).toBeVisible();
  });

  test("should show benefit value in promotions list", async ({ page, testPromotion }) => {
    await page.goto("/promotions");
    // The fixture creates a $25.00 fixed cashback benefit for this promotion
    const row = page.getByRole("row").filter({ hasText: testPromotion.name });
    await expect(row.getByText("$25.00 cashback")).toBeVisible();
  });

  test("should navigate to edit promotion page", async ({ page, testPromotion }) => {
    await page.goto("/promotions");

    // Find the row with the test promotion and click Edit
    const row = page.getByRole("row").filter({ hasText: testPromotion.name });
    await row.getByRole("link", { name: "Edit" }).click();

    await expect(page).toHaveURL(/\/promotions\/[a-z0-9]+\/edit/);
    await expect(page.getByRole("heading", { name: /Edit Promotion/i })).toBeVisible();
  });

  test("should pre-populate edit form with existing benefit data", async ({
    page,
    testPromotion,
  }) => {
    await page.goto(`/promotions`);

    // Navigate to edit
    const row = page.getByRole("row").filter({ hasText: testPromotion.name });
    await row.getByRole("link", { name: "Edit" }).click();

    // Wait for form to load
    await expect(page.getByTestId("benefit-row-0")).toBeVisible();

    // Verify the benefit value is pre-populated ($25 cashback)
    const valueInput = page.getByTestId("benefit-value-0");
    await expect(valueInput).toHaveValue("25");
  });

  test("should delete a promotion", async ({ request, page }) => {
    const uniqueName = `Delete Test Promo ${crypto.randomUUID()}`;
    const res = await request.post("/api/promotions", {
      data: {
        name: uniqueName,
        type: "loyalty",
        benefits: [
          { rewardType: "cashback", valueType: "fixed", value: 10, certType: null, sortOrder: 0 },
        ],
        isActive: true,
      },
    });
    const promo = await res.json();

    await page.goto("/promotions");
    await expect(page.getByText(uniqueName)).toBeVisible();

    // Delete the promotion
    const row = page.getByRole("row").filter({ hasText: uniqueName });
    page.once("dialog", (dialog) => dialog.accept());
    await row.getByRole("button", { name: "Delete" }).click();

    // Verify the promotion is gone
    await expect(page.getByText(uniqueName)).not.toBeVisible();

    // Cleanup (in case delete failed)
    await request.delete(`/api/promotions/${promo.id}`).catch(() => {});
  });
});

test.describe("Promotions multi-benefit via API", () => {
  test("should create a promotion with multiple benefits via API", async ({ request }) => {
    const name = `Multi-benefit Promo ${crypto.randomUUID()}`;
    const res = await request.post("/api/promotions", {
      data: {
        name,
        type: "loyalty",
        benefits: [
          { rewardType: "cashback", valueType: "fixed", value: 10, certType: null, sortOrder: 0 },
          {
            rewardType: "points",
            valueType: "fixed",
            value: 500,
            certType: null,
            sortOrder: 1,
          },
          { rewardType: "eqn", valueType: "fixed", value: 1, certType: null, sortOrder: 2 },
        ],
        isActive: true,
      },
    });

    expect(res.ok()).toBeTruthy();
    const promo = await res.json();

    expect(promo.id).toBeDefined();
    expect(promo.benefits).toHaveLength(3);
    expect(promo.benefits[0].rewardType).toBe("cashback");
    expect(promo.benefits[0].valueType).toBe("fixed");
    expect(Number(promo.benefits[0].value)).toBe(10);
    expect(promo.benefits[1].rewardType).toBe("points");
    expect(Number(promo.benefits[1].value)).toBe(500);
    expect(promo.benefits[2].rewardType).toBe("eqn");
    expect(Number(promo.benefits[2].value)).toBe(1);

    // Cleanup
    await request.delete(`/api/promotions/${promo.id}`);
  });

  test("should update promotion benefits via PUT and replace them", async ({ request }) => {
    // Create initial promotion
    const name = `Update Benefit Promo ${crypto.randomUUID()}`;
    const createRes = await request.post("/api/promotions", {
      data: {
        name,
        type: "loyalty",
        benefits: [
          { rewardType: "cashback", valueType: "fixed", value: 50, certType: null, sortOrder: 0 },
        ],
        isActive: true,
      },
    });
    const created = await createRes.json();

    // Update with different benefits
    const updateRes = await request.put(`/api/promotions/${created.id}`, {
      data: {
        name,
        type: "loyalty",
        benefits: [
          {
            rewardType: "cashback",
            valueType: "percentage",
            value: 10,
            certType: null,
            sortOrder: 0,
          },
          {
            rewardType: "points",
            valueType: "fixed",
            value: 1000,
            certType: null,
            sortOrder: 1,
          },
        ],
        isActive: true,
      },
    });

    expect(updateRes.ok()).toBeTruthy();
    const updated = await updateRes.json();

    // Should have exactly 2 benefits now (old one replaced)
    expect(updated.benefits).toHaveLength(2);
    expect(updated.benefits[0].rewardType).toBe("cashback");
    expect(updated.benefits[0].valueType).toBe("percentage");
    expect(Number(updated.benefits[0].value)).toBe(10);
    expect(updated.benefits[1].rewardType).toBe("points");

    // Cleanup
    await request.delete(`/api/promotions/${created.id}`);
  });

  test("should apply multi-benefit promotion to matching booking", async ({ request }) => {
    // Get a hotel chain to link the promotion and booking
    const chainsRes = await request.get("/api/hotel-chains");
    const chain = (await chainsRes.json())[0];

    // Create a promotion for this chain
    const promoRes = await request.post("/api/promotions", {
      data: {
        name: `Matching Promo ${crypto.randomUUID()}`,
        type: "loyalty",
        hotelChainId: chain.id,
        benefits: [
          { rewardType: "cashback", valueType: "fixed", value: 20, certType: null, sortOrder: 0 },
          { rewardType: "eqn", valueType: "fixed", value: 2, certType: null, sortOrder: 1 },
        ],
        isActive: true,
      },
    });
    const promo = await promoRes.json();

    // Create a booking for the same chain
    const bookingRes = await request.post("/api/bookings", {
      data: {
        hotelChainId: chain.id,
        propertyName: `Match Test ${crypto.randomUUID()}`,
        checkIn: "2025-06-01",
        checkOut: "2025-06-03",
        numNights: 2,
        pretaxCost: 200,
        taxAmount: 30,
        totalCost: 230,
        currency: "USD",
      },
    });
    const booking = await bookingRes.json();

    // Fetch full booking to check promotions
    const fullRes = await request.get(`/api/bookings/${booking.id}`);
    const full = await fullRes.json();

    // Should have the promotion applied
    const appliedPromo = full.bookingPromotions.find(
      (bp: { promotionId: string }) => bp.promotionId === promo.id
    );
    expect(appliedPromo).toBeDefined();
    // $20 cashback + $0 EQN = $20 total
    expect(Number(appliedPromo.appliedValue)).toBe(20);
    // Should have 2 benefit applications
    expect(appliedPromo.benefitApplications).toHaveLength(2);
    const cashbackBenefit = appliedPromo.benefitApplications.find(
      (ba: { promotionBenefit: { rewardType: string } }) =>
        ba.promotionBenefit.rewardType === "cashback"
    );
    expect(Number(cashbackBenefit.appliedValue)).toBe(20);
    const eqnBenefit = appliedPromo.benefitApplications.find(
      (ba: { promotionBenefit: { rewardType: string } }) => ba.promotionBenefit.rewardType === "eqn"
    );
    expect(Number(eqnBenefit.appliedValue)).toBe(0);

    // Cleanup
    await request.delete(`/api/bookings/${booking.id}`);
    await request.delete(`/api/promotions/${promo.id}`);
  });
});

test.describe("Promotions tiered", () => {
  test("should apply correct tier benefit based on prior matched stays", async ({
    request,
    testHotelChain,
  }) => {
    // Create a 2-tier promotion: $50 on stay #1, $75 on stay #2+
    const promoRes = await request.post("/api/promotions", {
      data: {
        name: `Tiered Promo ${crypto.randomUUID()}`,
        type: "loyalty",
        hotelChainId: testHotelChain.id,
        benefits: [],
        tiers: [
          {
            minStays: 1,
            maxStays: 1,
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
          {
            minStays: 2,
            maxStays: null,
            benefits: [
              {
                rewardType: "cashback",
                valueType: "fixed",
                value: 75,
                certType: null,
                sortOrder: 0,
              },
            ],
          },
        ],
        isActive: true,
      },
    });
    expect(promoRes.ok()).toBeTruthy();
    const promo = await promoRes.json();
    expect(promo.tiers).toHaveLength(2);

    // First booking — should get tier 1 ($50)
    const booking1Res = await request.post("/api/bookings", {
      data: {
        hotelChainId: testHotelChain.id,
        propertyName: `Tiered Stay 1 ${crypto.randomUUID()}`,
        checkIn: "2025-06-01",
        checkOut: "2025-06-03",
        numNights: 2,
        pretaxCost: 200,
        taxAmount: 30,
        totalCost: 230,
        currency: "USD",
      },
    });
    expect(booking1Res.ok()).toBeTruthy();
    const booking1 = await booking1Res.json();

    const bp1 = booking1.bookingPromotions.find(
      (bp: { promotionId: string }) => bp.promotionId === promo.id
    );
    expect(bp1).toBeDefined();
    expect(Number(bp1.appliedValue)).toBe(50);

    // Second booking — should get tier 2 ($75)
    const booking2Res = await request.post("/api/bookings", {
      data: {
        hotelChainId: testHotelChain.id,
        propertyName: `Tiered Stay 2 ${crypto.randomUUID()}`,
        checkIn: "2025-07-01",
        checkOut: "2025-07-03",
        numNights: 2,
        pretaxCost: 200,
        taxAmount: 30,
        totalCost: 230,
        currency: "USD",
      },
    });
    expect(booking2Res.ok()).toBeTruthy();
    const booking2 = await booking2Res.json();

    const bp2 = booking2.bookingPromotions.find(
      (bp: { promotionId: string }) => bp.promotionId === promo.id
    );
    expect(bp2).toBeDefined();
    expect(Number(bp2.appliedValue)).toBe(75);

    // Cleanup
    await request.delete(`/api/bookings/${booking1.id}`);
    await request.delete(`/api/bookings/${booking2.id}`);
    await request.delete(`/api/promotions/${promo.id}`);
  });
});

test.describe("Promotions tie-in credit card", () => {
  // Seeded credit card IDs (CUIDs)
  const TIE_IN_CARD_ID = "cme8yfwy2hfqahb6ync8czd24"; // Amex Platinum
  const OTHER_CARD_ID = "cw4yg6ftdskwq651p3p8nrvnr"; // Chase Sapphire Reserve

  test("booking WITH tie-in card gets all benefits (base + tie-in)", async ({
    request,
    testHotelChain,
  }) => {
    const promoRes = await request.post("/api/promotions", {
      data: {
        name: `Tie-In Promo ${crypto.randomUUID()}`,
        type: "loyalty",
        hotelChainId: testHotelChain.id,
        tieInCreditCardIds: [TIE_IN_CARD_ID],
        tieInRequiresPayment: false,
        benefits: [
          {
            rewardType: "cashback",
            valueType: "fixed",
            value: 20,
            certType: null,
            isTieIn: false,
            sortOrder: 0,
          },
          {
            rewardType: "cashback",
            valueType: "fixed",
            value: 30,
            certType: null,
            isTieIn: true,
            sortOrder: 1,
          },
        ],
        isActive: true,
      },
    });
    expect(promoRes.ok()).toBeTruthy();
    const promo = await promoRes.json();
    expect(promo.tieInCards.map((c: { creditCardId: string }) => c.creditCardId)).toContain(
      TIE_IN_CARD_ID
    );
    expect(promo.benefits).toHaveLength(2);
    expect(promo.benefits[0].isTieIn).toBe(false);
    expect(promo.benefits[1].isTieIn).toBe(true);

    // Create booking WITH the tie-in card
    const bookingRes = await request.post("/api/bookings", {
      data: {
        hotelChainId: testHotelChain.id,
        propertyName: `Tie-In With Card ${crypto.randomUUID()}`,
        checkIn: "2025-06-01",
        checkOut: "2025-06-03",
        numNights: 2,
        pretaxCost: 200,
        taxAmount: 30,
        totalCost: 230,
        currency: "USD",
        creditCardId: TIE_IN_CARD_ID,
      },
    });
    expect(bookingRes.ok()).toBeTruthy();
    const booking = await bookingRes.json();

    const appliedPromo = booking.bookingPromotions.find(
      (bp: { promotionId: string }) => bp.promotionId === promo.id
    );
    expect(appliedPromo).toBeDefined();
    // $20 base + $30 tie-in = $50 total
    expect(Number(appliedPromo.appliedValue)).toBe(50);
    expect(appliedPromo.benefitApplications).toHaveLength(2);

    // Cleanup
    await request.delete(`/api/bookings/${booking.id}`);
    await request.delete(`/api/promotions/${promo.id}`);
  });

  test("booking WITHOUT tie-in card gets only base benefits", async ({
    request,
    testHotelChain,
  }) => {
    const promoRes = await request.post("/api/promotions", {
      data: {
        name: `Tie-In Promo No Card ${crypto.randomUUID()}`,
        type: "loyalty",
        hotelChainId: testHotelChain.id,
        tieInCreditCardIds: [TIE_IN_CARD_ID],
        tieInRequiresPayment: false,
        benefits: [
          {
            rewardType: "cashback",
            valueType: "fixed",
            value: 20,
            certType: null,
            isTieIn: false,
            sortOrder: 0,
          },
          {
            rewardType: "cashback",
            valueType: "fixed",
            value: 30,
            certType: null,
            isTieIn: true,
            sortOrder: 1,
          },
        ],
        isActive: true,
      },
    });
    expect(promoRes.ok()).toBeTruthy();
    const promo = await promoRes.json();

    // Create booking with a DIFFERENT card (not the tie-in card)
    const bookingRes = await request.post("/api/bookings", {
      data: {
        hotelChainId: testHotelChain.id,
        propertyName: `Tie-In Without Card ${crypto.randomUUID()}`,
        checkIn: "2025-06-01",
        checkOut: "2025-06-03",
        numNights: 2,
        pretaxCost: 200,
        taxAmount: 30,
        totalCost: 230,
        currency: "USD",
        creditCardId: OTHER_CARD_ID,
      },
    });
    expect(bookingRes.ok()).toBeTruthy();
    const booking = await bookingRes.json();

    const appliedPromo = booking.bookingPromotions.find(
      (bp: { promotionId: string }) => bp.promotionId === promo.id
    );
    expect(appliedPromo).toBeDefined();
    // Only $20 base benefit applies; tie-in benefit is skipped
    expect(Number(appliedPromo.appliedValue)).toBe(20);
    expect(appliedPromo.benefitApplications).toHaveLength(1);
    expect(Number(appliedPromo.benefitApplications[0].appliedValue)).toBe(20);

    // Cleanup
    await request.delete(`/api/bookings/${booking.id}`);
    await request.delete(`/api/promotions/${promo.id}`);
  });

  test("booking without any card gets only base benefits when tie-in card is set", async ({
    request,
    testHotelChain,
  }) => {
    const promoRes = await request.post("/api/promotions", {
      data: {
        name: `Tie-In Promo No Payment ${crypto.randomUUID()}`,
        type: "loyalty",
        hotelChainId: testHotelChain.id,
        tieInCreditCardIds: [TIE_IN_CARD_ID],
        tieInRequiresPayment: true,
        benefits: [
          {
            rewardType: "cashback",
            valueType: "fixed",
            value: 20,
            certType: null,
            isTieIn: false,
            sortOrder: 0,
          },
          {
            rewardType: "cashback",
            valueType: "fixed",
            value: 30,
            certType: null,
            isTieIn: true,
            sortOrder: 1,
          },
        ],
        isActive: true,
      },
    });
    expect(promoRes.ok()).toBeTruthy();
    const promo = await promoRes.json();
    expect(promo.tieInRequiresPayment).toBe(true);

    // Create booking with NO credit card
    const bookingRes = await request.post("/api/bookings", {
      data: {
        hotelChainId: testHotelChain.id,
        propertyName: `Tie-In No Payment ${crypto.randomUUID()}`,
        checkIn: "2025-06-01",
        checkOut: "2025-06-03",
        numNights: 2,
        pretaxCost: 200,
        taxAmount: 30,
        totalCost: 230,
        currency: "USD",
      },
    });
    expect(bookingRes.ok()).toBeTruthy();
    const booking = await bookingRes.json();

    const appliedPromo = booking.bookingPromotions.find(
      (bp: { promotionId: string }) => bp.promotionId === promo.id
    );
    expect(appliedPromo).toBeDefined();
    // Only $20 base benefit applies; tie-in benefit is skipped (no card)
    expect(Number(appliedPromo.appliedValue)).toBe(20);
    expect(appliedPromo.benefitApplications).toHaveLength(1);

    // Cleanup
    await request.delete(`/api/bookings/${booking.id}`);
    await request.delete(`/api/promotions/${promo.id}`);
  });
});

test.describe("Promotions constraints", () => {
  test("should enforce isSingleUse: only first booking gets promotion", async ({
    request,
    testHotelChain,
  }) => {
    // Create a single-use loyalty promotion (no isSingleUse constraint first, just verify it matches)
    const promoRes = await request.post("/api/promotions", {
      data: {
        name: `Single Use Promo ${crypto.randomUUID()}`,
        type: "loyalty",
        hotelChainId: testHotelChain.id,
        isSingleUse: true,
        benefits: [
          { rewardType: "cashback", valueType: "fixed", value: 50, certType: null, sortOrder: 0 },
        ],
        isActive: true,
      },
    });
    expect(promoRes.ok()).toBeTruthy();
    const promo = await promoRes.json();
    expect(promo.isSingleUse).toBe(true);

    // Create first booking
    const booking1Res = await request.post("/api/bookings", {
      data: {
        hotelChainId: testHotelChain.id,
        propertyName: `Single Use Test 1 ${crypto.randomUUID()}`,
        checkIn: "2025-06-01",
        checkOut: "2025-06-03",
        numNights: 2,
        pretaxCost: 200,
        taxAmount: 30,
        totalCost: 230,
        currency: "USD",
      },
    });
    expect(booking1Res.ok()).toBeTruthy();
    const booking1 = await booking1Res.json();

    // Verify first booking has the single-use promotion applied
    const booking1SingleUse = booking1.bookingPromotions.find(
      (bp: { promotionId: string }) => bp.promotionId === promo.id
    );
    expect(booking1SingleUse).toBeDefined();
    expect(Number(booking1SingleUse.appliedValue)).toBe(50);

    // Create second booking
    const booking2Res = await request.post("/api/bookings", {
      data: {
        hotelChainId: testHotelChain.id,
        propertyName: `Single Use Test 2 ${crypto.randomUUID()}`,
        checkIn: "2025-07-01",
        checkOut: "2025-07-03",
        numNights: 2,
        pretaxCost: 200,
        taxAmount: 30,
        totalCost: 230,
        currency: "USD",
      },
    });
    expect(booking2Res.ok()).toBeTruthy();
    const booking2 = await booking2Res.json();

    // Verify second booking does NOT have the single-use promotion (isSingleUse constraint enforced)
    const booking2SingleUse = booking2.bookingPromotions.find(
      (bp: { promotionId: string }) => bp.promotionId === promo.id
    );
    expect(booking2SingleUse).toBeUndefined();

    // Cleanup
    await request.delete(`/api/bookings/${booking1.id}`);
    await request.delete(`/api/bookings/${booking2.id}`);
    await request.delete(`/api/promotions/${promo.id}`);
  });
});
