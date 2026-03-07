import { test, expect } from "./fixtures";

test.describe("Pre-qualifying Promotion Details", () => {
  test("should show prerequisite stays and tiers in the breakdown popover", async ({
    page,
    request,
    testHotelChain,
  }) => {
    // 1. Create a tiered promotion with a prerequisite stay
    const promoName = "PreQualTestPromo";
    const promoRes = await request.post("/api/promotions", {
      data: {
        name: promoName,
        type: "loyalty",
        hotelChainId: testHotelChain.id,
        benefits: [],
        restrictions: {
          prerequisiteStayCount: 1,
        },
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

    // 2. Create the first stay (the prerequisite)
    // We need at least one future stay to make it pre-qualifying instead of orphaned
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
        propertyName: "Current Stay (Prereq)",
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

    // 3. Navigate to the booking detail page
    await page.goto(`/bookings/${currentBooking.id}`);

    // 4. Open the promotions breakdown in Cost Breakdown
    await page.getByTestId("breakdown-promos-toggle").click();

    // Verify pre-qualifying badge
    const promoItem = page.getByTestId(`breakdown-promo-item-${promo.id}`);
    await expect(promoItem).toBeVisible();

    // 5. Open the info popover for this promotion
    const infoButton = page.getByTestId("calc-info-prequaltestpromo-desktop");
    await expect(infoButton).toBeVisible();
    await infoButton.click();

    // 6. Verify popover content
    const popover = page.locator("[role='dialog'], .popover-content");
    await expect(popover).toBeVisible();

    await expect(popover.getByText(/Prerequisite Stays/i)).toBeVisible();
    await expect(popover.getByText(/1 stay needed/i)).toBeVisible();
    await expect(popover.getByText(/this booking counts/i)).toBeVisible();
    await expect(popover.getByText(/Promotion Tiers/i)).toBeVisible();
    await expect(popover.getByText(/Tier 1: Stay 2/i)).toBeVisible();
    await expect(popover.getByText(/5,000 pts/i)).toBeVisible();
    await expect(popover.getByText(/Tier 2: Stay 3\+/i)).toBeVisible();
    await expect(popover.getByText(/7,500 pts/i)).toBeVisible();

    // Cleanup
    await request.delete(`/api/bookings/${currentBooking.id}`);
    await request.delete(`/api/bookings/${futureBooking.id}`);
    await request.delete(`/api/promotions/${promo.id}`);
  });
});
