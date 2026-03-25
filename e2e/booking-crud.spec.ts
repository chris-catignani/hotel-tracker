import crypto from "crypto";
import { test, expect } from "./fixtures";
import { HOTEL_ID } from "@/lib/constants";

const YEAR = new Date().getFullYear();

test.describe("Booking List", () => {
  test("shows booking row with property name, hotel chain, and net/night", async ({
    testBooking,
  }) => {
    await testBooking.page.goto("/bookings");

    const row = testBooking.page.getByTestId(`booking-row-${testBooking.id}`);
    await expect(row).toBeVisible();
    await expect(row).toContainText(testBooking.propertyName);
    await expect(row).toContainText(testBooking.hotelChainName);
    // Net/night cell is always present (even for a basic cash booking)
    await expect(row.getByTestId("booking-net-per-night")).toBeVisible();
  });

  test("delete button removes the booking from the list", async ({
    isolatedUser,
    adminRequest,
  }) => {
    // Create booking manually (not via fixture) so cleanup doesn't conflict with the UI delete
    const chains = await adminRequest.get("/api/hotel-chains");
    const chain = (await chains.json())[0];

    const propertyName = `Delete Test ${crypto.randomUUID()}`;
    const res = await isolatedUser.request.post("/api/bookings", {
      data: {
        hotelChainId: chain.id,
        propertyName,
        checkIn: `${YEAR}-08-01`,
        checkOut: `${YEAR}-08-03`,
        numNights: 2,
        pretaxCost: 200,
        taxAmount: 20,
        totalCost: 220,
        currency: "USD",
      },
    });
    const booking = await res.json();

    await isolatedUser.page.goto("/bookings");
    const row = isolatedUser.page.getByTestId(`booking-row-${booking.id}`);
    await expect(row).toBeVisible();

    await row.getByRole("button", { name: "Delete" }).click();
    // Confirm in the dialog
    await isolatedUser.page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();

    await expect(row).not.toBeVisible();
  });
});

test.describe("Booking Detail", () => {
  test("displays property name, hotel chain, total cost, and booking source", async ({
    testBooking,
  }) => {
    await testBooking.page.goto(`/bookings/${testBooking.id}`);

    await expect(testBooking.page.getByRole("heading", { name: "Booking Details" })).toBeVisible();
    // Property name appears in the card title
    await expect(testBooking.page.getByText(testBooking.propertyName)).toBeVisible();
    // Hotel chain name appears in the info grid (exact match to avoid partial matches against loyalty program names)
    await expect(
      testBooking.page.getByText(testBooking.hotelChainName, { exact: true })
    ).toBeVisible();
    // Total cost: fixture creates $480 USD
    await expect(testBooking.page.getByTestId("total-cost-usd")).toHaveText("$480.00");
    // Booking source: fixture uses direct_web
    await expect(testBooking.page.getByText("Direct — Hotel Chain Website")).toBeVisible();
  });

  test("Edit button links to the edit page", async ({ testBooking }) => {
    await testBooking.page.goto(`/bookings/${testBooking.id}`);
    await testBooking.page.getByRole("link", { name: "Edit" }).click();
    await expect(testBooking.page).toHaveURL(`/bookings/${testBooking.id}/edit`);
  });

  test("Back button returns to the bookings list", async ({ testBooking }) => {
    await testBooking.page.goto(`/bookings/${testBooking.id}`);
    await testBooking.page.getByRole("link", { name: "Back" }).click();
    await expect(testBooking.page).toHaveURL("/bookings");
  });
});

test.describe("Booking Edit", () => {
  test("pre-populates the form with existing booking data", async ({ testBooking }) => {
    await testBooking.page.goto(`/bookings/${testBooking.id}/edit`);

    await expect(testBooking.page.getByRole("heading", { name: "Edit Booking" })).toBeVisible();
    // Property name shows in the confirmed state (a div, not an input)
    await expect(testBooking.page.getByTestId("property-name-input-confirmed")).toContainText(
      testBooking.propertyName
    );
    // Save Changes button should be present
    await expect(testBooking.page.getByTestId("booking-form-submit")).toHaveText("Save Changes");
  });

  test("saves changes and redirects to the detail page", async ({ testBooking }) => {
    await testBooking.page.goto(`/bookings/${testBooking.id}/edit`);

    // Wait for the form to be fully populated from initialData before typing.
    // The property name shows in the confirmed state (a div, not an input).
    await expect(testBooking.page.getByTestId("property-name-input-confirmed")).toContainText(
      testBooking.propertyName
    );

    // Update the notes field (simple textarea, no date picker involved)
    const uniqueNote = `E2E note ${crypto.randomUUID()}`;
    await testBooking.page.getByLabel("Notes").fill(uniqueNote);

    await testBooking.page.getByTestId("booking-form-submit").click();

    // Should redirect to the detail page
    await expect(testBooking.page).toHaveURL(`/bookings/${testBooking.id}`);
    // Updated notes should be visible
    await expect(testBooking.page.getByText(uniqueNote)).toBeVisible();
  });

  test("Cancel navigates back to the detail page without saving", async ({ testBooking }) => {
    await testBooking.page.goto(`/bookings/${testBooking.id}/edit`);

    await testBooking.page.getByLabel("Notes").fill("should not be saved");
    await testBooking.page.getByTestId("booking-form-cancel").click();

    await expect(testBooking.page).toHaveURL(`/bookings/${testBooking.id}`);
    await expect(testBooking.page.getByText("should not be saved")).not.toBeVisible();
  });
});

