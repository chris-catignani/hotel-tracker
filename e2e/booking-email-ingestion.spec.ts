import crypto from "crypto";
import { test, expect } from "./fixtures";

const YEAR = new Date().getFullYear();

test.describe("Email Ingestion — needs-review UI", () => {
  test("shows amber Review badge on bookings with needsReview=true", async ({ isolatedUser }) => {
    const propertyName = `Review Test Hotel ${crypto.randomUUID()}`;
    const res = await isolatedUser.request.post("/api/bookings", {
      data: {
        propertyName,
        checkIn: `${YEAR}-06-01`,
        checkOut: `${YEAR}-06-05`,
        numNights: 4,
        pretaxCost: 400,
        taxAmount: 40,
        totalCost: 440,
        currency: "USD",
        bookingSource: "direct_web",
        countryCode: "US",
        city: "Salt Lake City",
        needsReview: true,
        ingestionMethod: "email",
      },
    });
    const booking = await res.json();

    try {
      await isolatedUser.page.goto("/bookings");
      await isolatedUser.page.waitForLoadState("networkidle");

      // Badge is in the desktop table — query all badges and ensure at least one is visible
      await expect(isolatedUser.page.getByTestId("needs-review-badge").first()).toBeVisible();
    } finally {
      await isolatedUser.request.delete(`/api/bookings/${booking.id}`);
    }
  });

  test("filter=needs-review shows only bookings needing review", async ({ isolatedUser }) => {
    const propertyNameA = `Review Hotel A ${crypto.randomUUID()}`;
    const propertyNameB = `Normal Hotel B ${crypto.randomUUID()}`;

    const resA = await isolatedUser.request.post("/api/bookings", {
      data: {
        propertyName: propertyNameA,
        checkIn: `${YEAR}-06-01`,
        checkOut: `${YEAR}-06-04`,
        numNights: 3,
        pretaxCost: 300,
        taxAmount: 30,
        totalCost: 330,
        currency: "USD",
        bookingSource: "direct_web",
        countryCode: "US",
        city: "Salt Lake City",
        needsReview: true,
        ingestionMethod: "email",
      },
    });
    const bookingA = await resA.json();

    const resB = await isolatedUser.request.post("/api/bookings", {
      data: {
        propertyName: propertyNameB,
        checkIn: `${YEAR}-07-01`,
        checkOut: `${YEAR}-07-04`,
        numNights: 3,
        pretaxCost: 300,
        taxAmount: 30,
        totalCost: 330,
        currency: "USD",
        bookingSource: "direct_web",
        countryCode: "US",
        city: "Salt Lake City",
        needsReview: false,
      },
    });
    const bookingB = await resB.json();

    try {
      await isolatedUser.page.goto("/bookings?filter=needs-review");
      await isolatedUser.page.waitForLoadState("networkidle");

      // booking-row-{id} is the desktop table row (visible at 1280px viewport from Desktop Chrome config).
      // bookingA visible first so the full API response is loaded before the negative assertion.
      // Hotel A (needsReview=true) should appear
      await expect(isolatedUser.page.getByTestId(`booking-row-${bookingA.id}`)).toBeVisible();

      // Hotel B (needsReview=false) should NOT appear
      await expect(isolatedUser.page.getByTestId(`booking-row-${bookingB.id}`)).not.toBeVisible();
    } finally {
      await isolatedUser.request.delete(`/api/bookings/${bookingA.id}`);
      await isolatedUser.request.delete(`/api/bookings/${bookingB.id}`);
    }
  });

  test("dashboard callout appears and links to filtered bookings", async ({ isolatedUser }) => {
    const propertyName = `Callout Test Hotel ${crypto.randomUUID()}`;
    const res = await isolatedUser.request.post("/api/bookings", {
      data: {
        propertyName,
        checkIn: `${YEAR}-06-01`,
        checkOut: `${YEAR}-06-05`,
        numNights: 4,
        pretaxCost: 400,
        taxAmount: 40,
        totalCost: 440,
        currency: "USD",
        bookingSource: "direct_web",
        countryCode: "US",
        city: "Salt Lake City",
        needsReview: true,
        ingestionMethod: "email",
      },
    });
    const booking = await res.json();

    try {
      await isolatedUser.page.goto("/");
      await isolatedUser.page.waitForLoadState("networkidle");

      // Callout should be visible
      await expect(isolatedUser.page.getByTestId("needs-review-callout")).toBeVisible();

      // Clicking "View →" should navigate to /bookings?filter=needs-review
      await isolatedUser.page.getByTestId("needs-review-callout").getByRole("link").click();
      await isolatedUser.page.waitForURL(/filter=needs-review/);
      expect(isolatedUser.page.url()).toContain("filter=needs-review");
    } finally {
      await isolatedUser.request.delete(`/api/bookings/${booking.id}`);
    }
  });
});
