import { test, expect } from "./fixtures";

test.describe("Benefit Valuations", () => {
  test("user can configure chain-specific valuations and see updated net costs", async ({
    page,
    testHotelChain,
    request,
  }) => {
    // 1. Go to Settings
    await page.goto("/settings");
    await page.getByTestId("tab-trigger-valuations").click();

    // 2. Select the unique test chain
    await page.getByRole("combobox").click();
    await page.getByRole("option", { name: testHotelChain.name }).click();

    // Find the EQN input (should be empty initially for a new chain)
    const eqnInput = page.locator("#eqn");

    // 3. Update the chain-specific EQN value to $25.00
    await eqnInput.clear();
    await eqnInput.fill("25");
    await page.getByTestId("save-valuations").click();

    // Wait for the success alert
    page.once("dialog", (dialog) => dialog.accept());

    // 4. Create a booking for this chain
    const bookingRes = await request.post("/api/bookings", {
      data: {
        hotelChainId: testHotelChain.id,
        propertyName: "Valuation Test Property",
        checkIn: "2025-01-10",
        checkOut: "2025-01-15",
        numNights: 5,
        pretaxCost: 400,
        taxAmount: 80,
        totalCost: 480,
        currency: "USD",
        bookingSource: "direct_web",
      },
    });
    const booking = await bookingRes.json();

    // 5. Add a promotion with EQNs to this booking
    const promoRes = await request.post("/api/promotions", {
      data: {
        name: "E2E EQN Promo",
        type: "loyalty",
        hotelChainId: testHotelChain.id,
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

    // Trigger re-evaluation
    await request.put(`/api/bookings/${booking.id}`, {
      data: { ...booking, pretaxCost: booking.pretaxCost },
    });

    // 6. Verify updated net cost on Detail Page
    await page.goto(`/bookings/${booking.id}`);

    // Calculation:
    // 2 EQNs * $25.00 valuation = $50.00 savings.
    const promoSavings = page.getByTestId("breakdown-promo-savings");
    await expect(promoSavings).toBeVisible();
    // It should be -$50.00 in the UI
    await expect(promoSavings).toContainText("$50.00");

    // 7. Cleanup
    await request.delete(`/api/promotions/${promo.id}`);
    await request.delete(`/api/bookings/${booking.id}`);
  });
});
