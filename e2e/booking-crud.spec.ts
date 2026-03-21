import crypto from "crypto";
import { test, expect } from "./fixtures";

test.describe("Booking List", () => {
  test("shows booking row with property name, hotel chain, and net/night", async ({
    page,
    testBooking,
  }) => {
    await page.goto("/bookings");

    const row = page.getByTestId(`booking-row-${testBooking.id}`);
    await expect(row).toBeVisible();
    await expect(row).toContainText(testBooking.propertyName);
    await expect(row).toContainText(testBooking.hotelChainName);
    // Net/night cell is always present (even for a basic cash booking)
    await expect(row.getByTestId("booking-net-per-night")).toBeVisible();
  });

  test("delete button removes the booking from the list", async ({ page, request }) => {
    // Create booking manually (not via fixture) so cleanup doesn't conflict with the UI delete
    const chains = await request.get("/api/hotel-chains");
    const chain = (await chains.json())[0];

    const propertyName = `Delete Test ${crypto.randomUUID()}`;
    const res = await request.post("/api/bookings", {
      data: {
        hotelChainId: chain.id,
        propertyName,
        checkIn: "2026-08-01",
        checkOut: "2026-08-03",
        numNights: 2,
        pretaxCost: 200,
        taxAmount: 20,
        totalCost: 220,
        currency: "USD",
      },
    });
    const booking = await res.json();

    await page.goto("/bookings");
    const row = page.getByTestId(`booking-row-${booking.id}`);
    await expect(row).toBeVisible();

    await row.getByRole("button", { name: "Delete" }).click();
    // Confirm in the dialog
    await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();

    await expect(row).not.toBeVisible();
  });
});

test.describe("Booking Detail", () => {
  test("displays property name, hotel chain, total cost, and booking source", async ({
    page,
    testBooking,
  }) => {
    await page.goto(`/bookings/${testBooking.id}`);

    await expect(page.getByRole("heading", { name: "Booking Details" })).toBeVisible();
    // Property name appears in the card title
    await expect(page.getByText(testBooking.propertyName)).toBeVisible();
    // Hotel chain name appears in the info grid (exact match to avoid partial matches against loyalty program names)
    await expect(page.getByText(testBooking.hotelChainName, { exact: true })).toBeVisible();
    // Total cost: fixture creates $480 USD
    await expect(page.getByTestId("total-cost-usd")).toHaveText("$480.00");
    // Booking source: fixture uses direct_web
    await expect(page.getByText("Direct — Hotel Chain Website")).toBeVisible();
  });

  test("Edit button links to the edit page", async ({ page, testBooking }) => {
    await page.goto(`/bookings/${testBooking.id}`);
    await page.getByRole("link", { name: "Edit" }).click();
    await expect(page).toHaveURL(`/bookings/${testBooking.id}/edit`);
  });

  test("Back button returns to the bookings list", async ({ page, testBooking }) => {
    await page.goto(`/bookings/${testBooking.id}`);
    await page.getByRole("link", { name: "Back" }).click();
    await expect(page).toHaveURL("/bookings");
  });
});

test.describe("Booking Edit", () => {
  test("pre-populates the form with existing booking data", async ({ page, testBooking }) => {
    await page.goto(`/bookings/${testBooking.id}/edit`);

    await expect(page.getByRole("heading", { name: "Edit Booking" })).toBeVisible();
    // Property name shows in the confirmed state (a div, not an input)
    await expect(page.getByTestId("property-name-input-confirmed")).toContainText(
      testBooking.propertyName
    );
    // Save Changes button should be present
    await expect(page.getByTestId("booking-form-submit")).toHaveText("Save Changes");
  });

  test("saves changes and redirects to the detail page", async ({ page, testBooking }) => {
    await page.goto(`/bookings/${testBooking.id}/edit`);

    // Wait for the form to be fully populated from initialData before typing.
    // The property name shows in the confirmed state (a div, not an input).
    await expect(page.getByTestId("property-name-input-confirmed")).toContainText(
      testBooking.propertyName
    );

    // Update the notes field (simple textarea, no date picker involved)
    const uniqueNote = `E2E note ${crypto.randomUUID()}`;
    await page.getByLabel("Notes").fill(uniqueNote);

    await page.getByTestId("booking-form-submit").click();

    // Should redirect to the detail page
    await expect(page).toHaveURL(`/bookings/${testBooking.id}`);
    // Updated notes should be visible
    await expect(page.getByText(uniqueNote)).toBeVisible();
  });

  test("Cancel navigates back to the detail page without saving", async ({ page, testBooking }) => {
    await page.goto(`/bookings/${testBooking.id}/edit`);

    await page.getByLabel("Notes").fill("should not be saved");
    await page.getByTestId("booking-form-cancel").click();

    await expect(page).toHaveURL(`/bookings/${testBooking.id}`);
    await expect(page.getByText("should not be saved")).not.toBeVisible();
  });
});

test.describe("Booking Create Form", () => {
  test("shows validation errors when submitted empty", async ({ page }) => {
    await page.goto("/bookings/new");
    await expect(page.getByRole("heading", { name: "New Booking" })).toBeVisible();

    await page.getByTestId("booking-form-submit").click();

    await expect(page.getByText("Hotel chain is required")).toBeVisible();
    await expect(page.getByText("Property name is required")).toBeVisible();
    await expect(page.getByText("Check-in date is required")).toBeVisible();
    await expect(page.getByText("Check-out date is required")).toBeVisible();
  });
});
