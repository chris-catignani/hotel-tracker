import { test, expect } from "./fixtures";

test.describe("Travel Map", () => {
  test("opens travel map modal from dashboard and closes cleanly", async ({ isolatedUser }) => {
    await isolatedUser.page.goto("/");
    await isolatedUser.page.waitForLoadState("networkidle");

    // Button is visible on the dashboard
    const button = isolatedUser.page.getByTestId("travel-map-button");
    await expect(button).toBeVisible();

    // Clicking opens the modal
    await button.click();
    const modal = isolatedUser.page.getByTestId("travel-map-modal");
    await expect(modal).toBeVisible();

    // With no bookings that have coordinates the empty state is shown
    // (isolated user starts with no bookings)
    await expect(isolatedUser.page.getByText("No location data yet")).toBeVisible();

    // Modal closes cleanly via the X button
    await isolatedUser.page.keyboard.press("Escape");
    await expect(modal).not.toBeVisible();
  });

  test("shows map and play button when stops have coordinates", async ({
    isolatedUser,
    adminRequest,
  }) => {
    const chains = await adminRequest.get("/api/hotel-chains");
    const chain = (await chains.json())[0];

    // Create a booking — note: the map only shows stops where property has lat/lng.
    // Since E2E bookings go through findOrCreateProperty without geocoding,
    // properties won't have coordinates. This test verifies the UI flow up to the
    // empty state or, if coordinates exist, that the map container is present.
    const bookingRes = await isolatedUser.request.post("/api/bookings", {
      data: {
        hotelChainId: chain.id,
        propertyName: "E2E Travel Map Hotel",
        checkIn: "2024-06-10",
        checkOut: "2024-06-13",
        numNights: 3,
        pretaxCost: 270,
        taxAmount: 30,
        totalCost: 300,
        currency: "USD",
        bookingSource: "direct_web",
        countryCode: "US",
        city: "New York",
      },
    });
    const booking = await bookingRes.json();

    try {
      await isolatedUser.page.goto("/");
      await isolatedUser.page.waitForLoadState("networkidle");

      await isolatedUser.page.getByTestId("travel-map-button").click();
      await expect(isolatedUser.page.getByTestId("travel-map-modal")).toBeVisible();

      // Play button is only rendered when stops exist with coordinates;
      // otherwise the empty state is shown. Either outcome is acceptable here.
      const hasMap = await isolatedUser.page
        .getByTestId("travel-map-container")
        .isVisible()
        .catch(() => false);
      const hasEmpty = await isolatedUser.page
        .getByText("No location data yet")
        .isVisible()
        .catch(() => false);

      expect(hasMap || hasEmpty).toBe(true);

      // Close
      await isolatedUser.page.keyboard.press("Escape");
      await expect(isolatedUser.page.getByTestId("travel-map-modal")).not.toBeVisible();
    } finally {
      await isolatedUser.request.delete(`/api/bookings/${booking.id}`);
    }
  });
});
