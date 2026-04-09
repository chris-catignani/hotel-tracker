import { test, expect } from "./fixtures";
import { USER_CREDIT_CARD_ID, CREDIT_CARD_ID } from "../prisma/seed-ids";

const YEAR = new Date().getFullYear();

test.describe("Promotions CRUD", () => {
  test("should display promotions page with Add Promotion button", async ({ testPromotion }) => {
    await testPromotion.page.goto("/promotions");
    await expect(testPromotion.page.getByRole("heading", { name: /Promotions/i })).toBeVisible();
    await expect(testPromotion.page.getByRole("link", { name: /Add Promotion/i })).toBeVisible();
  });

  test("should show a created promotion in the list", async ({ testPromotion }) => {
    await testPromotion.page.goto("/promotions");
    const desktopList = testPromotion.page.getByTestId("promotions-list-desktop");
    await expect(desktopList.getByText(testPromotion.name)).toBeVisible();
  });

  test("should show benefit value in promotions list", async ({ testPromotion }) => {
    await testPromotion.page.goto("/promotions");
    // The fixture creates a $25.00 fixed cashback benefit for this promotion
    const desktopList = testPromotion.page.getByTestId("promotions-list-desktop");
    const row = desktopList.getByRole("row").filter({ hasText: testPromotion.name });
    await expect(row.getByText("$25.00 cashback")).toBeVisible();
  });

  test("should navigate to edit promotion page", async ({ testPromotion }) => {
    await testPromotion.page.goto("/promotions");

    // Find the row with the test promotion and click Edit
    const desktopList = testPromotion.page.getByTestId("promotions-list-desktop");
    const row = desktopList.getByRole("row").filter({ hasText: testPromotion.name });
    await row.getByRole("link", { name: "Edit" }).click();

    await expect(testPromotion.page).toHaveURL(/\/promotions\/[a-z0-9]+\/edit/);
    await expect(
      testPromotion.page.getByRole("heading", { name: /Edit Promotion/i })
    ).toBeVisible();
  });

  test("should pre-populate edit form with existing benefit data", async ({ testPromotion }) => {
    await testPromotion.page.goto(`/promotions`);

    // Navigate to edit
    const desktopList = testPromotion.page.getByTestId("promotions-list-desktop");
    const row = desktopList.getByRole("row").filter({ hasText: testPromotion.name });
    await row.getByRole("link", { name: "Edit" }).click();

    // Wait for form to load
    await expect(testPromotion.page.getByTestId("benefit-row-0")).toBeVisible();

    // Verify the benefit value is pre-populated ($25 cashback)
    const valueInput = testPromotion.page.getByTestId("benefit-value-0");
    await expect(valueInput).toHaveValue("25");
  });

  test("should delete a promotion", async ({ isolatedUser }) => {
    const uniqueName = `Delete Test Promo ${crypto.randomUUID()}`;
    const res = await isolatedUser.request.post("/api/promotions", {
      data: {
        name: uniqueName,
        type: "loyalty",
        benefits: [
          { rewardType: "cashback", valueType: "fixed", value: 10, certType: null, sortOrder: 0 },
        ],
      },
    });
    const promo = await res.json();

    await isolatedUser.page.goto("/promotions");
    const desktopList = isolatedUser.page.getByTestId("promotions-list-desktop");
    await expect(desktopList.getByText(uniqueName)).toBeVisible();

    // Delete the promotion
    const row = desktopList.getByRole("row").filter({ hasText: uniqueName });
    await row.getByRole("button", { name: "Delete" }).click();
    await isolatedUser.page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();

    // Verify the promotion is gone
    await expect(isolatedUser.page.getByText(uniqueName)).toHaveCount(0);

    // Cleanup (in case delete failed)
    await isolatedUser.request.delete(`/api/promotions/${promo.id}`).catch(() => {});
  });
});

