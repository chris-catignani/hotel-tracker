import { test, expect } from "./fixtures";

const YEAR = new Date().getFullYear();

test.describe("Pre-qualifying Promotion Details", () => {
  test("shows prerequisite progress and tier table when this booking fulfills the prerequisite", async ({
    page,
    request,
    testHotelChain,
  }) => {
    // Promotion: 1 pre-qualifying stay required, then tiered rewards
    const promoRes = await request.post("/api/promotions", {
      data: {
        name: "PreQualTestPromo",
        type: "loyalty",
        hotelChainId: testHotelChain.id,
        benefits: [],
        restrictions: { prerequisiteStayCount: 1 },
        tiers: [
          {
            minStays: 2,
            maxStays: 2,
            benefits: [
              {
                rewardType: "points",
                valueType: "fixed",
                value: 5000,
                certType: null,
                sortOrder: 0,
              },
            ],
          },
          {
            minStays: 3,
            maxStays: null,
            benefits: [
              {
                rewardType: "points",
                valueType: "fixed",
                value: 7500,
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

    // Need a future booking so this stay is pre-qualifying, not orphaned
    const futureBookingRes = await request.post("/api/bookings", {
      data: {
        hotelChainId: testHotelChain.id,
        propertyName: "Future Stay",
        checkIn: `${YEAR}-12-01`,
        checkOut: `${YEAR}-12-03`,
        numNights: 2,
        pretaxCost: 200,
        taxAmount: 30,
        totalCost: 230,
        currency: "USD",
      },
    });
    const futureBooking = await futureBookingRes.json();

    const currentBookingRes = await request.post("/api/bookings", {
      data: {
        hotelChainId: testHotelChain.id,
        propertyName: "Current Stay Prereq",
        checkIn: `${YEAR}-06-01`,
        checkOut: `${YEAR}-06-03`,
        numNights: 2,
        pretaxCost: 200,
        taxAmount: 30,
        totalCost: 230,
        currency: "USD",
      },
    });
    const currentBooking = await currentBookingRes.json();

    await page.goto(`/bookings/${currentBooking.id}`);
    await page.getByTestId("breakdown-promos-toggle").click();
    await expect(page.getByTestId(`breakdown-promo-item-${promo.id}`)).toBeVisible();

    await page.getByTestId("calc-info-prequaltestpromo").click();
    const popover = page.locator("[role='dialog'], .popover-content");
    await expect(popover).toBeVisible();

    // Prerequisite progress: this booking (stay #1) fulfills the 1-stay requirement
    await expect(popover.getByText(/Prerequisite Stays/i)).toBeVisible();
    await expect(popover.getByText(/1 of 1 pre-qualifying stays complete/i)).toBeVisible();
    await expect(popover.getByText(/this booking is #1/i)).toBeVisible();
    await expect(popover.getByText(/fulfills the prerequisite/i)).toBeVisible();

    // Tier table
    await expect(popover.getByText(/Promotion Tiers/i)).toBeVisible();
    await expect(popover.getByText(/Tier 1: Stay 2/i)).toBeVisible();
    await expect(popover.getByText(/5,000 pts/i)).toBeVisible();
    await expect(popover.getByText(/Tier 2: Stay 3\+/i)).toBeVisible();
    await expect(popover.getByText(/7,500 pts/i)).toBeVisible();

    await request.delete(`/api/bookings/${currentBooking.id}`);
    await request.delete(`/api/bookings/${futureBooking.id}`);
    await request.delete(`/api/promotions/${promo.id}`);
  });

  test("shows current position in tier progression when no prerequisite is required", async ({
    page,
    request,
    testHotelChain,
  }) => {
    // Promotion: tier-only (no prerequisiteStayCount), like GHA multi brand
    const promoRes = await request.post("/api/promotions", {
      data: {
        name: "TierOnlyTestPromo",
        type: "loyalty",
        hotelChainId: testHotelChain.id,
        benefits: [],
        tiers: [
          {
            minStays: 2,
            maxStays: 2,
            benefits: [
              {
                rewardType: "points",
                valueType: "fixed",
                value: 5000,
                certType: null,
                sortOrder: 0,
              },
            ],
          },
          {
            minStays: 3,
            maxStays: null,
            benefits: [
              {
                rewardType: "points",
                valueType: "fixed",
                value: 10000,
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

    const futureBookingRes = await request.post("/api/bookings", {
      data: {
        hotelChainId: testHotelChain.id,
        propertyName: "Future Stay Tier",
        checkIn: `${YEAR}-12-01`,
        checkOut: `${YEAR}-12-03`,
        numNights: 2,
        pretaxCost: 200,
        taxAmount: 30,
        totalCost: 230,
        currency: "USD",
      },
    });
    const futureBooking = await futureBookingRes.json();

    const currentBookingRes = await request.post("/api/bookings", {
      data: {
        hotelChainId: testHotelChain.id,
        propertyName: "Current Stay Tier",
        checkIn: `${YEAR}-06-01`,
        checkOut: `${YEAR}-06-03`,
        numNights: 2,
        pretaxCost: 200,
        taxAmount: 30,
        totalCost: 230,
        currency: "USD",
      },
    });
    const currentBooking = await currentBookingRes.json();

    await page.goto(`/bookings/${currentBooking.id}`);
    await page.getByTestId("breakdown-promos-toggle").click();
    await expect(page.getByTestId(`breakdown-promo-item-${promo.id}`)).toBeVisible();

    await page.getByTestId("calc-info-tieronlytestpromo").click();
    const popover = page.locator("[role='dialog'], .popover-content");
    await expect(popover).toBeVisible();

    // No prerequisite group — this is purely tier-based
    await expect(popover.getByText(/Prerequisite Stays/i)).not.toBeVisible();

    // Tier group: current position segment + tier rewards
    await expect(popover.getByText(/Promotion Tiers/i)).toBeVisible();
    await expect(popover.getByText(/Your Current Position/i)).toBeVisible();
    await expect(
      popover.getByText(/Stay 1 of campaign.*tier rewards begin at stay 2/i)
    ).toBeVisible();
    await expect(popover.getByText(/Tier 1: Stay 2/i)).toBeVisible();
    await expect(popover.getByText(/5,000 pts/i)).toBeVisible();
    await expect(popover.getByText(/Tier 2: Stay 3\+/i)).toBeVisible();
    await expect(popover.getByText(/10,000 pts/i)).toBeVisible();

    await request.delete(`/api/bookings/${currentBooking.id}`);
    await request.delete(`/api/bookings/${futureBooking.id}`);
    await request.delete(`/api/promotions/${promo.id}`);
  });
});

test.describe("Upcoming Tiers on Actively-Earning Tiered Promotions", () => {
  // Shared promotion shape: stay 2 earns 5k pts, stay 3+ earns 7.5k pts
  const tierDefs = [
    {
      minStays: 2,
      maxStays: 2,
      benefits: [
        { rewardType: "points", valueType: "fixed", value: 5000, certType: null, sortOrder: 0 },
      ],
    },
    {
      minStays: 3,
      maxStays: null,
      benefits: [
        { rewardType: "points", valueType: "fixed", value: 7500, certType: null, sortOrder: 0 },
      ],
    },
  ];

  test("shows upcoming tiers when on an intermediate tier", async ({
    page,
    request,
    testHotelChain,
  }) => {
    const promoRes = await request.post("/api/promotions", {
      data: {
        name: "UpcomingTierPromo",
        type: "loyalty",
        hotelChainId: testHotelChain.id,
        benefits: [],
        tiers: tierDefs,
      },
    });
    expect(promoRes.ok()).toBeTruthy();
    const promo = await promoRes.json();

    // Stay #1: pre-qualifying (stay 1 matches no tier)
    const stay1Res = await request.post("/api/bookings", {
      data: {
        hotelChainId: testHotelChain.id,
        propertyName: "Upcoming Tier Stay 1",
        checkIn: `${YEAR}-01-01`,
        checkOut: `${YEAR}-01-03`,
        numNights: 2,
        pretaxCost: 200,
        taxAmount: 30,
        totalCost: 230,
        currency: "USD",
      },
    });
    const stay1 = await stay1Res.json();

    // Stay #2 (current): earns tier 1 (5,000 pts) — should show upcoming tier 2
    const stay2Res = await request.post("/api/bookings", {
      data: {
        hotelChainId: testHotelChain.id,
        propertyName: "Upcoming Tier Stay 2",
        checkIn: `${YEAR}-06-01`,
        checkOut: `${YEAR}-06-03`,
        numNights: 2,
        pretaxCost: 200,
        taxAmount: 30,
        totalCost: 230,
        currency: "USD",
      },
    });
    const stay2 = await stay2Res.json();

    await page.goto(`/bookings/${stay2.id}`);
    await page.getByTestId("breakdown-promos-toggle").click();
    await expect(page.getByTestId(`breakdown-promo-item-${promo.id}`)).toBeVisible();

    await page.getByTestId("calc-info-upcomingtierpromo").click();
    const popover = page.locator("[role='dialog'], .popover-content");
    await expect(popover).toBeVisible();

    // Earns tier 1 — upcoming section shows future tier only
    await expect(popover.getByText(/Upcoming Tiers/i)).toBeVisible();
    await expect(popover.getByText(/Next: Stay 3\+/i)).toBeVisible();
    await expect(popover.getByText(/7,500 pts/i)).toBeVisible();

    // Current tier's reward is shown in the benefit group, not duplicated here
    await expect(popover.getByText(/5,000 Bonus Points/i)).toBeVisible();

    await request.delete(`/api/bookings/${stay2.id}`);
    await request.delete(`/api/bookings/${stay1.id}`);
    await request.delete(`/api/promotions/${promo.id}`);
  });

  test("shows no upcoming tiers section when on the last tier", async ({
    page,
    request,
    testHotelChain,
  }) => {
    const promoRes = await request.post("/api/promotions", {
      data: {
        name: "LastTierPromo",
        type: "loyalty",
        hotelChainId: testHotelChain.id,
        benefits: [],
        tiers: tierDefs,
      },
    });
    expect(promoRes.ok()).toBeTruthy();
    const promo = await promoRes.json();

    // Stay #1: pre-qualifying
    const stay1Res = await request.post("/api/bookings", {
      data: {
        hotelChainId: testHotelChain.id,
        propertyName: "Last Tier Stay 1",
        checkIn: `${YEAR}-01-01`,
        checkOut: `${YEAR}-01-03`,
        numNights: 2,
        pretaxCost: 200,
        taxAmount: 30,
        totalCost: 230,
        currency: "USD",
      },
    });
    const stay1 = await stay1Res.json();

    // Stay #2: earns tier 1
    const stay2Res = await request.post("/api/bookings", {
      data: {
        hotelChainId: testHotelChain.id,
        propertyName: "Last Tier Stay 2",
        checkIn: `${YEAR}-02-01`,
        checkOut: `${YEAR}-02-03`,
        numNights: 2,
        pretaxCost: 200,
        taxAmount: 30,
        totalCost: 230,
        currency: "USD",
      },
    });
    const stay2 = await stay2Res.json();

    // Stay #3 (current): earns tier 2 (stay 3+), the last tier — no upcoming
    const stay3Res = await request.post("/api/bookings", {
      data: {
        hotelChainId: testHotelChain.id,
        propertyName: "Last Tier Stay 3",
        checkIn: `${YEAR}-06-01`,
        checkOut: `${YEAR}-06-03`,
        numNights: 2,
        pretaxCost: 200,
        taxAmount: 30,
        totalCost: 230,
        currency: "USD",
      },
    });
    const stay3 = await stay3Res.json();

    await page.goto(`/bookings/${stay3.id}`);
    await page.getByTestId("breakdown-promos-toggle").click();
    await expect(page.getByTestId(`breakdown-promo-item-${promo.id}`)).toBeVisible();

    await page.getByTestId("calc-info-lasttierpromo").click();
    const popover = page.locator("[role='dialog'], .popover-content");
    await expect(popover).toBeVisible();

    // On the last tier — no upcoming section
    await expect(popover.getByText(/Upcoming Tiers/i)).not.toBeVisible();

    // But still shows the current earning
    await expect(popover.getByText(/7,500 Bonus Points/i)).toBeVisible();

    await request.delete(`/api/bookings/${stay3.id}`);
    await request.delete(`/api/bookings/${stay2.id}`);
    await request.delete(`/api/bookings/${stay1.id}`);
    await request.delete(`/api/promotions/${promo.id}`);
  });
});
