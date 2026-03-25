import crypto from "crypto";
import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";
import { HOTEL_ID } from "@/lib/constants";
import { OTA_AGENCY_ID, SHOPPING_PORTAL_ID } from "../prisma/seed-ids";

const YEAR = new Date().getFullYear();

test.describe("Booking List - Additional", () => {
  test("shows empty state when user has no bookings", async ({ isolatedUser }) => {
    await isolatedUser.page.goto("/bookings");
    await expect(isolatedUser.page.getByTestId("bookings-empty")).toBeVisible();
    await expect(
      isolatedUser.page.getByRole("link", { name: "Add Booking" }).first()
    ).toBeVisible();
  });

  test("shows year-filter empty state when selected year has no bookings", async ({
    pastYearBooking,
  }) => {
    // pastYearBooking checks out in a past year; the default filter is the current year,
    // so no bookings match and the year-filter empty state should show.
    await pastYearBooking.page.goto("/bookings");
    await expect(pastYearBooking.page.getByTestId("bookings-empty-year-filter")).toBeVisible();
  });

  test("Add Booking button navigates to /bookings/new", async ({ isolatedUser }) => {
    await isolatedUser.page.goto("/bookings");
    await isolatedUser.page.getByRole("link", { name: "Add Booking" }).first().click();
    await expect(isolatedUser.page).toHaveURL("/bookings/new");
  });

  test("points column shows redeemed points for an award stay", async ({ isolatedUser }) => {
    const { request, page } = isolatedUser;
    const res = await request.post("/api/bookings", {
      data: {
        hotelChainId: HOTEL_ID.HYATT,
        propertyName: `Award List ${crypto.randomUUID()}`,
        checkIn: `${YEAR}-06-01`,
        checkOut: `${YEAR}-06-03`,
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
      await page.goto("/bookings");
      const row = page.getByTestId(`booking-row-${booking.id}`);
      await expect(row.getByTestId("booking-points-redeemed")).toHaveText("30,000 pts");
    } finally {
      await request.delete(`/api/bookings/${booking.id}`);
    }
  });

  test("certs column shows cert short label for a cert stay", async ({ isolatedUser }) => {
    const { request, page } = isolatedUser;
    const res = await request.post("/api/bookings", {
      data: {
        hotelChainId: HOTEL_ID.HYATT,
        propertyName: `Cert List ${crypto.randomUUID()}`,
        checkIn: `${YEAR}-07-01`,
        checkOut: `${YEAR}-07-02`,
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
      await page.goto("/bookings");
      const row = page.getByTestId(`booking-row-${booking.id}`);
      await expect(row.getByTestId("booking-certs")).toHaveText("Cat 1–4");
    } finally {
      await request.delete(`/api/bookings/${booking.id}`);
    }
  });
});

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

  const testCases: {
    name: string;
    bookingData: Record<string, unknown>;
    expectations: (page: Page) => Promise<void>;
  }[] = [
    {
      name: "award stay shows points redeemed value and correct net cost",
      // 30,000 pts × $0.02 = $600.00 points value; netCost = $0 + $600 = $600.00
      bookingData: {
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
      expectations: async (page) => {
        await expect(page.getByTestId("breakdown-cash-cost")).toHaveText("$0.00");
        await expect(page.getByTestId("breakdown-points-value")).toHaveText("+$600.00");
        await expect(page.getByTestId("breakdown-net-cost")).toHaveText("$600.00");
      },
    },
    {
      name: "cert stay shows certificate value and correct net cost",
      // hyatt_cat1_4 = 15,000 pts × $0.02 = $300.00 cert value; netCost = $0 + $300 = $300.00
      bookingData: {
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
      expectations: async (page) => {
        await expect(page.getByTestId("breakdown-cash-cost")).toHaveText("$0.00");
        await expect(page.getByTestId("breakdown-certs-value")).toHaveText("+$300.00");
        await expect(page.getByTestId("breakdown-net-cost")).toHaveText("$300.00");
      },
    },
    {
      name: "points + cash combo shows both cash cost and points value",
      // totalCost = $200 cash + 10,000 pts × $0.02 = $200 points value; netCost = $400.00
      bookingData: {
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
      expectations: async (page) => {
        await expect(page.getByTestId("breakdown-cash-cost")).toHaveText("$200.00");
        await expect(page.getByTestId("breakdown-points-value")).toHaveText("+$200.00");
        await expect(page.getByTestId("breakdown-net-cost")).toHaveText("$400.00");
      },
    },
  ];

  for (const { name, bookingData, expectations } of testCases) {
    test(name, async ({ isolatedUser }) => {
      const { request, page } = isolatedUser;

      const res = await request.post("/api/bookings", {
        data: {
          ...bookingData,
          hotelChainId: HOTEL_ID.HYATT,
          propertyName: `${name} ${crypto.randomUUID()}`,
        },
      });
      const booking = await res.json();

      try {
        await page.goto(`/bookings/${booking.id}`);
        await expectations(page);
      } finally {
        await request.delete(`/api/bookings/${booking.id}`);
      }
    });
  }
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

  test("price watch toggle shows and hides threshold inputs", async ({ isolatedUser }) => {
    await isolatedUser.page.goto("/bookings/new");

    // Threshold inputs hidden by default
    await expect(isolatedUser.page.getByTestId("new-booking-cash-threshold")).not.toBeVisible();
    await expect(isolatedUser.page.getByTestId("new-booking-award-threshold")).not.toBeVisible();

    // Toggle on — inputs appear
    await isolatedUser.page.getByTestId("new-booking-price-watch-toggle").click();
    await expect(isolatedUser.page.getByTestId("new-booking-cash-threshold")).toBeVisible();
    await expect(isolatedUser.page.getByTestId("new-booking-award-threshold")).toBeVisible();

    // Toggle off — inputs hidden again
    await isolatedUser.page.getByTestId("new-booking-price-watch-toggle").click();
    await expect(isolatedUser.page.getByTestId("new-booking-cash-threshold")).not.toBeVisible();
    await expect(isolatedUser.page.getByTestId("new-booking-award-threshold")).not.toBeVisible();
  });
});

test.describe("Booking Detail - Info Grid", () => {
  const badgeTestCases = [
    {
      name: "award stay",
      bookingData: {
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
      badgeText: "Award",
    },
    {
      name: "cert stay",
      bookingData: {
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
      badgeText: "Cert",
    },
    {
      name: "cash + points combo stay",
      bookingData: {
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
      badgeText: "Cash + Points",
    },
  ];

  for (const { name, bookingData, badgeText } of badgeTestCases) {
    test(`shows booking type badge for a ${name}`, async ({ isolatedUser }) => {
      const { request, page } = isolatedUser;
      const res = await request.post("/api/bookings", {
        data: {
          ...bookingData,
          hotelChainId: HOTEL_ID.HYATT,
          propertyName: `Badge ${name} ${crypto.randomUUID()}`,
        },
      });
      const booking = await res.json();
      try {
        await page.goto(`/bookings/${booking.id}`);
        await expect(page.getByTestId("booking-type-badge")).toHaveText(badgeText);
      } finally {
        await request.delete(`/api/bookings/${booking.id}`);
      }
    });
  }

  test("shows no badge for a plain cash stay", async ({ testBooking }) => {
    await testBooking.page.goto(`/bookings/${testBooking.id}`);
    await expect(testBooking.page.getByTestId("booking-type-badge")).not.toBeVisible();
  });

  test("shows auto-calculated loyalty points earned", async ({ isolatedUser }) => {
    const { request, page } = isolatedUser;
    // Hyatt: 5 pts/$, pretax $300 → 1,500 base pts (no elite status for isolated user)
    const res = await request.post("/api/bookings", {
      data: {
        hotelChainId: HOTEL_ID.HYATT,
        propertyName: `Loyalty Pts ${crypto.randomUUID()}`,
        checkIn: "2025-06-01",
        checkOut: "2025-06-04",
        numNights: 3,
        pretaxCost: 300,
        taxAmount: 30,
        totalCost: 330,
        currency: "USD",
      },
    });
    const booking = await res.json();
    try {
      await page.goto(`/bookings/${booking.id}`);
      await expect(page.getByTestId("loyalty-points-earned")).toHaveText("1,500");
    } finally {
      await request.delete(`/api/bookings/${booking.id}`);
    }
  });

  test("shows credit card on detail page", async ({ isolatedUser, adminRequest }) => {
    const { request, page } = isolatedUser;

    const cardRes = await adminRequest.post("/api/credit-cards", {
      data: {
        name: `Test Card ${crypto.randomUUID()}`,
        rewardType: "cashback",
        rewardRate: 0.02,
      },
    });
    const card = await cardRes.json();
    const uccRes = await request.post("/api/user-credit-cards", {
      data: { creditCardId: card.id },
    });
    const ucc = await uccRes.json();

    const res = await request.post("/api/bookings", {
      data: {
        hotelChainId: HOTEL_ID.HYATT,
        propertyName: `Card Test ${crypto.randomUUID()}`,
        checkIn: `${YEAR}-08-01`,
        checkOut: `${YEAR}-08-03`,
        numNights: 2,
        pretaxCost: 200,
        taxAmount: 20,
        totalCost: 220,
        userCreditCardId: ucc.id,
        currency: "USD",
      },
    });
    const booking = await res.json();
    try {
      await page.goto(`/bookings/${booking.id}`);
      await expect(page.getByTestId("booking-credit-card")).toContainText(card.name);
    } finally {
      await request.delete(`/api/bookings/${booking.id}`);
      await request.delete(`/api/user-credit-cards/${ucc.id}`);
      await adminRequest.delete(`/api/credit-cards/${card.id}`);
    }
  });

  test("shows shopping portal on detail page", async ({ isolatedUser }) => {
    const { request, page } = isolatedUser;
    // Rakuten is seeded reference data; use it directly
    const res = await request.post("/api/bookings", {
      data: {
        hotelChainId: HOTEL_ID.HYATT,
        propertyName: `Portal Test ${crypto.randomUUID()}`,
        checkIn: `${YEAR}-09-01`,
        checkOut: `${YEAR}-09-03`,
        numNights: 2,
        pretaxCost: 200,
        taxAmount: 20,
        totalCost: 220,
        shoppingPortalId: SHOPPING_PORTAL_ID.RAKUTEN,
        portalCashbackRate: 0.05,
        portalCashbackOnTotal: false,
        currency: "USD",
      },
    });
    const booking = await res.json();
    try {
      await page.goto(`/bookings/${booking.id}`);
      await expect(page.getByTestId("booking-portal")).toContainText("Rakuten");
    } finally {
      await request.delete(`/api/bookings/${booking.id}`);
    }
  });

  test("shows sub-brand on detail page", async ({ isolatedUser, testSubBrand }) => {
    const { request, page } = isolatedUser;
    const subBrand = await testSubBrand("Park Hyatt");
    const res = await request.post("/api/bookings", {
      data: {
        hotelChainId: subBrand.hotelChainId,
        hotelChainSubBrandId: subBrand.id,
        propertyName: `SubBrand Test ${crypto.randomUUID()}`,
        checkIn: `${YEAR}-10-01`,
        checkOut: `${YEAR}-10-03`,
        numNights: 2,
        pretaxCost: 300,
        taxAmount: 30,
        totalCost: 330,
        currency: "USD",
      },
    });
    const booking = await res.json();
    try {
      await page.goto(`/bookings/${booking.id}`);
      await expect(page.getByTestId("booking-sub-brand")).toHaveText("Park Hyatt");
    } finally {
      await request.delete(`/api/bookings/${booking.id}`);
    }
  });

  test("shows OTA booking source with agency name", async ({ isolatedUser }) => {
    const { request, page } = isolatedUser;
    const res = await request.post("/api/bookings", {
      data: {
        hotelChainId: HOTEL_ID.HYATT,
        propertyName: `OTA Test ${crypto.randomUUID()}`,
        checkIn: `${YEAR}-11-01`,
        checkOut: `${YEAR}-11-03`,
        numNights: 2,
        pretaxCost: 200,
        taxAmount: 20,
        totalCost: 220,
        bookingSource: "ota",
        otaAgencyId: OTA_AGENCY_ID.AMEX_FHR,
        currency: "USD",
      },
    });
    const booking = await res.json();
    try {
      await page.goto(`/bookings/${booking.id}`);
      await expect(page.getByTestId("booking-source")).toHaveText("OTA — AMEX FHR");
    } finally {
      await request.delete(`/api/bookings/${booking.id}`);
    }
  });

  test("shows prepaid payment timing on detail page", async ({ isolatedUser }) => {
    const { request, page } = isolatedUser;
    const res = await request.post("/api/bookings", {
      data: {
        hotelChainId: HOTEL_ID.HYATT,
        propertyName: `Prepaid Test ${crypto.randomUUID()}`,
        checkIn: `${YEAR}-12-01`,
        checkOut: `${YEAR}-12-03`,
        numNights: 2,
        pretaxCost: 200,
        taxAmount: 20,
        totalCost: 220,
        paymentTiming: "prepaid",
        currency: "USD",
      },
    });
    const booking = await res.json();
    try {
      await page.goto(`/bookings/${booking.id}`);
      await expect(page.getByTestId("booking-prepaid")).toHaveText("Prepaid");
    } finally {
      await request.delete(`/api/bookings/${booking.id}`);
    }
  });
});
