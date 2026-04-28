import { test, expect } from "./fixtures";
import crypto from "crypto";

const YEAR = new Date().getFullYear();

test.describe("Other / independent hotel chain", () => {
  test("booking list shows 'Other' in chain column for null-chain hotel booking", async ({
    isolatedUser,
  }) => {
    const name = `Other Hotel ${crypto.randomUUID()}`;
    const res = await isolatedUser.request.post("/api/bookings", {
      data: {
        accommodationType: "hotel",
        hotelChainId: null,
        propertyName: name,
        checkIn: `${YEAR}-09-10`,
        checkOut: `${YEAR}-09-13`,
        numNights: 3,
        pretaxCost: 300,
        taxAmount: 30,
        totalCost: 330,
        currency: "USD",
        countryCode: "US",
        city: "Chicago",
      },
    });
    expect(res.ok()).toBeTruthy();
    const booking = await res.json();

    try {
      await isolatedUser.page.goto("/bookings");
      const row = isolatedUser.page.getByTestId(`booking-row-${booking.id}`);
      await expect(row).toBeVisible();
      await expect(isolatedUser.page.getByTestId(`chain-cell-${booking.id}`)).toHaveText("Other");
    } finally {
      await isolatedUser.request.delete(`/api/bookings/${booking.id}`);
    }
  });

  test("booking detail page does not show Price Watch for null-chain hotel booking", async ({
    isolatedUser,
  }) => {
    const name = `Other Hotel ${crypto.randomUUID()}`;
    const res = await isolatedUser.request.post("/api/bookings", {
      data: {
        accommodationType: "hotel",
        hotelChainId: null,
        propertyName: name,
        checkIn: `${YEAR}-10-01`,
        checkOut: `${YEAR}-10-04`,
        numNights: 3,
        pretaxCost: 250,
        taxAmount: 25,
        totalCost: 275,
        currency: "USD",
        countryCode: "US",
        city: "Austin",
      },
    });
    expect(res.ok()).toBeTruthy();
    const booking = await res.json();

    try {
      await isolatedUser.page.goto(`/bookings/${booking.id}`);

      // Wait for the page to finish loading by checking for a stable landmark
      await expect(isolatedUser.page.getByTestId("hero-net-cost")).toBeVisible();

      // Price Watch toggle must not be rendered (it only appears for known-chain hotels)
      await expect(isolatedUser.page.getByTestId("price-watch-toggle")).not.toBeVisible();
    } finally {
      await isolatedUser.request.delete(`/api/bookings/${booking.id}`);
    }
  });

  test("booking edit page does not show Price Watch for null-chain hotel booking", async ({
    isolatedUser,
  }) => {
    const name = `Other Hotel ${crypto.randomUUID()}`;
    const res = await isolatedUser.request.post("/api/bookings", {
      data: {
        accommodationType: "hotel",
        hotelChainId: null,
        propertyName: name,
        checkIn: `${YEAR}-11-01`,
        checkOut: `${YEAR}-11-04`,
        numNights: 3,
        pretaxCost: 250,
        taxAmount: 25,
        totalCost: 275,
        currency: "USD",
        countryCode: "US",
        city: "Austin",
      },
    });
    expect(res.ok()).toBeTruthy();
    const booking = await res.json();

    try {
      await isolatedUser.page.goto(`/bookings/${booking.id}/edit`);

      // Wait for form to load
      await expect(isolatedUser.page.getByRole("heading", { name: "Edit Booking" })).toBeVisible();

      // Price Watch toggle must not be rendered
      await expect(isolatedUser.page.getByTestId("price-watch-toggle")).not.toBeVisible();
    } finally {
      await isolatedUser.request.delete(`/api/bookings/${booking.id}`);
    }
  });

  test("booking form includes 'Other' option in chain dropdown", async ({ isolatedUser }) => {
    await isolatedUser.page.goto("/bookings/new");

    // Open the hotel chain selector
    await isolatedUser.page.getByTestId("hotel-chain-select").click();

    // "Other" must appear as an option
    await expect(isolatedUser.page.getByRole("option", { name: "Other" })).toBeVisible();
  });
});
