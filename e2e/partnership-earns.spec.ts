import crypto from "crypto";
import { test, expect } from "./fixtures";
import { HOTEL_ID } from "../src/lib/constants";

const PARTNERSHIP_EARN_ID = "cpartnership0accorqantas1";
const PARTNERSHIP_TESTID = `partnership-checkbox-${PARTNERSHIP_EARN_ID}`;
const EARN_LINE_TESTID = "breakdown-partnership-accor–qantas";

test.describe("Partnership Earns", () => {
  /**
   * Each test uses an isolated user so toggling the partnership doesn't
   * affect other parallel test workers or the shared admin user.
   */

  test("Accor–Qantas line item appears for Accor APAC booking when enabled", async ({
    isolatedUser,
  }) => {
    const { page, request } = isolatedUser;

    // Create an Accor booking with an APAC country code (AU), past date for real exchange rate
    const propertyName = `Accor APAC Test ${crypto.randomUUID()}`;
    const bookingRes = await request.post("/api/bookings", {
      data: {
        hotelChainId: HOTEL_ID.ACCOR,
        propertyName,
        checkIn: "2025-01-10",
        checkOut: "2025-01-13",
        numNights: 3,
        pretaxCost: 300,
        taxAmount: 30,
        totalCost: 330,
        currency: "AUD",
        bookingSource: "direct_web",
        countryCode: "AU",
        city: "Sydney",
      },
    });
    expect(bookingRes.ok()).toBeTruthy();
    const booking = await bookingRes.json();

    try {
      // Enable the Accor–Qantas partnership in Settings
      await page.goto("/settings");
      await page.waitForLoadState("networkidle");
      const checkbox = page.getByTestId(PARTNERSHIP_TESTID);
      await expect(checkbox).toBeVisible();
      if (!(await checkbox.isChecked())) {
        await checkbox.click();
        await expect(checkbox).toBeChecked();
      }

      // Navigate to the booking detail page
      await page.goto(`/bookings/${booking.id}`);
      await page.waitForLoadState("networkidle");

      // The partnership earn line item should appear
      await expect(page.getByTestId(EARN_LINE_TESTID)).toBeVisible();
    } finally {
      await request.delete(`/api/bookings/${booking.id}`);
    }
  });

  test("Accor–Qantas line item does not appear for non-APAC Accor booking", async ({
    isolatedUser,
  }) => {
    const { page, request } = isolatedUser;

    // Create an Accor booking with a non-APAC country code (US)
    const propertyName = `Accor Non-APAC Test ${crypto.randomUUID()}`;
    const bookingRes = await request.post("/api/bookings", {
      data: {
        hotelChainId: HOTEL_ID.ACCOR,
        propertyName,
        checkIn: "2025-01-10",
        checkOut: "2025-01-13",
        numNights: 3,
        pretaxCost: 300,
        taxAmount: 30,
        totalCost: 330,
        currency: "USD",
        bookingSource: "direct_web",
        countryCode: "US",
        city: "New York",
      },
    });
    expect(bookingRes.ok()).toBeTruthy();
    const booking = await bookingRes.json();

    try {
      // Enable the Accor–Qantas partnership in Settings
      await page.goto("/settings");
      await page.waitForLoadState("networkidle");
      const checkbox = page.getByTestId(PARTNERSHIP_TESTID);
      await expect(checkbox).toBeVisible();
      if (!(await checkbox.isChecked())) {
        await checkbox.click();
        await expect(checkbox).toBeChecked();
      }

      // Navigate to the booking detail page
      await page.goto(`/bookings/${booking.id}`);
      await page.waitForLoadState("networkidle");

      // No partnership earn line item for US property
      await expect(page.getByTestId(EARN_LINE_TESTID)).not.toBeAttached();
    } finally {
      await request.delete(`/api/bookings/${booking.id}`);
    }
  });

  test("Accor–Qantas line item disappears after toggling off", async ({ isolatedUser }) => {
    const { page, request } = isolatedUser;

    const propertyName = `Accor APAC Toggle Test ${crypto.randomUUID()}`;
    const bookingRes = await request.post("/api/bookings", {
      data: {
        hotelChainId: HOTEL_ID.ACCOR,
        propertyName,
        checkIn: "2025-01-10",
        checkOut: "2025-01-13",
        numNights: 3,
        pretaxCost: 300,
        taxAmount: 30,
        totalCost: 330,
        currency: "AUD",
        bookingSource: "direct_web",
        countryCode: "AU",
        city: "Sydney",
      },
    });
    expect(bookingRes.ok()).toBeTruthy();
    const booking = await bookingRes.json();

    try {
      // Enable partnership
      await page.goto("/settings");
      await page.waitForLoadState("networkidle");
      const checkbox = page.getByTestId(PARTNERSHIP_TESTID);
      await expect(checkbox).toBeVisible();
      if (!(await checkbox.isChecked())) {
        await checkbox.click();
        await expect(checkbox).toBeChecked();
      }

      // Verify it shows on booking detail
      await page.goto(`/bookings/${booking.id}`);
      await page.waitForLoadState("networkidle");
      await expect(page.getByTestId(EARN_LINE_TESTID)).toBeVisible();

      // Disable partnership
      await page.goto("/settings");
      await page.waitForLoadState("networkidle");
      const checkbox2 = page.getByTestId(PARTNERSHIP_TESTID);
      await expect(checkbox2).toBeChecked();
      await checkbox2.click();
      await expect(checkbox2).not.toBeChecked();

      // Verify it no longer shows on booking detail
      await page.goto(`/bookings/${booking.id}`);
      await page.waitForLoadState("networkidle");
      await expect(page.getByTestId(EARN_LINE_TESTID)).not.toBeAttached();
    } finally {
      await request.delete(`/api/bookings/${booking.id}`);
    }
  });
});