test.describe("Booking Detail - Cost Breakdown Varieties", () => {
  // Hyatt: 2¢ per point (usdCentsPerPoint = 0.02)

  test("award stay shows points redeemed value and correct net cost", async ({ isolatedUser }) => {
    const { request, page } = isolatedUser;

    // 30,000 pts × $0.02 = $600.00 points value; netCost = $0 + $600 = $600.00
    const res = await request.post("/api/bookings", {
      data: {
        hotelChainId: HOTEL_ID.HYATT,
        propertyName: `Award Stay ${crypto.randomUUID()}`,
        checkIn: "2025-06-01",
        checkOut: "2025-06-03",
        numNights: 2,
        pretaxCost: 0,
        taxAmount: 0,
        totalCost: 0,
        pointsRedeemed: 30000,
        loyaltyPointsEarned: 0,
        currency: "USD",
      },
    });
    const booking = await res.json();

    try {
      await page.goto(`/bookings/${booking.id}`);

      await expect(page.getByTestId("breakdown-cash-cost")).toHaveText("$0.00");
      await expect(page.getByTestId("breakdown-points-value")).toHaveText("+$600.00");
      await expect(page.getByTestId("breakdown-net-cost")).toHaveText("$600.00");
    } finally {
      await request.delete(`/api/bookings/${booking.id}`);
    }
  });

  test("cert stay shows certificate value and correct net cost", async ({ isolatedUser }) => {
    const { request, page } = isolatedUser;

    // hyatt_cat1_4 = 15,000 pts × $0.02 = $300.00 cert value; netCost = $0 + $300 = $300.00
    const res = await request.post("/api/bookings", {
      data: {
        hotelChainId: HOTEL_ID.HYATT,
        propertyName: `Cert Stay ${crypto.randomUUID()}`,
        checkIn: "2025-07-01",
        checkOut: "2025-07-02",
        numNights: 1,
        pretaxCost: 0,
        taxAmount: 0,
        totalCost: 0,
        certificates: ["hyatt_cat1_4"],
        loyaltyPointsEarned: 0,
        currency: "USD",
      },
    });
    const booking = await res.json();

    try {
      await page.goto(`/bookings/${booking.id}`);

      await expect(page.getByTestId("breakdown-cash-cost")).toHaveText("$0.00");
      await expect(page.getByTestId("breakdown-certs-value")).toHaveText("+$300.00");
      await expect(page.getByTestId("breakdown-net-cost")).toHaveText("$300.00");
    } finally {
      await request.delete(`/api/bookings/${booking.id}`);
    }
  });

  test("points + cash combo shows both cash cost and points value", async ({ isolatedUser }) => {
    const { request, page } = isolatedUser;

    // totalCost = $200 cash + 10,000 pts × $0.02 = $200 points value
    // netCost = $200 + $200 = $400.00
    const res = await request.post("/api/bookings", {
      data: {
        hotelChainId: HOTEL_ID.HYATT,
        propertyName: `Points Cash Combo ${crypto.randomUUID()}`,
        checkIn: "2025-08-01",
        checkOut: "2025-08-03",
        numNights: 2,
        pretaxCost: 160,
        taxAmount: 40,
        totalCost: 200,
        pointsRedeemed: 10000,
        loyaltyPointsEarned: 0,
        currency: "USD",
      },
    });
    const booking = await res.json();

    try {
      await page.goto(`/bookings/${booking.id}`);

      await expect(page.getByTestId("breakdown-cash-cost")).toHaveText("$200.00");
      await expect(page.getByTestId("breakdown-points-value")).toHaveText("+$200.00");
      await expect(page.getByTestId("breakdown-net-cost")).toHaveText("$400.00");
    } finally {
      await request.delete(`/api/bookings/${booking.id}`);
    }
  });
});

test.describe("Booking Create Form", () => {
  test("shows validation errors when submitted empty", async ({ isolatedUser }) => {
    await isolatedUser.page.goto("/bookings/new");
    await expect(isolatedUser.page.getByRole("heading", { name: "New Booking" })).toBeVisible();

    await isolatedUser.page.getByTestId("booking-form-submit").click();

    await expect(isolatedUser.page.getByText("Hotel chain is required")).toBeVisible();
    await expect(isolatedUser.page.getByText("Property name is required")).toBeVisible();
    await expect(isolatedUser.page.getByText("Check-in date is required")).toBeVisible();
    await expect(isolatedUser.page.getByText("Check-out date is required")).toBeVisible();
  });
});
