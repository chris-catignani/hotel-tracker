import { test, expect } from "./fixtures";

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
        checkIn: "2026-12-01",
        checkOut: "2026-12-03",
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
        checkIn: "2026-06-01",
        checkOut: "2026-06-03",
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

    await page.getByTestId("calc-info-prequaltestpromo-desktop").click();
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
        checkIn: "2026-12-01",
        checkOut: "2026-12-03",
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
        checkIn: "2026-06-01",
        checkOut: "2026-06-03",
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

    await page.getByTestId("calc-info-tieronlytestpromo-desktop").click();
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
