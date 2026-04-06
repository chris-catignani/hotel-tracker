import crypto from "crypto";
import { test, expect } from "./fixtures";
import { HOTEL_ID } from "@/lib/constants";
import { OTA_AGENCY_ID } from "../prisma/seed-ids";

const NEXT_YEAR = new Date().getFullYear() + 1;

test.describe("Booking View Page", () => {
  test("hero card shows property name, dates, and net cost", async ({ isolatedUser }) => {
    const { request, page } = isolatedUser;
    const propertyName = `Hero Test ${crypto.randomUUID()}`;
    const res = await request.post("/api/bookings", {
      data: {
        hotelChainId: HOTEL_ID.HYATT,
        propertyName,
        checkIn: `${NEXT_YEAR}-06-10`,
        checkOut: `${NEXT_YEAR}-06-13`,
        numNights: 3,
        pretaxCost: 450,
        taxAmount: 90,
        totalCost: 540,
        currency: "USD",
        bookingSource: "direct_web",
        countryCode: "US",
        city: "Chicago",
      },
    });
    const booking = await res.json();
    try {
      await page.goto(`/bookings/${booking.id}`);
      await expect(page.getByTestId("hero-property-name")).toContainText(propertyName);
      await expect(page.getByTestId("hero-check-in")).toBeVisible();
      await expect(page.getByTestId("hero-check-out")).toBeVisible();
      await expect(page.getByTestId("hero-nights")).toContainText("3");
      await expect(page.getByTestId("hero-net-cost")).toBeVisible();
    } finally {
      await request.delete(`/api/bookings/${booking.id}`);
    }
  });

  test("summary row shows net cost and per night; savings hidden when zero", async ({
    isolatedUser,
  }) => {
    const { request, page } = isolatedUser;
    const res = await request.post("/api/bookings", {
      data: {
        hotelChainId: HOTEL_ID.HYATT,
        propertyName: `Summary Row ${crypto.randomUUID()}`,
        checkIn: `${NEXT_YEAR}-06-10`,
        checkOut: `${NEXT_YEAR}-06-13`,
        numNights: 3,
        pretaxCost: 450,
        taxAmount: 90,
        totalCost: 540,
        currency: "USD",
        bookingSource: "direct_web",
      },
    });
    const booking = await res.json();
    try {
      await page.goto(`/bookings/${booking.id}`);
      await expect(page.getByTestId("usd-net-cost-row")).toBeVisible();
      await expect(page.getByTestId("usd-per-night-row")).toBeVisible();
      // No promotions → savings should show dash
      await expect(page.getByTestId("usd-savings-row")).toContainText("—");
    } finally {
      await request.delete(`/api/bookings/${booking.id}`);
    }
  });

  test("points booking shows pts redeemed in hero", async ({ isolatedUser }) => {
    const { request, page } = isolatedUser;
    const res = await request.post("/api/bookings", {
      data: {
        hotelChainId: HOTEL_ID.HYATT,
        propertyName: `Points Hero ${crypto.randomUUID()}`,
        checkIn: `${NEXT_YEAR}-06-15`,
        checkOut: `${NEXT_YEAR}-06-17`,
        numNights: 2,
        pretaxCost: 0,
        taxAmount: 0,
        totalCost: 0,
        pointsRedeemed: 30000,
        loyaltyPointsEarned: 0,
        currency: "USD",
        bookingSource: "direct_web",
      },
    });
    const booking = await res.json();
    try {
      await page.goto(`/bookings/${booking.id}`);
      await expect(page.getByTestId("hero-net-cost")).toContainText("30,000 pts");
    } finally {
      await request.delete(`/api/bookings/${booking.id}`);
    }
  });

  test("booking with bookingDate shows it in payment section", async ({ isolatedUser }) => {
    const { request, page } = isolatedUser;
    const pastYear = new Date().getFullYear() - 1;
    const res = await request.post("/api/bookings", {
      data: {
        hotelChainId: HOTEL_ID.HYATT,
        propertyName: `BookingDate Test ${crypto.randomUUID()}`,
        checkIn: `${NEXT_YEAR}-07-01`,
        checkOut: `${NEXT_YEAR}-07-03`,
        numNights: 2,
        pretaxCost: 200,
        taxAmount: 20,
        totalCost: 220,
        currency: "USD",
        bookingSource: "direct_web",
        paymentTiming: "prepaid",
        bookingDate: `${pastYear}-12-01`,
      },
    });
    const booking = await res.json();
    try {
      await page.goto(`/bookings/${booking.id}`);
      await expect(page.getByTestId("booking-date")).toBeVisible();
    } finally {
      await request.delete(`/api/bookings/${booking.id}`);
    }
  });

  test("OTA booking shows OTA booking source and agency in booking context", async ({
    isolatedUser,
  }) => {
    const { request, page } = isolatedUser;
    const res = await request.post("/api/bookings", {
      data: {
        hotelChainId: HOTEL_ID.HYATT,
        propertyName: `OTA View Test ${crypto.randomUUID()}`,
        checkIn: `${NEXT_YEAR}-08-01`,
        checkOut: `${NEXT_YEAR}-08-03`,
        numNights: 2,
        pretaxCost: 300,
        taxAmount: 30,
        totalCost: 330,
        currency: "USD",
        bookingSource: "ota",
        otaAgencyId: OTA_AGENCY_ID.AMEX_FHR,
      },
    });
    const booking = await res.json();
    try {
      await page.goto(`/bookings/${booking.id}`);
      await expect(page.getByTestId("booking-source")).toContainText("OTA");
      await expect(page.getByTestId("booking-ota")).toBeVisible();
    } finally {
      await request.delete(`/api/bookings/${booking.id}`);
    }
  });

  test("Points Earned card shows loyalty points", async ({ isolatedUser }) => {
    const { request, page } = isolatedUser;
    const res = await request.post("/api/bookings", {
      data: {
        hotelChainId: HOTEL_ID.HYATT,
        propertyName: `Points Earned ${crypto.randomUUID()}`,
        checkIn: `${NEXT_YEAR}-09-01`,
        checkOut: `${NEXT_YEAR}-09-04`,
        numNights: 3,
        pretaxCost: 500,
        taxAmount: 50,
        totalCost: 550,
        currency: "USD",
        bookingSource: "direct_web",
        loyaltyPointsEarned: 8200,
      },
    });
    const booking = await res.json();
    try {
      await page.goto(`/bookings/${booking.id}`);
      await expect(page.getByTestId("points-earned-card")).toBeVisible();
      await expect(page.getByTestId("loyalty-points-value")).toContainText("pts");
    } finally {
      await request.delete(`/api/bookings/${booking.id}`);
    }
  });

  test("confirmation number is shown when present", async ({ isolatedUser }) => {
    const { request, page } = isolatedUser;
    const res = await request.post("/api/bookings", {
      data: {
        hotelChainId: HOTEL_ID.HYATT,
        propertyName: `Conf Num Test ${crypto.randomUUID()}`,
        checkIn: `${NEXT_YEAR}-10-01`,
        checkOut: `${NEXT_YEAR}-10-03`,
        numNights: 2,
        pretaxCost: 200,
        taxAmount: 20,
        totalCost: 220,
        currency: "USD",
        bookingSource: "direct_web",
        confirmationNumber: "HYA-998877",
      },
    });
    const booking = await res.json();
    try {
      await page.goto(`/bookings/${booking.id}`);
      await expect(page.getByTestId("confirmation-number")).toContainText("HYA-998877");
    } finally {
      await request.delete(`/api/bookings/${booking.id}`);
    }
  });
});
