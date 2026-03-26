import crypto from "crypto";
import { test, expect } from "./fixtures";
import { CREDIT_CARD_ID } from "../prisma/seed-ids";

const YEAR = new Date().getFullYear();

/**
 * E2E tests for the dashboard page.
 *
 * Key behaviors tested:
 * - Stat cards (total bookings, nights, spend, savings) reflect booking data
 * - Savings breakdown line items use getNetCostBreakdown (consistent with total savings)
 * - Avg/Night stat card breaks down by payment type (cash, points, certs)
 * - All booking types (cash, points, certs) contribute to savings stats
 * - Upcoming bookings table shows future stays
 * - Accommodation summary table shows chain rows
 * - PaymentTypeBreakdown and SubBrandBreakdown widgets render
 * - Empty states shown when user has no bookings
 */

test.describe("Dashboard — empty state", () => {
  test("shows empty states for upcoming bookings and savings when no bookings exist", async ({
    isolatedUser,
  }) => {
    await isolatedUser.page.goto("/");

    // Stat cards should show zero
    await expect(isolatedUser.page.getByTestId("stat-value-total-bookings")).toHaveText("0");
    await expect(isolatedUser.page.getByTestId("stat-value-total-nights")).toHaveText("0");

    // Savings breakdown shows empty state
    await expect(isolatedUser.page.getByTestId("savings-breakdown-empty")).toBeVisible();

    // Upcoming bookings shows empty state
    await expect(isolatedUser.page.getByTestId("recent-bookings-empty")).toBeVisible();
  });
});

