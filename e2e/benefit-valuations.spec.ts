import { test, expect } from "./fixtures";

test.describe("Benefit Valuations", () => {
  test("user can configure global valuations and see updated net costs", async ({
    page,
    testBooking,
    request,
  }) => {
    // 1. Setup: Use the chain from the testBooking
    const chains = await request.get("/api/hotel-chains");
    const chain = (await chains.json()).find(
      (c: { name: string; id: string }) => c.name === testBooking.hotelChainName
    );
    const hotelChainId = chain.id;

    // 2. Go to Settings and check current EQN value
    await page.goto("/settings");
    await page.getByTestId("tab-trigger-valuations").click();

    // Find the EQN input
    const eqnInput = page.locator("#eqn");
    const initialEqnValue = await eqnInput.inputValue();

    // Ensure it matches our seed default ($10.00)
    expect(initialEqnValue).toBe("10");

    // 3. Update the global EQN value to $25.00
    await eqnInput.clear();
    await eqnInput.fill("25");
    await page.getByTestId("save-valuations").click();

    // Wait for the success alert (since we use window.alert for now)
    page.once("dialog", (dialog) => dialog.accept());

    // 4. Verify updated net cost on Dashboard
    await page.goto("/");

    // We need a booking that has bonus EQNs to see the effect.
    // The testBooking fixture creates a plain booking.
    // Let's add a promotion with EQNs to this booking.
    const promoRes = await page.request.post("/api/promotions", {
      data: {
        name: "E2E EQN Promo",
        type: "loyalty",
        hotelChainId: hotelChainId,
        isActive: true,
        benefits: [
          {
            rewardType: "eqn",
            valueType: "fixed",
            value: 2, // 2 bonus EQNs
            sortOrder: 0,
          },
        ],
      },
    });
    const promo = await promoRes.json();

    // Trigger re-evaluation by editing the booking
    await page.request.put(`/api/bookings/${testBooking.id}`, {
      data: { ...testBooking, pretaxCost: testBooking.pretaxCost },
    });

    await page.reload();

    // Calculation:
    // 2 EQNs * $25.00 valuation = $50.00 savings.
    // 5 nights booking. Savings / 5 = $10.00 per night impact.
    // Let's check the dashboard net per night cell
    const bookingRow = page.getByTestId(`booking-row-${testBooking.id}`);
    const netPerNight = bookingRow.getByTestId("booking-net-per-night");

    await expect(netPerNight).toBeVisible();

    // Now go to detail page to verify the exact breakdown
    // Click the property name link specifically
    await page.getByRole("link", { name: testBooking.propertyName }).click();

    // Wait for the breakdown to be visible
    const promoSavings = page.getByTestId("breakdown-promo-savings");
    await expect(promoSavings).toBeVisible();
    await expect(promoSavings).toContainText("$50.00");

    // 5. Cleanup: Set it back to $10.00 to avoid polluting other tests
    await page.goto("/settings");
    await page.getByTestId("tab-trigger-valuations").click();
    await page.locator("#eqn").clear();
    await page.locator("#eqn").fill("10");
    await page.getByTestId("save-valuations").click();
    page.once("dialog", (dialog) => dialog.accept());

    // Also delete the test promotion
    await page.request.delete(`/api/promotions/${promo.id}`);
  });
});
