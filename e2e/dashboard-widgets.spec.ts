import crypto from "crypto";
import { test, expect } from "./fixtures";

const YEAR = new Date().getFullYear();

test.describe("Dashboard — widget smoke tests", () => {
  test("new widget cards are visible with booking data", async ({ isolatedUser, adminRequest }) => {
    const chains = await adminRequest.get("/api/hotel-chains");
    const chain = (await chains.json())[0];

    // Use a property name that triggers the manual geo modal path; we rely on the API
    // accepting countryCode directly via the property upsert. If the API does not accept
    // countryCode on booking create, the geo card will show empty state — adjust as needed.
    const propertyName = `Widget Test ${crypto.randomUUID()}`;
    const bookingRes = await isolatedUser.request.post("/api/bookings", {
      data: {
        hotelChainId: chain.id,
        propertyName,
        checkIn: `${YEAR}-06-10`,
        checkOut: `${YEAR}-06-13`,
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
    expect(bookingRes.ok()).toBeTruthy();
    const booking = await bookingRes.json();

    try {
      await isolatedUser.page.goto("/");
      await isolatedUser.page.waitForLoadState("networkidle");

      // Price Distribution — card visible and shows at least one bucket label
      const priceCard = isolatedUser.page.getByTestId("price-distribution-card");
      await expect(priceCard).toBeVisible();
      // $300 / 3 nights = $100/night → $100–150 bucket should appear
      await expect(priceCard).toContainText("$100–150");

      // Monthly Travel Pattern — card visible and shows month labels
      const monthlyCard = isolatedUser.page.getByTestId("monthly-travel-pattern-card");
      await expect(monthlyCard).toBeVisible();
      await expect(monthlyCard).toContainText("Jun");

      // Geo Distribution — card visible and shows at least one country row
      const geoCard = isolatedUser.page.getByTestId("geo-distribution-card");
      await expect(geoCard).toBeVisible();
      await expect(geoCard.getByTestId("geo-row-US")).toBeVisible();
    } finally {
      await isolatedUser.request.delete(`/api/bookings/${booking.id}`);
    }
  });
});

test.describe("Dashboard — widget mode toggles", () => {
  test("Geo Distribution: switching to City view shows city rows", async ({
    isolatedUser,
    adminRequest,
  }) => {
    const chains = await adminRequest.get("/api/hotel-chains");
    const chain = (await chains.json())[0];

    const bookingRes = await isolatedUser.request.post("/api/bookings", {
      data: {
        hotelChainId: chain.id,
        propertyName: `Geo Toggle Test ${crypto.randomUUID()}`,
        checkIn: `${YEAR}-06-10`,
        checkOut: `${YEAR}-06-13`,
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
    expect(bookingRes.ok()).toBeTruthy();
    const booking = await bookingRes.json();

    try {
      await isolatedUser.page.goto("/");
      await isolatedUser.page.waitForLoadState("networkidle");

      const geoCard = isolatedUser.page.getByTestId("geo-distribution-card");
      // Default: Country view shows US row
      await expect(geoCard.getByTestId("geo-row-US")).toBeVisible();

      // Switch to City view
      await geoCard.getByRole("button", { name: "City" }).click();
      await expect(geoCard.getByTestId("geo-row-New York, US")).toBeVisible();
      // Country row should no longer appear
      await expect(geoCard.getByTestId("geo-row-US")).not.toBeVisible();
    } finally {
      await isolatedUser.request.delete(`/api/bookings/${booking.id}`);
    }
  });

  test("Price Distribution: switching to Total/Night keeps chart visible", async ({
    isolatedUser,
    adminRequest,
  }) => {
    const chains = await adminRequest.get("/api/hotel-chains");
    const chain = (await chains.json())[0];

    const bookingRes = await isolatedUser.request.post("/api/bookings", {
      data: {
        hotelChainId: chain.id,
        propertyName: `Price Toggle Test ${crypto.randomUUID()}`,
        checkIn: `${YEAR}-07-10`,
        checkOut: `${YEAR}-07-13`,
        numNights: 3,
        pretaxCost: 270,
        taxAmount: 30,
        totalCost: 300,
        currency: "USD",
        bookingSource: "direct_web",
      },
    });
    expect(bookingRes.ok()).toBeTruthy();
    const booking = await bookingRes.json();

    try {
      await isolatedUser.page.goto("/");
      await isolatedUser.page.waitForLoadState("networkidle");

      const priceCard = isolatedUser.page.getByTestId("price-distribution-card");
      // Default: Net/Night — $300 / 3 nights = $100/night → $100–150 bucket
      await expect(priceCard).toContainText("$100–150");

      // Switch to Total/Night — same booking, same bucket
      await priceCard.getByRole("button", { name: "Total/Night" }).click();
      await expect(priceCard).toContainText("$100–150");
    } finally {
      await isolatedUser.request.delete(`/api/bookings/${booking.id}`);
    }
  });

  test("PaymentType: switching to Nights mode keeps legend visible", async ({
    isolatedUser,
    adminRequest,
  }) => {
    const chains = await adminRequest.get("/api/hotel-chains");
    const chain = (await chains.json())[0];

    const bookingRes = await isolatedUser.request.post("/api/bookings", {
      data: {
        hotelChainId: chain.id,
        propertyName: `PT Nights Toggle Test ${crypto.randomUUID()}`,
        checkIn: `${YEAR}-08-01`,
        checkOut: `${YEAR}-08-04`,
        numNights: 3,
        pretaxCost: 300,
        taxAmount: 30,
        totalCost: 330,
        currency: "USD",
        bookingSource: "direct_web",
      },
    });
    expect(bookingRes.ok()).toBeTruthy();
    const booking = await bookingRes.json();

    try {
      await isolatedUser.page.goto("/");
      await isolatedUser.page.waitForLoadState("networkidle");

      // Default: Stays mode — legend visible
      const legend = isolatedUser.page.getByTestId("payment-type-legend");
      await expect(legend).toBeVisible();

      // Switch to Nights mode — legend should still be visible
      await isolatedUser.page
        .getByTestId("payment-type-card")
        .getByRole("button", { name: "Nights" })
        .click();
      await expect(legend).toBeVisible();
      await expect(legend.getByTestId("legend-item-cash")).toBeVisible();
    } finally {
      await isolatedUser.request.delete(`/api/bookings/${booking.id}`);
    }
  });

  test("Monthly Travel Pattern: switching to Nights mode keeps month labels visible", async ({
    isolatedUser,
    adminRequest,
  }) => {
    const chains = await adminRequest.get("/api/hotel-chains");
    const chain = (await chains.json())[0];

    const bookingRes = await isolatedUser.request.post("/api/bookings", {
      data: {
        hotelChainId: chain.id,
        propertyName: `Monthly Toggle Test ${crypto.randomUUID()}`,
        checkIn: `${YEAR}-06-10`,
        checkOut: `${YEAR}-06-13`,
        numNights: 3,
        pretaxCost: 300,
        taxAmount: 30,
        totalCost: 330,
        currency: "USD",
        bookingSource: "direct_web",
      },
    });
    expect(bookingRes.ok()).toBeTruthy();
    const booking = await bookingRes.json();

    try {
      await isolatedUser.page.goto("/");
      await isolatedUser.page.waitForLoadState("networkidle");

      const monthlyCard = isolatedUser.page.getByTestId("monthly-travel-pattern-card");
      // Default: Stays mode shows month labels
      await expect(monthlyCard).toContainText("Jun");

      // Switch to Nights mode — month labels still present
      await monthlyCard.getByRole("button", { name: "Nights" }).click();
      await expect(monthlyCard).toContainText("Jun");
    } finally {
      await isolatedUser.request.delete(`/api/bookings/${booking.id}`);
    }
  });

  test("Sub-brand Breakdown: switching to Nights mode keeps legend visible", async ({
    isolatedUser,
    adminRequest,
  }) => {
    const chains = await adminRequest.get("/api/hotel-chains");
    const chain = (await chains.json())[0];

    const bookingRes = await isolatedUser.request.post("/api/bookings", {
      data: {
        hotelChainId: chain.id,
        propertyName: `SubBrand Toggle Test ${crypto.randomUUID()}`,
        checkIn: `${YEAR}-07-01`,
        checkOut: `${YEAR}-07-04`,
        numNights: 3,
        pretaxCost: 300,
        taxAmount: 30,
        totalCost: 330,
        currency: "USD",
        bookingSource: "direct_web",
      },
    });
    expect(bookingRes.ok()).toBeTruthy();
    const booking = await bookingRes.json();

    try {
      await isolatedUser.page.goto("/");
      await isolatedUser.page.waitForLoadState("networkidle");

      // Default: Stays mode — legend shows "No Sub-brand" for a hotel booking without a sub-brand
      const legend = isolatedUser.page.getByTestId("sub-brand-breakdown-legend");
      await expect(legend).toBeVisible();
      await expect(legend.getByTestId("legend-item-other")).toBeVisible();

      // Switch to Nights mode — legend still shows
      await isolatedUser.page
        .getByTestId("sub-brand-breakdown-card")
        .getByRole("button", { name: "Nights" })
        .click();
      await expect(legend).toBeVisible();
    } finally {
      await isolatedUser.request.delete(`/api/bookings/${booking.id}`);
    }
  });
});