test.describe("Dashboard — stat cards", () => {
  test("total bookings and nights counts reflect a created booking", async ({
    isolatedUser,
    adminRequest,
  }) => {
    const chains = await adminRequest.get("/api/hotel-chains");
    const chain = (await chains.json())[0];

    const propertyName = `Stat Card Test ${crypto.randomUUID()}`;
    const bookingRes = await isolatedUser.request.post("/api/bookings", {
      data: {
        hotelChainId: chain.id,
        propertyName,
        checkIn: `${YEAR}-07-01`,
        checkOut: `${YEAR}-07-05`,
        numNights: 4,
        pretaxCost: 400,
        taxAmount: 40,
        totalCost: 440,
        currency: "USD",
        bookingSource: "direct_web",
      },
    });
    expect(bookingRes.ok()).toBeTruthy();
    const booking = await bookingRes.json();

    try {
      await isolatedUser.page.goto("/");

      await expect(isolatedUser.page.getByTestId("stat-value-total-bookings")).toHaveText("1");
      await expect(isolatedUser.page.getByTestId("stat-value-total-nights")).toHaveText("4");

      // Cash spend stat shows a dollar value
      const cashStat = isolatedUser.page.getByTestId("stat-value-cash");
      await expect(cashStat).toBeVisible();
      const cashText = await cashStat.textContent();
      expect(cashText).toMatch(/^\$/);
      expect(cashText).not.toBe("—");
    } finally {
      await isolatedUser.request.delete(`/api/bookings/${booking.id}`);
    }
  });

  test("points spend stat shows pts value for a points booking", async ({
    isolatedUser,
    adminRequest,
  }) => {
    const chains = await adminRequest.get("/api/hotel-chains");
    const chain = (await chains.json())[0];

    const propertyName = `Points Spend Stat Test ${crypto.randomUUID()}`;
    const bookingRes = await isolatedUser.request.post("/api/bookings", {
      data: {
        hotelChainId: chain.id,
        propertyName,
        checkIn: `${YEAR}-07-01`,
        checkOut: `${YEAR}-07-04`,
        numNights: 3,
        pretaxCost: 0,
        taxAmount: 0,
        totalCost: 0,
        currency: "USD",
        bookingSource: "direct_web",
        pointsRedeemed: 45000,
      },
    });
    expect(bookingRes.ok()).toBeTruthy();
    const booking = await bookingRes.json();

    try {
      await isolatedUser.page.goto("/");

      const pointsStat = isolatedUser.page.getByTestId("stat-value-points");
      await expect(pointsStat).toBeVisible();
      const text = await pointsStat.textContent();
      expect(text).toContain("pts");
      expect(text).not.toBe("—");
    } finally {
      await isolatedUser.request.delete(`/api/bookings/${booking.id}`);
    }
  });

  test("certs spend stat shows cert count for a cert booking", async ({
    isolatedUser,
    adminRequest,
  }) => {
    const allChains = await adminRequest.get("/api/hotel-chains").then((r) => r.json());
    const marriott = allChains.find((c: { name: string }) => c.name === "Marriott Bonvoy");
    const chain = marriott ?? allChains[0];

    const propertyName = `Certs Spend Stat Test ${crypto.randomUUID()}`;
    const bookingRes = await isolatedUser.request.post("/api/bookings", {
      data: {
        hotelChainId: chain.id,
        propertyName,
        checkIn: `${YEAR}-07-10`,
        checkOut: `${YEAR}-07-13`,
        numNights: 3,
        pretaxCost: 0,
        taxAmount: 0,
        totalCost: 0,
        currency: "USD",
        bookingSource: "direct_web",
        certificates: ["marriott_35k", "marriott_35k", "marriott_35k"],
      },
    });
    expect(bookingRes.ok()).toBeTruthy();
    const booking = await bookingRes.json();

    try {
      await isolatedUser.page.goto("/");

      const certsStat = isolatedUser.page.getByTestId("stat-value-certs");
      await expect(certsStat).toBeVisible();
      const text = await certsStat.textContent();
      expect(text).toMatch(/cert/);
      expect(text).not.toBe("—");
    } finally {
      await isolatedUser.request.delete(`/api/bookings/${booking.id}`);
    }
  });

  test("total savings stat reflects portal cashback savings", async ({
    isolatedUser,
    adminRequest,
  }) => {
    const chains = await adminRequest.get("/api/hotel-chains");
    const chain = (await chains.json())[0];

    const portals = await adminRequest.get("/api/portals");
    const allPortals = await portals.json();
    const portal =
      allPortals.find((p: { rewardType: string }) => p.rewardType === "cashback") ?? allPortals[0];

    const propertyName = `Total Savings Stat Test ${crypto.randomUUID()}`;
    const bookingRes = await isolatedUser.request.post("/api/bookings", {
      data: {
        hotelChainId: chain.id,
        propertyName,
        checkIn: `${YEAR}-09-01`,
        checkOut: `${YEAR}-09-04`,
        numNights: 3,
        pretaxCost: 300,
        taxAmount: 30,
        totalCost: 330,
        currency: "USD",
        bookingSource: "direct_web",
        shoppingPortalId: portal.id,
        portalCashbackRate: 0.05,
        portalCashbackOnTotal: false,
      },
    });
    expect(bookingRes.ok()).toBeTruthy();
    const booking = await bookingRes.json();

    try {
      await isolatedUser.page.goto("/");

      // Total Savings stat should show a positive dollar value
      const totalSavingsStat = isolatedUser.page.getByTestId("stat-value-total-savings");
      await expect(totalSavingsStat).toBeVisible();
      const text = await totalSavingsStat.textContent();
      expect(text).toMatch(/^\$/);
      expect(text).not.toBe("$0");
    } finally {
      await isolatedUser.request.delete(`/api/bookings/${booking.id}`);
    }
  });
});