test.describe("Promotions multi-benefit via API", () => {
  test("should create a promotion with multiple benefits via API", async ({ isolatedUser }) => {
    const name = `Multi-benefit Promo ${crypto.randomUUID()}`;
    const res = await isolatedUser.request.post("/api/promotions", {
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
    await isolatedUser.request.delete(`/api/promotions/${promo.id}`);
  });

  test("should update promotion benefits via PUT and replace them", async ({ isolatedUser }) => {
    // Create initial promotion
    const name = `Update Benefit Promo ${crypto.randomUUID()}`;
    const createRes = await isolatedUser.request.post("/api/promotions", {
      data: {
        name,
        type: "loyalty",
        benefits: [
          { rewardType: "cashback", valueType: "fixed", value: 50, certType: null, sortOrder: 0 },
        ],
      },
    });
    const created = await createRes.json();

    // Update with different benefits
    const updateRes = await isolatedUser.request.put(`/api/promotions/${created.id}`, {
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
    await isolatedUser.request.delete(`/api/promotions/${created.id}`);
  });

  test("should apply multi-benefit promotion to matching booking", async ({
    isolatedUser,
    adminRequest,
  }) => {
    // Get a hotel chain to link the promotion and booking
    const chainsRes = await adminRequest.get("/api/hotel-chains");
    const chain = (await chainsRes.json())[0];

    // Create a promotion for this chain
    const promoRes = await isolatedUser.request.post("/api/promotions", {
      data: {
        name: `Matching Promo ${crypto.randomUUID()}`,
        type: "loyalty",
        hotelChainId: chain.id,
        benefits: [
          { rewardType: "cashback", valueType: "fixed", value: 20, certType: null, sortOrder: 0 },
          { rewardType: "eqn", valueType: "fixed", value: 2, certType: null, sortOrder: 1 },
        ],
      },
    });
    const promo = await promoRes.json();

    // Create a booking for the same chain
    const bookingRes = await isolatedUser.request.post("/api/bookings", {
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
    const fullRes = await isolatedUser.request.get(`/api/bookings/${booking.id}`);
    const full = await fullRes.json();

    // Should have the promotion applied
    const appliedPromo = full.bookingPromotions.find(
      (bp: { promotionId: string }) => bp.promotionId === promo.id
    );
    expect(appliedPromo).toBeDefined();
    // $20 cashback + 2 * $10 EQN = $40 total
    expect(Number(appliedPromo.appliedValue)).toBe(40);
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
    expect(Number(eqnBenefit.appliedValue)).toBe(20);

    // Cleanup
    await isolatedUser.request.delete(`/api/bookings/${booking.id}`);
    await isolatedUser.request.delete(`/api/promotions/${promo.id}`);
  });
});

test.describe("Promotions tiered", () => {
  test("should apply correct tier benefit based on prior matched stays", async ({
    isolatedUser,
    testHotelChain,
  }) => {
    // Create a 2-tier promotion: $50 on stay #1, $75 on stay #2+
    const promoRes = await isolatedUser.request.post("/api/promotions", {
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
      },
    });
    expect(promoRes.ok()).toBeTruthy();
    const promo = await promoRes.json();
    expect(promo.tiers).toHaveLength(2);

    // First booking — should get tier 1 ($50)
    const booking1Res = await isolatedUser.request.post("/api/bookings", {
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
    const booking2Res = await isolatedUser.request.post("/api/bookings", {
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

    await expect
      .poll(
        async () => {
          const detailRes = await isolatedUser.request.get(`/api/bookings/${booking2.id}`);
          const detail = await detailRes.json();
          const bp = (detail.bookingPromotions ?? []).find(
            (bp: { promotionId: string }) => bp.promotionId === promo.id
          );
          return bp ? Number(bp.appliedValue) : undefined;
        },
        {
          message: "Second booking should have the tiered promotion applied with correct value",
          timeout: 10000,
        }
      )
      .toBe(75);

    // Cleanup
    await isolatedUser.request.delete(`/api/bookings/${booking1.id}`);
    await isolatedUser.request.delete(`/api/bookings/${booking2.id}`);
    await isolatedUser.request.delete(`/api/promotions/${promo.id}`);
  });
});

test.describe("Promotions tie-in credit card (benefit-level restrictions)", () => {
  // Seeded credit card product ID (used on promotion restrictions)
  const TIE_IN_CARD_ID = CREDIT_CARD_ID.AMEX_PLATINUM;
  // Seeded UserCreditCard IDs (used on bookings)
  const TIE_IN_UCC_ID = USER_CREDIT_CARD_ID.AMEX_PLATINUM;
  const OTHER_UCC_ID = USER_CREDIT_CARD_ID.CHASE_SAPPHIRE_RESERVE;

  test("booking WITH tie-in card gets all benefits (base + tie-in)", async ({
    isolatedUser,
    testHotelChain,
  }) => {
    // Base benefit has no restrictions; tie-in benefit is gated by card via benefit-level restrictions
    const promoRes = await isolatedUser.request.post("/api/promotions", {
      data: {
        name: `Tie-In Promo ${crypto.randomUUID()}`,
        type: "loyalty",
        hotelChainId: testHotelChain.id,
        benefits: [
          {
            rewardType: "cashback",
            valueType: "fixed",
            value: 20,
            certType: null,
            sortOrder: 0,
            restrictions: null,
          },
          {
            rewardType: "cashback",
            valueType: "fixed",
            value: 30,
            certType: null,
            sortOrder: 1,
            restrictions: { tieInCreditCardIds: [TIE_IN_CARD_ID], tieInRequiresPayment: false },
          },
        ],
      },
    });
    expect(promoRes.ok()).toBeTruthy();
    const promo = await promoRes.json();
    expect(promo.benefits).toHaveLength(2);
    expect(promo.benefits[1].restrictions?.tieInCards).toHaveLength(1);
    expect(promo.benefits[1].restrictions.tieInCards[0].creditCardId).toBe(TIE_IN_CARD_ID);

    // Create booking WITH the tie-in card
    const bookingRes = await isolatedUser.request.post("/api/bookings", {
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
        userCreditCardId: TIE_IN_UCC_ID,
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
    await isolatedUser.request.delete(`/api/bookings/${booking.id}`);
    await isolatedUser.request.delete(`/api/promotions/${promo.id}`);
  });

  test("booking WITHOUT tie-in card gets only base benefits", async ({
    isolatedUser,
    testHotelChain,
  }) => {
    const promoRes = await isolatedUser.request.post("/api/promotions", {
      data: {
        name: `Tie-In Promo No Card ${crypto.randomUUID()}`,
        type: "loyalty",
        hotelChainId: testHotelChain.id,
        benefits: [
          {
            rewardType: "cashback",
            valueType: "fixed",
            value: 20,
            certType: null,
            sortOrder: 0,
            restrictions: null,
          },
          {
            rewardType: "cashback",
            valueType: "fixed",
            value: 30,
            certType: null,
            sortOrder: 1,
            restrictions: { tieInCreditCardIds: [TIE_IN_CARD_ID] },
          },
        ],
      },
    });
    expect(promoRes.ok()).toBeTruthy();
    const promo = await promoRes.json();

    // Create booking with a DIFFERENT card (not the tie-in card)
    const bookingRes = await isolatedUser.request.post("/api/bookings", {
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
        userCreditCardId: OTHER_UCC_ID,
      },
    });
    expect(bookingRes.ok()).toBeTruthy();
    const booking = await bookingRes.json();

    const appliedPromo = booking.bookingPromotions.find(
      (bp: { promotionId: string }) => bp.promotionId === promo.id
    );
    expect(appliedPromo).toBeDefined();
    // Only $20 base benefit applies; tie-in benefit is skipped (marked as orphaned)
    expect(Number(appliedPromo.appliedValue)).toBe(20);
    const validApplications = appliedPromo.benefitApplications.filter(
      (ba: { isOrphaned: boolean }) => !ba.isOrphaned
    );
    expect(validApplications).toHaveLength(1);
    expect(Number(validApplications[0].appliedValue)).toBe(20);

    // Cleanup
    await isolatedUser.request.delete(`/api/bookings/${booking.id}`);
    await isolatedUser.request.delete(`/api/promotions/${promo.id}`);
  });

  test("booking without any card gets only base benefits when benefit tie-in card is set", async ({
    isolatedUser,
    testHotelChain,
  }) => {
    const promoRes = await isolatedUser.request.post("/api/promotions", {
      data: {
        name: `Tie-In Promo No Payment ${crypto.randomUUID()}`,
        type: "loyalty",
        hotelChainId: testHotelChain.id,
        benefits: [
          {
            rewardType: "cashback",
            valueType: "fixed",
            value: 20,
            certType: null,
            sortOrder: 0,
            restrictions: null,
          },
          {
            rewardType: "cashback",
            valueType: "fixed",
            value: 30,
            certType: null,
            sortOrder: 1,
            restrictions: { tieInCreditCardIds: [TIE_IN_CARD_ID], tieInRequiresPayment: true },
          },
        ],
      },
    });
    expect(promoRes.ok()).toBeTruthy();
    const promo = await promoRes.json();
    expect(promo.benefits[1].restrictions?.tieInRequiresPayment).toBe(true);

    // Create booking with NO credit card
    const bookingRes = await isolatedUser.request.post("/api/bookings", {
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
    // Only $20 base benefit applies; tie-in benefit is skipped (no card, marked as orphaned)
    expect(Number(appliedPromo.appliedValue)).toBe(20);
    const validApplications = appliedPromo.benefitApplications.filter(
      (ba: { isOrphaned: boolean }) => !ba.isOrphaned
    );
    expect(validApplications).toHaveLength(1);
    expect(Number(validApplications[0].appliedValue)).toBe(20);

    // Cleanup
    await isolatedUser.request.delete(`/api/bookings/${booking.id}`);
    await isolatedUser.request.delete(`/api/promotions/${promo.id}`);
  });
});

test.describe("Promotions restriction picker UX", () => {
  test("should auto-populate restriction cards on edit when promotion has restrictions", async ({
    isolatedUser,
  }) => {
    const uniqueName = `Restriction Edit Test ${crypto.randomUUID()}`;
    const res = await isolatedUser.request.post("/api/promotions", {
      data: {
        name: uniqueName,
        type: "loyalty",
        benefits: [
          { rewardType: "cashback", valueType: "fixed", value: 25, certType: null, sortOrder: 0 },
        ],
        restrictions: { minSpend: "200", registrationDeadline: `${YEAR}-06-01` },
      },
    });
    expect(res.ok()).toBeTruthy();
    const promo = await res.json();

    await isolatedUser.page.goto(`/promotions/${promo.id}/edit`);
    await expect(isolatedUser.page.getByTestId("benefit-row-0")).toBeVisible();

    // Restriction cards for set fields should be visible
    await expect(isolatedUser.page.getByTestId("restriction-card-min_spend")).toBeVisible();
    await expect(isolatedUser.page.getByTestId("restriction-card-registration")).toBeVisible();

    // Unset restriction cards should not be present
    await expect(isolatedUser.page.getByTestId("restriction-card-book_by_date")).not.toBeVisible();
    await expect(
      isolatedUser.page.getByTestId("restriction-card-redemption_caps")
    ).not.toBeVisible();

    await isolatedUser.request.delete(`/api/promotions/${promo.id}`);
  });

  test("should remove a restriction card when its X button is clicked", async ({
    isolatedUser,
  }) => {
    const uniqueName = `Restriction Remove Test ${crypto.randomUUID()}`;
    const res = await isolatedUser.request.post("/api/promotions", {
      data: {
        name: uniqueName,
        type: "loyalty",
        benefits: [
          { rewardType: "cashback", valueType: "fixed", value: 25, certType: null, sortOrder: 0 },
        ],
        restrictions: { minSpend: "100" },
      },
    });
    expect(res.ok()).toBeTruthy();
    const promo = await res.json();

    await isolatedUser.page.goto(`/promotions/${promo.id}/edit`);
    await expect(isolatedUser.page.getByTestId("restriction-card-min_spend")).toBeVisible();

    await isolatedUser.page.getByTestId("restriction-remove-min_spend").click();
    await expect(isolatedUser.page.getByTestId("restriction-card-min_spend")).not.toBeVisible();

    await isolatedUser.request.delete(`/api/promotions/${promo.id}`);
  });

  test("should add a restriction card via the picker", async ({ isolatedUser }) => {
    const uniqueName = `Restriction Add Test ${crypto.randomUUID()}`;
    const res = await isolatedUser.request.post("/api/promotions", {
      data: {
        name: uniqueName,
        type: "loyalty",
        benefits: [
          { rewardType: "cashback", valueType: "fixed", value: 25, certType: null, sortOrder: 0 },
        ],
      },
    });
    expect(res.ok()).toBeTruthy();
    const promo = await res.json();

    await isolatedUser.page.goto(`/promotions/${promo.id}/edit`);
    await expect(isolatedUser.page.getByTestId("benefit-row-0")).toBeVisible();

    // No restriction cards present initially
    await expect(isolatedUser.page.getByTestId("restriction-card-min_spend")).not.toBeVisible();

    // Open picker and add Min Spend
    await isolatedUser.page.getByTestId("restriction-picker-button").click();
    await expect(isolatedUser.page.getByTestId("restriction-option-min_spend")).toBeVisible();
    await isolatedUser.page.getByTestId("restriction-option-min_spend").click();

    // Card should now be visible, picker should have closed
    await expect(isolatedUser.page.getByTestId("restriction-card-min_spend")).toBeVisible();
    await expect(isolatedUser.page.getByTestId("restriction-picker-popover")).not.toBeVisible();

    await isolatedUser.request.delete(`/api/promotions/${promo.id}`);
  });
});

test.describe("Promotions constraints", () => {
  test("should enforce maxStayCount: 1 — only first booking gets promotion", async ({
    isolatedUser,
    testHotelChain,
  }) => {
    const promoRes = await isolatedUser.request.post("/api/promotions", {
      data: {
        name: `Max Stay 1 Promo ${crypto.randomUUID()}`,
        type: "loyalty",
        hotelChainId: testHotelChain.id,
        restrictions: { maxStayCount: 1 },
        benefits: [
          { rewardType: "cashback", valueType: "fixed", value: 50, certType: null, sortOrder: 0 },
        ],
      },
    });
    expect(promoRes.ok()).toBeTruthy();
    const promo = await promoRes.json();
    expect(promo.restrictions?.maxStayCount).toBe(1);

    // Create first booking
    const booking1Res = await isolatedUser.request.post("/api/bookings", {
      data: {
        hotelChainId: testHotelChain.id,
        propertyName: `Max Stay Test 1 ${crypto.randomUUID()}`,
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

    // Verify first booking has the promotion applied
    const bp1 = booking1.bookingPromotions.find(
      (bp: { promotionId: string }) => bp.promotionId === promo.id
    );
    expect(bp1).toBeDefined();
    expect(Number(bp1.appliedValue)).toBe(50);

    // Create second booking
    const booking2Res = await isolatedUser.request.post("/api/bookings", {
      data: {
        hotelChainId: testHotelChain.id,
        propertyName: `Max Stay Test 2 ${crypto.randomUUID()}`,
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

    // Verify second booking has the promotion but it's maxed out ($0, no orphaned badge)
    const bp2 = booking2.bookingPromotions.find(
      (bp: { promotionId: string }) => bp.promotionId === promo.id
    );
    expect(bp2).toBeDefined();
    expect(Number(bp2.appliedValue)).toBe(0);
    expect(bp2.isOrphaned).toBe(false); // Hard cap → Maxed Out, not Orphaned

    // Cleanup
    await isolatedUser.request.delete(`/api/bookings/${booking1.id}`);
    await isolatedUser.request.delete(`/api/bookings/${booking2.id}`);
    await isolatedUser.request.delete(`/api/promotions/${promo.id}`);
  });
});

test.describe("Promotions payment type restrictions", () => {
  test("Promotion with 'cash' restriction: applied to cash booking, skipped for points booking", async ({
    isolatedUser,
    testHotelChain,
  }) => {
    // 1. Create a promotion restricted to 'cash' payment type
    const promoName = `Cash Only Promo ${crypto.randomUUID()}`;
    const promoRes = await isolatedUser.request.post("/api/promotions", {
      data: {
        name: promoName,
        type: "loyalty",
        hotelChainId: testHotelChain.id,
        benefits: [
          { rewardType: "cashback", valueType: "fixed", value: 50, certType: null, sortOrder: 0 },
        ],
        restrictions: {
          allowedPaymentTypes: ["cash"],
        },
      },
    });
    expect(promoRes.ok()).toBeTruthy();
    const promo = await promoRes.json();

    // 2. Create a cash booking (pretaxCost > 0, pointsRedeemed = 0)
    const cashBookingRes = await isolatedUser.request.post("/api/bookings", {
      data: {
        hotelChainId: testHotelChain.id,
        propertyName: "Cash Booking",
        checkIn: `${YEAR}-06-01`,
        checkOut: `${YEAR}-06-02`,
        numNights: 1,
        pretaxCost: 100,
        taxAmount: 20,
        totalCost: 120,
        currency: "USD",
        pointsRedeemed: 0,
      },
    });
    const cashBooking = await cashBookingRes.json();

    // 3. Create a points booking (pretaxCost = 0, pointsRedeemed > 0)
    const pointsBookingRes = await isolatedUser.request.post("/api/bookings", {
      data: {
        hotelChainId: testHotelChain.id,
        propertyName: "Points Booking",
        checkIn: `${YEAR}-06-03`,
        checkOut: `${YEAR}-06-04`,
        numNights: 1,
        pretaxCost: 0,
        taxAmount: 0,
        totalCost: 0,
        currency: "USD",
        pointsRedeemed: 10000,
      },
    });
    const pointsBooking = await pointsBookingRes.json();

    // 4. Verify cash booking HAS the promotion
    await expect
      .poll(
        async () => {
          const detail = await (
            await isolatedUser.request.get(`/api/bookings/${cashBooking.id}`)
          ).json();
          return (detail.bookingPromotions ?? []).some(
            (bp: { promotionId: string }) => bp.promotionId === promo.id
          );
        },
        { message: "Cash booking should have the promotion applied", timeout: 10000 }
      )
      .toBe(true);

    // 5. Verify points booking SKIPPED the promotion
    const pointsDetail = await (
      await isolatedUser.request.get(`/api/bookings/${pointsBooking.id}`)
    ).json();

    const pointsApplied = (pointsDetail.bookingPromotions || []).some(
      (bp: { promotionId: string }) => bp.promotionId === promo.id
    );
    expect(pointsApplied).toBe(false);

    // Cleanup
    await isolatedUser.request.delete(`/api/bookings/${cashBooking.id}`);
    await isolatedUser.request.delete(`/api/bookings/${pointsBooking.id}`);
    await isolatedUser.request.delete(`/api/promotions/${promo.id}`);
  });

  test("UI: adding, interacting with, and persisting payment type restriction", async ({
    isolatedUser,
    testHotelChain,
  }) => {
    const promoName = `UI Payment Promo ${crypto.randomUUID()}`;

    await isolatedUser.page.goto("/promotions/new");

    // Basic info
    const nameInput = isolatedUser.page.getByTestId("promotion-name-input");
    await nameInput.click();
    await nameInput.pressSequentially(promoName, { delay: 50 });
    await expect(nameInput).toHaveValue(promoName);

    // Select Loyalty type
    const typeSelect = isolatedUser.page.getByTestId("promotion-type-select");
    await typeSelect.click();
    const typeOption = isolatedUser.page.getByRole("option", { name: "Loyalty" });
    await expect(typeOption).toBeVisible();
    await typeOption.click();
    await expect(typeSelect).toContainText("Loyalty Program");

    // Select Hotel Chain
    const chainSelect = isolatedUser.page.getByTestId("hotel-chain-select");
    await chainSelect.click();
    const chainOption = isolatedUser.page.getByRole("option", { name: testHotelChain.name });
    await expect(chainOption).toBeVisible();
    await chainOption.click();
    await expect(chainSelect).toContainText(testHotelChain.name);

    // Add a benefit
    const benefitInput = isolatedUser.page.getByTestId("benefit-value-0");
    await benefitInput.fill("10");
    await expect(benefitInput).toHaveValue("10");

    // Add Restriction
    await isolatedUser.page.getByTestId("restriction-picker-button").click();
    await isolatedUser.page.getByTestId("restriction-option-payment_type").click();

    // Verify card appears
    const restrictionCard = isolatedUser.page.getByTestId("restriction-card-payment_type");
    await expect(restrictionCard).toBeVisible();

    // Check 'Cash' and 'Points'
    await restrictionCard.getByTestId("payment-type-cash").check();
    await restrictionCard.getByTestId("payment-type-points").check();

    // Save
    await isolatedUser.page.getByTestId("promotion-form-submit").click({ force: true });

    // Wait for navigation back to list
    await expect(isolatedUser.page).toHaveURL(/\/promotions$/, { timeout: 15000 });

    // Ensure we have latest data
    await isolatedUser.page.reload();
    await isolatedUser.page.waitForLoadState("networkidle");
    const desktopList = isolatedUser.page.getByTestId("promotions-list-desktop");
    const row = desktopList.locator("tr").filter({ hasText: promoName });
    await expect(row).toBeVisible({ timeout: 15000 });

    // Navigate to Edit to check persistence
    await row.getByRole("link", { name: "Edit" }).click();

    // Check persistence in Edit page
    await expect(isolatedUser.page).toHaveURL(/\/promotions\/.*\/edit/);
    const url = isolatedUser.page.url();
    const promoId = url.split("/")[4]; // /promotions/[id]/edit
    const editRestrictionCard = isolatedUser.page.getByTestId("restriction-card-payment_type");
    await expect(editRestrictionCard).toBeVisible();
    await expect(editRestrictionCard.getByTestId("payment-type-cash")).toBeChecked();
    await expect(editRestrictionCard.getByTestId("payment-type-points")).toBeChecked();
    await expect(editRestrictionCard.getByTestId("payment-type-cert")).not.toBeChecked();

    // Verify removal
    await editRestrictionCard.getByTestId("restriction-remove-payment_type").click();
    await expect(editRestrictionCard).not.toBeVisible();

    // Save again to ensure deletion persists
    await isolatedUser.page.getByTestId("promotion-form-submit").click();
    await isolatedUser.page.goto("/promotions");
    await expect(isolatedUser.page).toHaveURL(/\/promotions$/);
    await isolatedUser.page.waitForLoadState("networkidle");

    // Navigate back one more time to be absolutely sure
    await desktopList
      .getByRole("row")
      .filter({ hasText: promoName })
      .getByRole("link", { name: "Edit" })
      .click();
    await expect(isolatedUser.page.getByTestId("restriction-card-payment_type")).not.toBeVisible();

    // Cleanup
    await isolatedUser.request.delete(`/api/promotions/${promoId}`);
  });

  test("should dynamically hide ineligible restrictions from the picker", async ({
    isolatedUser,
  }) => {
    await isolatedUser.page.goto("/promotions/new");
    await isolatedUser.page.waitForLoadState("networkidle");

    // 1. Initial Type: Loyalty
    await isolatedUser.page.getByTestId("restriction-picker-button").click();
    // For Loyalty, "Hotel Chain Restriction" should be hidden
    await expect(isolatedUser.page.getByTestId("restriction-option-hotel_chain")).not.toBeVisible();
    // "Tie-In Credit Cards" should be visible
    await expect(isolatedUser.page.getByTestId("restriction-option-tie_in_cards")).toBeVisible();

    // Close picker
    await isolatedUser.page.keyboard.press("Escape");

    // 2. Change Type to Credit Card
    await isolatedUser.page.getByText("Loyalty Program").click();
    await isolatedUser.page.getByRole("option", { name: "Credit Card" }).click();

    await isolatedUser.page.getByTestId("restriction-picker-button").click();
    // For Credit Card, "Tie-In Credit Cards" should be hidden
    await expect(
      isolatedUser.page.getByTestId("restriction-option-tie_in_cards")
    ).not.toBeVisible();
    // "Hotel Chain Restriction" should be visible
    await expect(isolatedUser.page.getByTestId("restriction-option-hotel_chain")).toBeVisible();
  });
});

test.describe("Promotion user isolation", () => {
  test("User B booking should not receive User A promotion even with matching criteria", async ({
    playwright,
    baseURL,
    adminRequest,
  }) => {
    const resolvedBase = baseURL ?? "http://127.0.0.1:3001";

    // --- Setup: fetch a hotel chain (seeded reference data) ---
    const chainsRes = await adminRequest.get("/api/hotel-chains");
    const chains = await chainsRes.json();
    const chain = chains[0];
    expect(chain).toBeDefined();

    // --- User A: register, login, create promotion and booking ---
    const userAReq = await playwright.request.newContext({ baseURL: resolvedBase });
    const emailA = `user-a-isolation-${crypto.randomUUID()}@example.com`;
    await userAReq.post("/api/auth/register", {
      data: { email: emailA, password: "testpass123", name: "User A" },
    });
    const csrfA = await (await userAReq.get("/api/auth/csrf")).json();
    await userAReq.post("/api/auth/callback/credentials", {
      form: {
        csrfToken: csrfA.csrfToken,
        email: emailA,
        password: "testpass123",
        callbackUrl: resolvedBase,
        redirect: "false",
      },
    });

    // User A creates a loyalty promotion for this chain
    const promoRes = await userAReq.post("/api/promotions", {
      data: {
        name: `Isolation Test Promo ${crypto.randomUUID()}`,
        type: "loyalty",
        hotelChainId: chain.id,
        startDate: `${YEAR}-01-01`,
        endDate: `${YEAR}-12-31`,
        benefits: [
          { rewardType: "cashback", valueType: "fixed", value: 50, certType: null, sortOrder: 0 },
        ],
      },
    });
    expect(promoRes.status()).toBe(201);
    const promoA = await promoRes.json();

    // User A creates a booking at the same chain
    const bookingARes = await userAReq.post("/api/bookings", {
      data: {
        hotelChainId: chain.id,
        propertyName: `Hotel A ${crypto.randomUUID()}`,
        checkIn: `${YEAR}-07-01`,
        checkOut: `${YEAR}-07-05`,
        numNights: 4,
        pretaxCost: 400,
        taxAmount: 40,
        totalCost: 440,
        currency: "USD",
        bookingSource: "direct_web",
        countryCode: "US",
        city: "New York",
      },
    });
    expect(bookingARes.status()).toBe(201);
    const bookingA = await bookingARes.json();

    // Verify User A's booking received the promotion
    const bookingADetail = await (await userAReq.get(`/api/bookings/${bookingA.id}`)).json();
    const bookingAPromoIds = bookingADetail.bookingPromotions.map(
      (bp: { promotionId: string }) => bp.promotionId
    );
    expect(bookingAPromoIds).toContain(promoA.id);

    // --- User B: register, login, create matching booking ---
    const userBReq = await playwright.request.newContext({ baseURL: resolvedBase });
    const emailB = `user-b-isolation-${crypto.randomUUID()}@example.com`;
    await userBReq.post("/api/auth/register", {
      data: { email: emailB, password: "testpass123", name: "User B" },
    });
    const csrfB = await (await userBReq.get("/api/auth/csrf")).json();
    await userBReq.post("/api/auth/callback/credentials", {
      form: {
        csrfToken: csrfB.csrfToken,
        email: emailB,
        password: "testpass123",
        callbackUrl: resolvedBase,
        redirect: "false",
      },
    });

    // User B creates a booking at the SAME chain (criteria match User A's promotion)
    const bookingBRes = await userBReq.post("/api/bookings", {
      data: {
        hotelChainId: chain.id,
        propertyName: `Hotel B ${crypto.randomUUID()}`,
        checkIn: `${YEAR}-07-10`,
        checkOut: `${YEAR}-07-14`,
        numNights: 4,
        pretaxCost: 400,
        taxAmount: 40,
        totalCost: 440,
        currency: "USD",
        bookingSource: "direct_web",
        countryCode: "US",
        city: "Chicago",
      },
    });
    expect(bookingBRes.status()).toBe(201);
    const bookingB = await bookingBRes.json();

    // Verify User B's booking has NO promotions applied (User A's promo is invisible to User B)
    const bookingBDetail = await (await userBReq.get(`/api/bookings/${bookingB.id}`)).json();
    expect(bookingBDetail.bookingPromotions).toHaveLength(0);

    // Verify User A's booking is unchanged after User B's activity
    const bookingARecheck = await (await userAReq.get(`/api/bookings/${bookingA.id}`)).json();
    const recheckPromoIds = bookingARecheck.bookingPromotions.map(
      (bp: { promotionId: string }) => bp.promotionId
    );
    expect(recheckPromoIds).toContain(promoA.id);

    // --- Teardown ---
    await userAReq.delete(`/api/bookings/${bookingA.id}`);
    await userAReq.delete(`/api/promotions/${promoA.id}`);
    await userBReq.delete(`/api/bookings/${bookingB.id}`);
    await userAReq.dispose();
    await userBReq.dispose();
  });
});

test.describe("Promotions status filter", () => {
  const PAST = "2020-01-01";
  const FUTURE = "2099-12-31";

  const basePromo = {
    type: "loyalty",
    benefits: [
      { rewardType: "cashback", valueType: "fixed", value: 10, certType: null, sortOrder: 0 },
    ],
  };

  test("defaults to Ongoing and hides expired/upcoming promos", async ({ isolatedUser }) => {
    const ongoingName = `Ongoing ${crypto.randomUUID()}`;
    const expiredName = `Expired ${crypto.randomUUID()}`;
    const upcomingName = `Upcoming ${crypto.randomUUID()}`;

    const [ongoingRes, expiredRes, upcomingRes] = await Promise.all([
      isolatedUser.request.post("/api/promotions", {
        data: { ...basePromo, name: ongoingName, startDate: PAST, endDate: FUTURE },
      }),
      isolatedUser.request.post("/api/promotions", {
        data: { ...basePromo, name: expiredName, startDate: PAST, endDate: PAST },
      }),
      isolatedUser.request.post("/api/promotions", {
        data: { ...basePromo, name: upcomingName, startDate: FUTURE, endDate: FUTURE },
      }),
    ]);
    const ongoing = await ongoingRes.json();
    const expired = await expiredRes.json();
    const upcoming = await upcomingRes.json();

    try {
      await isolatedUser.page.goto("/promotions");
      const desktop = isolatedUser.page.getByTestId("promotions-list-desktop");
      await expect(desktop.getByText(ongoingName)).toBeVisible();
      await expect(isolatedUser.page.getByText(expiredName)).not.toBeVisible();
      await expect(isolatedUser.page.getByText(upcomingName)).not.toBeVisible();
    } finally {
      await Promise.all([
        isolatedUser.request.delete(`/api/promotions/${ongoing.id}`),
        isolatedUser.request.delete(`/api/promotions/${expired.id}`),
        isolatedUser.request.delete(`/api/promotions/${upcoming.id}`),
      ]);
    }
  });

  test("Expired filter shows only expired promos", async ({ isolatedUser }) => {
    const expiredName = `Expired ${crypto.randomUUID()}`;
    const ongoingName = `Ongoing ${crypto.randomUUID()}`;

    const [expiredRes, ongoingRes] = await Promise.all([
      isolatedUser.request.post("/api/promotions", {
        data: { ...basePromo, name: expiredName, startDate: PAST, endDate: PAST },
      }),
      isolatedUser.request.post("/api/promotions", {
        data: { ...basePromo, name: ongoingName, startDate: PAST, endDate: FUTURE },
      }),
    ]);
    const expired = await expiredRes.json();
    const ongoing = await ongoingRes.json();

    try {
      await isolatedUser.page.goto("/promotions");
      await isolatedUser.page.getByTestId("status-filter-expired").click();
      const desktop = isolatedUser.page.getByTestId("promotions-list-desktop");
      await expect(desktop.getByText(expiredName)).toBeVisible();
      await expect(isolatedUser.page.getByText(ongoingName)).not.toBeVisible();
    } finally {
      await Promise.all([
        isolatedUser.request.delete(`/api/promotions/${expired.id}`),
        isolatedUser.request.delete(`/api/promotions/${ongoing.id}`),
      ]);
    }
  });

  test("Upcoming filter shows only upcoming promos", async ({ isolatedUser }) => {
    const upcomingName = `Upcoming ${crypto.randomUUID()}`;
    const ongoingName = `Ongoing ${crypto.randomUUID()}`;

    const [upcomingRes, ongoingRes] = await Promise.all([
      isolatedUser.request.post("/api/promotions", {
        data: { ...basePromo, name: upcomingName, startDate: FUTURE, endDate: FUTURE },
      }),
      isolatedUser.request.post("/api/promotions", {
        data: { ...basePromo, name: ongoingName, startDate: PAST, endDate: FUTURE },
      }),
    ]);
    const upcoming = await upcomingRes.json();
    const ongoing = await ongoingRes.json();

    try {
      await isolatedUser.page.goto("/promotions");
      await isolatedUser.page.getByTestId("status-filter-upcoming").click();
      const desktop = isolatedUser.page.getByTestId("promotions-list-desktop");
      await expect(desktop.getByText(upcomingName)).toBeVisible();
      await expect(isolatedUser.page.getByText(ongoingName)).not.toBeVisible();
    } finally {
      await Promise.all([
        isolatedUser.request.delete(`/api/promotions/${upcoming.id}`),
        isolatedUser.request.delete(`/api/promotions/${ongoing.id}`),
      ]);
    }
  });

  test("All filter shows promos of all statuses", async ({ isolatedUser }) => {
    const ongoingName = `Ongoing ${crypto.randomUUID()}`;
    const expiredName = `Expired ${crypto.randomUUID()}`;

    const [ongoingRes, expiredRes] = await Promise.all([
      isolatedUser.request.post("/api/promotions", {
        data: { ...basePromo, name: ongoingName, startDate: PAST, endDate: FUTURE },
      }),
      isolatedUser.request.post("/api/promotions", {
        data: { ...basePromo, name: expiredName, startDate: PAST, endDate: PAST },
      }),
    ]);
    const ongoing = await ongoingRes.json();
    const expired = await expiredRes.json();

    try {
      await isolatedUser.page.goto("/promotions");
      await isolatedUser.page.getByTestId("status-filter-all").click();
      const desktop = isolatedUser.page.getByTestId("promotions-list-desktop");
      await expect(desktop.getByText(ongoingName)).toBeVisible();
      await expect(desktop.getByText(expiredName)).toBeVisible();
    } finally {
      await Promise.all([
        isolatedUser.request.delete(`/api/promotions/${ongoing.id}`),
        isolatedUser.request.delete(`/api/promotions/${expired.id}`),
      ]);
    }
  });
});
