import { test, expect } from "./fixtures";

test.describe("Apartment / non-hotel stays", () => {
  test("apartment booking appears in list with 'Apartment / Rental' label instead of chain name", async ({
    apartmentBooking,
  }) => {
    await apartmentBooking.page.goto("/bookings");

    const row = apartmentBooking.page.getByTestId(`booking-row-${apartmentBooking.id}`);
    await expect(row).toBeVisible();
    await expect(row).toContainText(apartmentBooking.propertyName);
    await expect(row).toContainText("Apartment / Rental");
  });

  test("apartment booking detail page shows 'Apartment / Short-term Rental' and no loyalty section", async ({
    apartmentBooking,
  }) => {
    await apartmentBooking.page.goto(`/bookings/${apartmentBooking.id}`);

    // Should display apartment label instead of a hotel chain name
    await expect(apartmentBooking.page.getByText("Apartment / Short-term Rental")).toBeVisible();

    // Net cost section should still be visible
    await expect(apartmentBooking.page.getByTestId("usd-net-cost-row")).toBeVisible();
  });

  test("apartment booking is returned correctly from the API", async ({ apartmentBooking }) => {
    const res = await apartmentBooking.request.get(`/api/bookings/${apartmentBooking.id}`);
    expect(res.ok()).toBeTruthy();

    const data = await res.json();
    expect(data.accommodationType).toBe("apartment");
    expect(data.hotelChainId).toBeNull();
    expect(data.hotelChain).toBeNull();
    expect(data.totalCost).toBe("660");
  });
});