test.describe("Dashboard — upcoming bookings", () => {
  test("future booking appears in the upcoming bookings table", async ({
    isolatedUser,
    adminRequest,
  }) => {
    const chains = await adminRequest.get("/api/hotel-chains");
    const chain = (await chains.json())[0];

    const propertyName = `Upcoming Test ${crypto.randomUUID()}`;
    const bookingRes = await isolatedUser.request.post("/api/bookings", {
      data: {
        hotelChainId: chain.id,
        propertyName,
        checkIn: `${YEAR}-12-01`,
        checkOut: `${YEAR}-12-04`,
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

      // Booking row appears in the desktop upcoming bookings table
      const bookingRow = isolatedUser.page.getByTestId(`booking-row-${booking.id}`);
      await expect(bookingRow).toBeVisible();

      // Net/Night cell is present and shows a dollar value
      const netPerNight = bookingRow.getByTestId("booking-net-per-night");
      await expect(netPerNight).toBeVisible();
      const netText = await netPerNight.textContent();
      expect(netText).toMatch(/^\$/);
    } finally {
      await isolatedUser.request.delete(`/api/bookings/${booking.id}`);
    }
  });
});

test.describe("Dashboard — accommodation summary", () => {
  test("chain name appears in the accommodation summary table", async ({
    isolatedUser,
    adminRequest,
  }) => {
    const chains = await adminRequest.get("/api/hotel-chains");
    const chain = (await chains.json())[0];

    const propertyName = `Summary Table Test ${crypto.randomUUID()}`;
    const bookingRes = await isolatedUser.request.post("/api/bookings", {
      data: {
        hotelChainId: chain.id,
        propertyName,
        checkIn: `${YEAR}-07-10`,
        checkOut: `${YEAR}-07-13`,
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

      const summaryTable = isolatedUser.page.getByTestId("hotel-chain-summary-desktop");
      await expect(summaryTable).toContainText(chain.name);
    } finally {
      await isolatedUser.request.delete(`/api/bookings/${booking.id}`);
    }
  });
});

test.describe("Dashboard — PaymentTypeBreakdown widget", () => {
  test("legend shows cash/points/certificates items for each payment type", async ({
    isolatedUser,
    adminRequest,
  }) => {
    const chains = await adminRequest.get("/api/hotel-chains");
    const allChains = await chains.json();
    const chain = allChains[0];
    const marriott = allChains.find((c: { name: string }) => c.name === "Marriott Bonvoy") ?? chain;

    const cashPropertyName = `PT Cash Test ${crypto.randomUUID()}`;
    const pointsPropertyName = `PT Points Test ${crypto.randomUUID()}`;
    const certsPropertyName = `PT Certs Test ${crypto.randomUUID()}`;

    const [cashRes, pointsRes, certsRes] = await Promise.all([
      isolatedUser.request.post("/api/bookings", {
        data: {
          hotelChainId: chain.id,
          propertyName: cashPropertyName,
          checkIn: `${YEAR}-08-15`,
          checkOut: `${YEAR}-08-18`,
          numNights: 3,
          pretaxCost: 300,
          taxAmount: 30,
          totalCost: 330,
          currency: "USD",
          bookingSource: "direct_web",
        },
      }),
      isolatedUser.request.post("/api/bookings", {
        data: {
          hotelChainId: chain.id,
          propertyName: pointsPropertyName,
          checkIn: `${YEAR}-08-20`,
          checkOut: `${YEAR}-08-23`,
          numNights: 3,
          pretaxCost: 0,
          taxAmount: 0,
          totalCost: 0,
          currency: "USD",
          bookingSource: "direct_web",
          pointsRedeemed: 45000,
        },
      }),
      isolatedUser.request.post("/api/bookings", {
        data: {
          hotelChainId: marriott.id,
          propertyName: certsPropertyName,
          checkIn: `${YEAR}-08-25`,
          checkOut: `${YEAR}-08-28`,
          numNights: 3,
          pretaxCost: 0,
          taxAmount: 0,
          totalCost: 0,
          currency: "USD",
          bookingSource: "direct_web",
          certificates: ["marriott_35k", "marriott_35k", "marriott_35k"],
        },
      }),
    ]);

    expect(cashRes.ok()).toBeTruthy();
    expect(pointsRes.ok()).toBeTruthy();
    expect(certsRes.ok()).toBeTruthy();
    const [cashBooking, pointsBooking, certsBooking] = await Promise.all([
      cashRes.json(),
      pointsRes.json(),
      certsRes.json(),
    ]);

    try {
      await isolatedUser.page.goto("/");

      const legend = isolatedUser.page.getByTestId("payment-type-legend");
      await expect(legend).toBeVisible();
      await expect(legend.getByTestId("legend-item-cash")).toBeVisible();
      await expect(legend.getByTestId("legend-item-points")).toBeVisible();
      await expect(legend.getByTestId("legend-item-certificates")).toBeVisible();
    } finally {
      await Promise.all([
        isolatedUser.request.delete(`/api/bookings/${cashBooking.id}`),
        isolatedUser.request.delete(`/api/bookings/${pointsBooking.id}`),
        isolatedUser.request.delete(`/api/bookings/${certsBooking.id}`),
      ]);
    }
  });
});

test.describe("Dashboard — SubBrandBreakdown widget", () => {
  test("widget renders (empty state) when no sub-brand bookings exist", async ({
    isolatedUser,
    adminRequest,
  }) => {
    const chains = await adminRequest.get("/api/hotel-chains");
    const chain = (await chains.json())[0];

    const propertyName = `SubBrand Widget Test ${crypto.randomUUID()}`;
    const bookingRes = await isolatedUser.request.post("/api/bookings", {
      data: {
        hotelChainId: chain.id,
        propertyName,
        checkIn: `${YEAR}-08-20`,
        checkOut: `${YEAR}-08-23`,
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

      // Booking has no sub-brand — widget shows "Other" in the legend
      const legend = isolatedUser.page.getByTestId("sub-brand-breakdown-legend");
      await expect(legend).toBeVisible();
      await expect(legend.getByTestId("legend-item-other")).toBeVisible();
    } finally {
      await isolatedUser.request.delete(`/api/bookings/${booking.id}`);
    }
  });
});

test.describe("Dashboard", () => {
  test("savings breakdown portal cashback reflects booking portal rate", async ({
    isolatedUser,
    adminRequest,
  }) => {
    const chains = await adminRequest.get("/api/hotel-chains");
    const chain = (await chains.json())[0];

    const portals = await adminRequest.get("/api/portals");
    // Explicitly use a cashback portal so portalCashback = rate × pretaxCost × 1 (not × centsPerPoint)
    // e.g. British Airways portal (points/Avios at 1.2¢) would give 0.05×300×0.012=$0.18 → rounds to $0
    const allPortals = await portals.json();
    const portal =
      allPortals.find((p: { rewardType: string }) => p.rewardType === "cashback") ?? allPortals[0];

    // Create a cash booking with a known portal cashback rate
    const propertyName = `Dashboard Portal Test ${crypto.randomUUID()}`;
    const bookingRes = await isolatedUser.request.post("/api/bookings", {
      data: {
        hotelChainId: chain.id,
        propertyName,
        checkIn: `${YEAR}-08-01`,
        checkOut: `${YEAR}-08-04`,
        numNights: 3,
        pretaxCost: 300,
        taxAmount: 30,
        totalCost: 330,
        currency: "USD",
        bookingSource: "direct_web",
        shoppingPortalId: portal.id,
        portalCashbackRate: 0.05,
        portalCashbackOnTotal: false,
      },
    });
    expect(bookingRes.ok()).toBeTruthy();
    const booking = await bookingRes.json();

    try {
      await isolatedUser.page.goto("/");

      // Portal cashback line item should be visible and show a positive dollar amount
      const portalEl = isolatedUser.page.getByTestId("savings-breakdown-portal");
      await expect(portalEl).toBeVisible();
      const portalText = await portalEl.textContent();
      expect(portalText).toMatch(/^\$\d/);
      expect(portalText).not.toBe("$0");

      // Total savings should also be visible
      await expect(isolatedUser.page.getByTestId("savings-breakdown-total")).toBeVisible();
    } finally {
      await isolatedUser.request.delete(`/api/bookings/${booking.id}`);
    }
  });

  test("avg/night cash column shows dollar value for cash booking", async ({
    isolatedUser,
    adminRequest,
  }) => {
    const chains = await adminRequest.get("/api/hotel-chains");
    const chain = (await chains.json())[0];

    const propertyName = `Dashboard Cash Avg Test ${crypto.randomUUID()}`;
    const bookingRes = await isolatedUser.request.post("/api/bookings", {
      data: {
        hotelChainId: chain.id,
        propertyName,
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

      // Cash avg/night should show a dollar value (not "—")
      const cashAvg = isolatedUser.page.getByTestId("stat-value-avg-cash-net-per-night");
      await expect(cashAvg).toBeVisible();
      const text = await cashAvg.textContent();
      expect(text).toMatch(/^\$/);
      expect(text).not.toBe("—");
    } finally {
      await isolatedUser.request.delete(`/api/bookings/${booking.id}`);
    }
  });

  test("avg/night points column shows pts value for points booking", async ({
    isolatedUser,
    adminRequest,
  }) => {
    const chains = await adminRequest.get("/api/hotel-chains");
    const chain = (await chains.json())[0];

    const propertyName = `Dashboard Points Avg Test ${crypto.randomUUID()}`;
    const bookingRes = await isolatedUser.request.post("/api/bookings", {
      data: {
        hotelChainId: chain.id,
        propertyName,
        checkIn: `${YEAR}-08-01`,
        checkOut: `${YEAR}-08-04`,
        numNights: 3,
        pretaxCost: 0,
        taxAmount: 0,
        totalCost: 0,
        currency: "USD",
        bookingSource: "direct_web",
        pointsRedeemed: 60000,
      },
    });
    expect(bookingRes.ok()).toBeTruthy();
    const booking = await bookingRes.json();

    try {
      await isolatedUser.page.goto("/");

      // Points avg/night should show a "pts" value (not "—")
      const pointsAvg = isolatedUser.page.getByTestId("stat-value-avg-points-per-night");
      await expect(pointsAvg).toBeVisible();
      const text = await pointsAvg.textContent();
      expect(text).toContain("pts");
      expect(text).not.toBe("—");
    } finally {
      await isolatedUser.request.delete(`/api/bookings/${booking.id}`);
    }
  });

  test("avg/night certs column shows pts value for cert booking", async ({
    isolatedUser,
    adminRequest,
  }) => {
    // Use Marriott chain so marriott_35k certs are valid
    const allChains = await adminRequest.get("/api/hotel-chains").then((r) => r.json());
    const marriott = allChains.find((c: { name: string }) => c.name === "Marriott Bonvoy");
    // Fall back to first chain if Marriott not seeded
    const chain = marriott ?? allChains[0];

    const propertyName = `Dashboard Certs Avg Test ${crypto.randomUUID()}`;
    const bookingRes = await isolatedUser.request.post("/api/bookings", {
      data: {
        hotelChainId: chain.id,
        propertyName,
        checkIn: `${YEAR}-08-01`,
        checkOut: `${YEAR}-08-04`,
        numNights: 3,
        pretaxCost: 0,
        taxAmount: 0,
        totalCost: 0,
        currency: "USD",
        bookingSource: "direct_web",
        certificates: ["marriott_35k", "marriott_35k", "marriott_35k"],
      },
    });
    expect(bookingRes.ok()).toBeTruthy();
    const booking = await bookingRes.json();

    try {
      await isolatedUser.page.goto("/");

      // Certs avg/night should show a "pts" value (not "—")
      const certsAvg = isolatedUser.page.getByTestId("stat-value-avg-certs-per-night");
      await expect(certsAvg).toBeVisible();
      const text = await certsAvg.textContent();
      expect(text).toContain("pts");
      expect(text).not.toBe("—");
    } finally {
      await isolatedUser.request.delete(`/api/bookings/${booking.id}`);
    }
  });
});

test.describe("Dashboard — accommodation filter", () => {
  test("filter buttons control which booking types appear in accommodation summary", async ({
    isolatedUser,
    adminRequest,
  }) => {
    const chains = await adminRequest.get("/api/hotel-chains");
    const chain = (await chains.json())[0];

    const hotelPropertyName = `Filter Hotel Test ${crypto.randomUUID()}`;
    const aptPropertyName = `Filter Apt Test ${crypto.randomUUID()}`;

    const [hotelRes, aptRes] = await Promise.all([
      isolatedUser.request.post("/api/bookings", {
        data: {
          hotelChainId: chain.id,
          propertyName: hotelPropertyName,
          checkIn: `${YEAR}-07-01`,
          checkOut: `${YEAR}-07-04`,
          numNights: 3,
          pretaxCost: 300,
          taxAmount: 30,
          totalCost: 330,
          currency: "USD",
          bookingSource: "direct_web",
        },
      }),
      isolatedUser.request.post("/api/bookings", {
        data: {
          accommodationType: "apartment",
          hotelChainId: null,
          propertyName: aptPropertyName,
          checkIn: `${YEAR}-08-01`,
          checkOut: `${YEAR}-08-05`,
          numNights: 4,
          pretaxCost: 400,
          taxAmount: 40,
          totalCost: 440,
          currency: "USD",
          bookingSource: "direct_web",
        },
      }),
    ]);
    expect(hotelRes.ok()).toBeTruthy();
    expect(aptRes.ok()).toBeTruthy();
    const [hotelBooking, aptBooking] = await Promise.all([hotelRes.json(), aptRes.json()]);

    try {
      await isolatedUser.page.goto("/");

      const summaryTable = isolatedUser.page.getByTestId("hotel-chain-summary-desktop");

      // All filter (default): both chain name and apartment label present
      await expect(isolatedUser.page.getByTestId("dashboard-filter-all")).toBeVisible();
      await expect(summaryTable).toContainText(chain.name);
      await expect(summaryTable).toContainText("Apartments / Short-term Rentals");

      // Hotels filter: apartment row absent, hotel chain visible
      await isolatedUser.page.getByTestId("dashboard-filter-hotel").click();
      await expect(summaryTable).toContainText(chain.name);
      await expect(summaryTable).not.toContainText("Apartments / Short-term Rentals");

      // Apartments filter: hotel chain absent, apartment label visible
      await isolatedUser.page.getByTestId("dashboard-filter-apartment").click();
      await expect(summaryTable).toContainText("Apartments / Short-term Rentals");
      await expect(summaryTable).not.toContainText(chain.name);

      // Back to All: both present again
      await isolatedUser.page.getByTestId("dashboard-filter-all").click();
      await expect(summaryTable).toContainText(chain.name);
      await expect(summaryTable).toContainText("Apartments / Short-term Rentals");
    } finally {
      await Promise.all([
        isolatedUser.request.delete(`/api/bookings/${hotelBooking.id}`),
        isolatedUser.request.delete(`/api/bookings/${aptBooking.id}`),
      ]);
    }
  });
});

test.describe("Dashboard — savings breakdown card rewards", () => {
  test("card rewards line item shows non-zero value when booking uses a rewards card", async ({
    isolatedUser,
    adminRequest,
  }) => {
    const chains = await adminRequest.get("/api/hotel-chains");
    const chain = (await chains.json())[0];

    // Create a UserCreditCard for this isolated user (Chase Sapphire Reserve: 4x UR, 2¢/pt)
    const uccRes = await isolatedUser.request.post("/api/user-credit-cards", {
      data: { creditCardId: CREDIT_CARD_ID.CHASE_SAPPHIRE_RESERVE },
    });
    expect(uccRes.ok()).toBeTruthy();
    const { id: userCreditCardId } = await uccRes.json();

    const propertyName = `Card Rewards Test ${crypto.randomUUID()}`;
    const bookingRes = await isolatedUser.request.post("/api/bookings", {
      data: {
        hotelChainId: chain.id,
        propertyName,
        checkIn: `${YEAR}-09-10`,
        checkOut: `${YEAR}-09-14`,
        numNights: 4,
        pretaxCost: 400,
        taxAmount: 40,
        totalCost: 440,
        currency: "USD",
        bookingSource: "direct_web",
        userCreditCardId,
      },
    });
    expect(bookingRes.ok()).toBeTruthy();
    const booking = await bookingRes.json();

    try {
      await isolatedUser.page.goto("/");

      const cardRewardsEl = isolatedUser.page.getByTestId("savings-breakdown-card");
      await expect(cardRewardsEl).toBeVisible();
      const text = await cardRewardsEl.textContent();
      expect(text).toMatch(/^\$/);
      expect(text).not.toBe("$0");
    } finally {
      await isolatedUser.request.delete(`/api/bookings/${booking.id}`);
      await isolatedUser.request.delete(`/api/user-credit-cards/${userCreditCardId}`);
    }
  });
});

test.describe("Dashboard — accommodation summary sorting", () => {
  test("apartment row stays pinned last after sorting by chain name", async ({
    isolatedUser,
    adminRequest,
  }) => {
    const chains = await adminRequest.get("/api/hotel-chains");
    const chain = (await chains.json())[0];

    const hotelPropertyName = `Sort Hotel Test ${crypto.randomUUID()}`;
    const aptPropertyName = `Sort Apt Test ${crypto.randomUUID()}`;

    const [hotelRes, aptRes] = await Promise.all([
      isolatedUser.request.post("/api/bookings", {
        data: {
          hotelChainId: chain.id,
          propertyName: hotelPropertyName,
          checkIn: `${YEAR}-07-05`,
          checkOut: `${YEAR}-07-08`,
          numNights: 3,
          pretaxCost: 300,
          taxAmount: 30,
          totalCost: 330,
          currency: "USD",
          bookingSource: "direct_web",
        },
      }),
      isolatedUser.request.post("/api/bookings", {
        data: {
          accommodationType: "apartment",
          hotelChainId: null,
          propertyName: aptPropertyName,
          checkIn: `${YEAR}-08-05`,
          checkOut: `${YEAR}-08-09`,
          numNights: 4,
          pretaxCost: 400,
          taxAmount: 40,
          totalCost: 440,
          currency: "USD",
          bookingSource: "direct_web",
        },
      }),
    ]);
    expect(hotelRes.ok()).toBeTruthy();
    expect(aptRes.ok()).toBeTruthy();
    const [hotelBooking, aptBooking] = await Promise.all([hotelRes.json(), aptRes.json()]);

    try {
      await isolatedUser.page.goto("/");

      const summaryTable = isolatedUser.page.getByTestId("hotel-chain-summary-desktop");
      await expect(summaryTable).toBeVisible();

      // Click "Chain / Type" header to sort ascending
      await summaryTable.getByTestId("sort-header-chain").click();

      // Apartment row must still be last regardless of sort direction
      const rows = summaryTable.locator("tbody tr");
      const lastRow = rows.last();
      await expect(lastRow).toContainText("Apartments / Short-term Rentals");

      // Click again to sort descending — apartment row still last
      await summaryTable.getByTestId("sort-header-chain").click();
      await expect(rows.last()).toContainText("Apartments / Short-term Rentals");
    } finally {
      await Promise.all([
        isolatedUser.request.delete(`/api/bookings/${hotelBooking.id}`),
        isolatedUser.request.delete(`/api/bookings/${aptBooking.id}`),
      ]);
    }
  });
});

test.describe("Dashboard — mixed payment warning", () => {
  test("amber warning appears when a booking uses both cash and points", async ({
    isolatedUser,
    adminRequest,
  }) => {
    const chains = await adminRequest.get("/api/hotel-chains");
    const chain = (await chains.json())[0];

    const propertyName = `Mixed Payment Test ${crypto.randomUUID()}`;
    const bookingRes = await isolatedUser.request.post("/api/bookings", {
      data: {
        hotelChainId: chain.id,
        propertyName,
        checkIn: `${YEAR}-09-20`,
        checkOut: `${YEAR}-09-23`,
        numNights: 3,
        pretaxCost: 150,
        taxAmount: 15,
        totalCost: 165,
        currency: "USD",
        bookingSource: "direct_web",
        pointsRedeemed: 20000,
      },
    });
    expect(bookingRes.ok()).toBeTruthy();
    const booking = await bookingRes.json();

    try {
      await isolatedUser.page.goto("/");

      // Avg/Night skipped warning should be visible
      await expect(isolatedUser.page.getByTestId("avg-night-skipped-warning")).toBeVisible();
    } finally {
      await isolatedUser.request.delete(`/api/bookings/${booking.id}`);
    }
  });
});
