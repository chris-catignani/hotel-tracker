// e2e/year-filter.spec.ts
import { test, expect } from "./fixtures";

const CURRENT_YEAR = new Date().getFullYear();
const PAST_YEAR = CURRENT_YEAR - 1;

test.describe("Year filter — Dashboard", () => {
  test("year selector is visible and defaults to current year", async ({
    twoYearBookings: ctx,
  }) => {
    await ctx.page.goto("/");
    const trigger = ctx.page.getByTestId("year-filter-select");
    await expect(trigger).toBeVisible();
    await expect(trigger).toContainText(String(CURRENT_YEAR));
  });

  test("selecting past year changes the displayed year in the selector", async ({
    twoYearBookings: ctx,
  }) => {
    await ctx.page.goto("/");

    await ctx.page.getByTestId("year-filter-select").click();
    await ctx.page.getByRole("option", { name: String(PAST_YEAR) }).click();

    await expect(ctx.page.getByTestId("year-filter-select")).toContainText(String(PAST_YEAR));
    // Accommodation summary table is still rendered (no crash)
    await expect(ctx.page.getByTestId("hotel-chain-summary-desktop")).toBeVisible();
  });

  test("Upcoming option: today's checkout booking is shown (>= boundary)", async ({
    isolatedUser,
    adminRequest,
  }) => {
    // Create a booking checking out TODAY
    const chains = await adminRequest.get("/api/hotel-chains");
    const chain = (await chains.json())[0];
    const today = new Date().toISOString().slice(0, 10);
    const nights = 1;
    const checkIn = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    const propertyName = `Today Checkout Test ${Math.random()}`;
    const res = await isolatedUser.request.post("/api/bookings", {
      data: {
        hotelChainId: chain.id,
        propertyName,
        checkIn,
        checkOut: today,
        numNights: nights,
        pretaxCost: 100,
        taxAmount: 10,
        totalCost: 110,
        currency: "USD",
        bookingSource: "direct_web",
        countryCode: "US",
        city: "Boston",
      },
    });
    const booking = await res.json();

    try {
      await isolatedUser.page.goto("/");

      // Select Upcoming
      await isolatedUser.page.getByTestId("year-filter-select").click();
      await isolatedUser.page.getByRole("option", { name: `${CURRENT_YEAR} — Upcoming` }).click();

      // The today-checkout booking should appear in the Upcoming Bookings card
      const bookingRow = isolatedUser.page.getByTestId(`booking-row-${booking.id}`);
      await expect(bookingRow).toBeVisible();
    } finally {
      await isolatedUser.request.delete(`/api/bookings/${booking.id}`);
    }
  });

  test("year filter and accommodation filter work simultaneously", async ({
    twoYearBookings: ctx,
  }) => {
    await ctx.page.goto("/");

    // Select past year
    await ctx.page.getByTestId("year-filter-select").click();
    await ctx.page.getByRole("option", { name: String(PAST_YEAR) }).click();

    // If accommodation filter is visible, click Hotels — page should not crash
    const hotelsBtn = ctx.page.getByTestId("dashboard-filter-hotel");
    if (await hotelsBtn.isVisible()) {
      await hotelsBtn.click();
      await expect(ctx.page.getByTestId("hotel-chain-summary-desktop")).toBeVisible();
    }

    // Selector still shows past year
    await expect(ctx.page.getByTestId("year-filter-select")).toContainText(String(PAST_YEAR));
  });
});

test.describe("Year filter — Bookings", () => {
  test("year selector is visible on Bookings page", async ({ twoYearBookings: ctx }) => {
    await ctx.page.goto("/bookings");
    await expect(ctx.page.getByTestId("year-filter-select")).toBeVisible();
  });

  test("selecting past year shows past-year booking in list", async ({ twoYearBookings: ctx }) => {
    await ctx.page.goto("/bookings");

    await ctx.page.getByTestId("year-filter-select").click();
    await ctx.page.getByRole("option", { name: String(PAST_YEAR) }).click();

    await expect(ctx.page.getByTestId(`booking-row-${ctx.pastYearBookingId}`)).toBeVisible();
  });

  test("selecting current year hides past-year booking", async ({ twoYearBookings: ctx }) => {
    await ctx.page.goto("/bookings");

    // Explicitly select current year (it should be the default, but set it explicitly)
    await ctx.page.getByTestId("year-filter-select").click();
    await ctx.page.getByRole("option", { name: String(CURRENT_YEAR), exact: true }).click();

    await expect(ctx.page.getByTestId(`booking-row-${ctx.pastYearBookingId}`)).not.toBeAttached();
  });
});

test.describe("Year filter — Persistence", () => {
  test("year selection persists when navigating from Dashboard to Bookings via sidebar", async ({
    twoYearBookings: ctx,
  }) => {
    await ctx.page.goto("/");

    // Set past year on Dashboard
    await ctx.page.getByTestId("year-filter-select").click();
    await ctx.page.getByRole("option", { name: String(PAST_YEAR) }).click();
    await expect(ctx.page.getByTestId("year-filter-select")).toContainText(String(PAST_YEAR));

    // Navigate to Bookings via sidebar link (no page reload)
    await ctx.page.getByRole("link", { name: "Bookings" }).first().click();
    await ctx.page.waitForURL("/bookings");

    // Year filter should still be past year
    await expect(ctx.page.getByTestId("year-filter-select")).toContainText(String(PAST_YEAR));
  });
});
