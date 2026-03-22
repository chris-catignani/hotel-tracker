import { test, expect } from "./fixtures";
import { HOTEL_ID } from "@/lib/constants";

test.describe("Booking Benefits in Cost Breakdown", () => {
  test("cash benefit appears expanded and reduces Net Cost", async ({ isolatedUser }) => {
    const { request, page } = isolatedUser;

    const bookingRes = await request.post("/api/bookings", {
      data: {
        accommodationType: "hotel",
        hotelChainId: HOTEL_ID.HYATT,
        propertyName: "Test Property",
        checkIn: "2025-06-01",
        checkOut: "2025-06-04",
        numNights: 3,
        pretaxCost: 300,
        taxAmount: 30,
        totalCost: 330,
        currency: "USD",
        benefits: [{ benefitType: "free_breakfast", dollarValue: 25 }],
      },
    });
    expect(bookingRes.ok()).toBeTruthy();
    const booking = await bookingRes.json();

    try {
      await page.goto(`/bookings/${booking.id}`);

      const benefitsToggle = page.getByTestId("breakdown-benefits-toggle");
      await expect(benefitsToggle).toBeVisible();
      await expect(page.getByTestId("breakdown-benefits-value")).toContainText("$25.00");

      await benefitsToggle.click();
      const benefitsList = page.getByTestId("breakdown-benefits-list");
      await expect(benefitsList).toBeVisible();
      await expect(benefitsList).toContainText("Free Breakfast");

      const netCost = page.getByTestId("breakdown-net-cost");
      // 330 - 25 (benefit) - 30 (loyalty: 300 × 5pts × $0.02) = $275.00
      await expect(netCost).toContainText("$275.00");
    } finally {
      await request.delete(`/api/bookings/${booking.id}`);
    }
  });

  test("fixed_per_night points benefit shows correct dollar value", async ({ isolatedUser }) => {
    const { request, page } = isolatedUser;

    // Hyatt: $0.02/pt (usdCentsPerPoint=0.02); 1000 pts × 3 nights × 0.02 = $60.00
    const bookingRes = await request.post("/api/bookings", {
      data: {
        accommodationType: "hotel",
        hotelChainId: HOTEL_ID.HYATT,
        propertyName: "Test Property",
        checkIn: "2025-06-01",
        checkOut: "2025-06-04",
        numNights: 3,
        pretaxCost: 300,
        taxAmount: 30,
        totalCost: 330,
        currency: "USD",
        benefits: [
          {
            benefitType: "other",
            label: "Bonus Points",
            pointsEarnType: "fixed_per_night",
            pointsAmount: 1000,
          },
        ],
      },
    });
    expect(bookingRes.ok()).toBeTruthy();
    const booking = await bookingRes.json();

    try {
      await page.goto(`/bookings/${booking.id}`);

      const benefitsToggle = page.getByTestId("breakdown-benefits-toggle");
      await expect(benefitsToggle).toBeVisible();

      await benefitsToggle.click();
      const benefitsList = page.getByTestId("breakdown-benefits-list");
      await expect(benefitsList).toContainText("Bonus Points");
      await expect(page.getByTestId("breakdown-benefits-value")).toContainText("$60.00");
    } finally {
      await request.delete(`/api/bookings/${booking.id}`);
    }
  });

  test("multiplier_on_base benefit shows correct dollar value", async ({ isolatedUser }) => {
    const { request, page } = isolatedUser;

    // Hyatt: basePointRate=5, pretaxCost=300, multiplier=2.0
    // extraPts = floor((2-1) × 5 × 300) = 1500 pts
    // value = 1500 × $0.02 = $30.00
    const bookingRes = await request.post("/api/bookings", {
      data: {
        accommodationType: "hotel",
        hotelChainId: HOTEL_ID.HYATT,
        propertyName: "Test Property",
        checkIn: "2025-06-01",
        checkOut: "2025-06-04",
        numNights: 3,
        pretaxCost: 300,
        taxAmount: 30,
        totalCost: 330,
        currency: "USD",
        benefits: [
          {
            benefitType: "other",
            label: "Double Base Points",
            pointsEarnType: "multiplier_on_base",
            pointsMultiplier: 2.0,
          },
        ],
      },
    });
    expect(bookingRes.ok()).toBeTruthy();
    const booking = await bookingRes.json();

    try {
      await page.goto(`/bookings/${booking.id}`);

      const benefitsToggle = page.getByTestId("breakdown-benefits-toggle");
      await expect(benefitsToggle).toBeVisible();
      await expect(page.getByTestId("breakdown-benefits-value")).toContainText("$30.00");
    } finally {
      await request.delete(`/api/bookings/${booking.id}`);
    }
  });

  test("Booking Benefits row is absent for a booking with purely informational benefits (no value)", async ({
    isolatedUser,
  }) => {
    const { request, page } = isolatedUser;

    const bookingRes = await request.post("/api/bookings", {
      data: {
        accommodationType: "hotel",
        hotelChainId: HOTEL_ID.HYATT,
        propertyName: "Test Property",
        checkIn: "2025-06-01",
        checkOut: "2025-06-02",
        numNights: 1,
        pretaxCost: 150,
        taxAmount: 15,
        totalCost: 165,
        currency: "USD",
        benefits: [
          { benefitType: "room_upgrade" }, // no dollarValue, no pointsEarnType
        ],
      },
    });
    expect(bookingRes.ok()).toBeTruthy();
    const booking = await bookingRes.json();

    try {
      await page.goto(`/bookings/${booking.id}`);
      await expect(page.getByTestId("breakdown-benefits-toggle")).not.toBeVisible();
    } finally {
      await request.delete(`/api/bookings/${booking.id}`);
    }
  });

  test("Booking Benefits row is absent for a booking with no benefits at all", async ({
    isolatedUser,
  }) => {
    const { request, page } = isolatedUser;

    const bookingRes = await request.post("/api/bookings", {
      data: {
        accommodationType: "hotel",
        hotelChainId: HOTEL_ID.HYATT,
        propertyName: "Test Property",
        checkIn: "2025-06-01",
        checkOut: "2025-06-02",
        numNights: 1,
        pretaxCost: 150,
        taxAmount: 15,
        totalCost: 165,
        currency: "USD",
        benefits: [],
      },
    });
    expect(bookingRes.ok()).toBeTruthy();
    const booking = await bookingRes.json();

    try {
      await page.goto(`/bookings/${booking.id}`);
      await expect(page.getByTestId("breakdown-benefits-toggle")).not.toBeVisible();
    } finally {
      await request.delete(`/api/bookings/${booking.id}`);
    }
  });
});
