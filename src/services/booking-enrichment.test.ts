import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import {
  enrichBookingWithRate,
  finalizeCheckedInBookings,
  enrichBookingsWithPartnerships,
  enrichBookingWithPartnerships,
} from "./booking-enrichment";

vi.mock("./exchange-rate", () => ({
  getCurrentRate: vi.fn(),
  resolveCalcCurrencyRate: vi.fn().mockResolvedValue(null),
  getOrFetchHistoricalRate: vi.fn(),
  fetchExchangeRate: vi.fn(),
}));

vi.mock("@/lib/loyalty-utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/loyalty-utils")>();
  return { ...actual, calculatePoints: vi.fn() };
});

vi.mock("@/lib/prisma", () => ({
  default: {
    exchangeRateHistory: { findUnique: vi.fn() },
    booking: { findMany: vi.fn(), update: vi.fn() },
    userStatus: { findMany: vi.fn() },
    userPartnershipEarn: { findMany: vi.fn() },
  },
}));

vi.mock("@/services/partnership-earns", () => ({
  resolvePartnershipEarns: vi.fn().mockResolvedValue([]),
}));

import {
  getCurrentRate,
  resolveCalcCurrencyRate,
  getOrFetchHistoricalRate,
  fetchExchangeRate,
} from "./exchange-rate";
import { calculatePoints } from "@/lib/loyalty-utils";
import prisma from "@/lib/prisma";
import { resolvePartnershipEarns } from "@/services/partnership-earns";

const mockGetCurrentRate = getCurrentRate as Mock;
const mockResolveCalcCurrencyRate = resolveCalcCurrencyRate as Mock;
const mockCalculatePoints = calculatePoints as Mock;
const mockGetOrFetchHistoricalRate = getOrFetchHistoricalRate as Mock;
const mockFetchExchangeRate = fetchExchangeRate as Mock;
const mockResolvePartnershipEarns = resolvePartnershipEarns as Mock;
const prismaMock = prisma as unknown as {
  exchangeRateHistory: { findUnique: Mock };
  booking: { findMany: Mock; update: Mock };
  userStatus: { findMany: Mock };
  userPartnershipEarn: { findMany: Mock };
};

const pastDate = new Date("2024-06-01T00:00:00Z");
const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
const futureDateStr = futureDate.toISOString().split("T")[0];

const baseBooking = {
  currency: "USD",
  lockedExchangeRate: 1,
  checkIn: pastDate,
  loyaltyPointsEarned: 1000,
  pretaxCost: "100",
  hotelChain: {
    basePointRate: 10,
    userStatuses: [],
  },
  hotelChainSubBrand: null,
};

describe("enrichBookingWithRate", () => {
  describe("USD booking (past)", () => {
    it("returns stored exchangeRate of 1, isFutureEstimate=false, no loyalty estimation", async () => {
      const result = await enrichBookingWithRate(baseBooking);

      expect(result.lockedExchangeRate).toBe(1);
      expect(result.isFutureEstimate).toBe(false);
      expect(result.loyaltyPointsEstimated).toBe(false);
      expect(result.loyaltyPointsEarned).toBe(1000);
      expect(mockGetCurrentRate).not.toHaveBeenCalled();
    });
  });

  describe("past non-USD booking with stored rate", () => {
    beforeEach(() => {
      prismaMock.exchangeRateHistory.findUnique.mockResolvedValue({ rate: "0.65" });
    });

    it("uses the stored exchangeRate, no live lookup, isFutureEstimate=false", async () => {
      const booking = {
        ...baseBooking,
        currency: "EUR",
        lockedExchangeRate: 1.08,
        checkIn: pastDate,
        loyaltyPointsEarned: 800,
      };

      const result = await enrichBookingWithRate(booking);

      expect(result.lockedExchangeRate).toBe(1.08);
      expect(result.isFutureEstimate).toBe(false);
      expect(result.loyaltyPointsEstimated).toBe(false);
      expect(result.loyaltyPointsEarned).toBe(800);
      expect(mockGetCurrentRate).not.toHaveBeenCalled();
    });
  });

  describe("future non-USD booking (no stored rate)", () => {
    it("calls getCurrentRate, marks isFutureEstimate=true", async () => {
      mockGetCurrentRate.mockResolvedValueOnce(0.92);

      const booking = {
        ...baseBooking,
        currency: "EUR",
        lockedExchangeRate: null,
        checkIn: futureDateStr,
        loyaltyPointsEarned: 500,
      };

      const result = await enrichBookingWithRate(booking);

      expect(mockGetCurrentRate).toHaveBeenCalledWith("EUR");
      expect(result.lockedExchangeRate).toBe(0.92);
      expect(result.isFutureEstimate).toBe(true);
      expect(result.loyaltyPointsEstimated).toBe(false); // points already stored
      expect(result.loyaltyPointsEarned).toBe(500);
    });

    it("resolvedRate stays null when getCurrentRate returns null (no cached rate)", async () => {
      mockGetCurrentRate.mockResolvedValueOnce(null);

      const booking = {
        ...baseBooking,
        currency: "SGD",
        lockedExchangeRate: null,
        checkIn: futureDateStr,
        loyaltyPointsEarned: 0,
      };

      const result = await enrichBookingWithRate(booking);

      expect(result.lockedExchangeRate).toBeNull();
      expect(result.isFutureEstimate).toBe(true);
    });

    it("estimates loyalty points when loyaltyPointsEarned is null and rate is available", async () => {
      mockGetCurrentRate.mockResolvedValueOnce(0.74);
      mockCalculatePoints.mockReturnValueOnce(370);

      const booking = {
        ...baseBooking,
        currency: "SGD",
        lockedExchangeRate: null,
        checkIn: futureDateStr,
        loyaltyPointsEarned: null,
        pretaxCost: "500",
        hotelChain: {
          basePointRate: 10,
          userStatuses: [],
        },
      };

      const result = await enrichBookingWithRate(booking);

      expect(result.loyaltyPointsEstimated).toBe(true);
      expect(result.loyaltyPointsEarned).toBe(370);
      // USD pretax = 500 * 0.74 = 370; calculatePoints called with usdPretax
      expect(mockCalculatePoints).toHaveBeenCalledWith(
        expect.objectContaining({ pretaxCost: 500 * 0.74 })
      );
    });

    it("reads elite status from normalized userStatus (singular) when userStatuses array is absent", async () => {
      // This is the bug case: normalizeUserStatuses() converts userStatuses[] → userStatus
      // before enrichBookingWithRate is called, so the array is no longer present.
      mockGetCurrentRate.mockResolvedValueOnce(0.74);
      mockCalculatePoints.mockReturnValueOnce(648);

      const eliteStatus = { isFixed: false, bonusPercentage: 0.75, fixedRate: null };
      const booking = {
        ...baseBooking,
        currency: "SGD",
        lockedExchangeRate: null,
        checkIn: futureDateStr,
        loyaltyPointsEarned: null,
        pretaxCost: "500",
        hotelChain: {
          basePointRate: 10,
          // userStatus (singular) — the normalized form; no userStatuses array
          userStatus: { eliteStatus },
        },
      };

      await enrichBookingWithRate(booking);

      expect(mockCalculatePoints).toHaveBeenCalledWith(expect.objectContaining({ eliteStatus }));
    });

    it("uses subBrand basePointRate when available for estimated loyalty", async () => {
      mockGetCurrentRate.mockResolvedValueOnce(0.5);
      mockCalculatePoints.mockReturnValueOnce(200);

      const booking = {
        ...baseBooking,
        currency: "MYR",
        lockedExchangeRate: null,
        checkIn: futureDateStr,
        loyaltyPointsEarned: null,
        pretaxCost: "400",
        hotelChain: {
          basePointRate: 10,
          userStatuses: [],
        },
        hotelChainSubBrand: { basePointRate: "15" },
      };

      const result = await enrichBookingWithRate(booking);

      expect(mockCalculatePoints).toHaveBeenCalledWith(
        expect.objectContaining({ basePointRate: 15 })
      );
      expect(result.loyaltyPointsEstimated).toBe(true);
    });

    it("does not estimate loyalty when rate is unavailable", async () => {
      mockGetCurrentRate.mockResolvedValueOnce(null);

      const booking = {
        ...baseBooking,
        currency: "KRW",
        lockedExchangeRate: null,
        checkIn: futureDateStr,
        loyaltyPointsEarned: null,
      };

      const result = await enrichBookingWithRate(booking);

      expect(mockCalculatePoints).not.toHaveBeenCalled();
      expect(result.loyaltyPointsEarned).toBeNull();
      expect(result.loyaltyPointsEstimated).toBe(false);
    });

    it("passes calculationCurrency and calcCurrencyToUsdRate when chain uses non-USD rates", async () => {
      // KRW booking, chain with EUR calculationCurrency
      mockGetCurrentRate.mockResolvedValueOnce(0.00067); // KRW→USD rate
      mockResolveCalcCurrencyRate.mockResolvedValueOnce(1.1); // EUR→USD rate
      mockCalculatePoints.mockReturnValueOnce(175);

      const booking = {
        ...baseBooking,
        currency: "KRW",
        lockedExchangeRate: null,
        checkIn: futureDateStr,
        loyaltyPointsEarned: null,
        pretaxCost: "119000",
        hotelChain: {
          basePointRate: 1.25,
          calculationCurrency: "EUR",
          userStatuses: [],
        },
      };

      await enrichBookingWithRate(booking);

      expect(mockGetCurrentRate).toHaveBeenCalledWith("KRW");
      expect(mockResolveCalcCurrencyRate).toHaveBeenCalledWith("EUR");
      expect(mockCalculatePoints).toHaveBeenCalledWith(
        expect.objectContaining({
          calculationCurrency: "EUR",
          calcCurrencyToUsdRate: 1.1,
        })
      );
    });
  });

  describe("future USD booking (enrichBookingWithRate)", () => {
    it("uses stored exchangeRate=1 and is never a future estimate (USD)", async () => {
      const booking = {
        ...baseBooking,
        currency: "USD",
        lockedExchangeRate: 1,
        checkIn: futureDateStr,
        loyaltyPointsEarned: 200,
      };

      const result = await enrichBookingWithRate(booking);

      expect(result.isFutureEstimate).toBe(false);
      expect(result.lockedExchangeRate).toBe(1);
      expect(mockGetCurrentRate).not.toHaveBeenCalled();
    });
  });

  describe("exchangeRateEstimated (enrichBookingWithRate)", () => {
    const pastNonUsdBooking = {
      ...baseBooking,
      currency: "AUD",
      lockedExchangeRate: "0.63",
      checkIn: new Date("2022-01-15T00:00:00Z"), // very old, pre-API coverage
    };
    const pastNonUsdBookingNoLock = {
      ...pastNonUsdBooking,
      lockedExchangeRate: null,
    };

    it("is true when no ExchangeRateHistory exists for checkIn or checkIn-1 and no lockedExchangeRate", async () => {
      prismaMock.exchangeRateHistory.findUnique.mockResolvedValue(null);

      const result = await enrichBookingWithRate(pastNonUsdBookingNoLock);

      expect(result.exchangeRateEstimated).toBe(true);
    });

    it("is false when lockedExchangeRate is set (skips DB lookup entirely)", async () => {
      const result = await enrichBookingWithRate(pastNonUsdBooking);

      expect(result.exchangeRateEstimated).toBe(false);
      expect(prismaMock.exchangeRateHistory.findUnique).not.toHaveBeenCalled();
    });

    it("is false when ExchangeRateHistory exists for checkIn-1 (same-day check-in case)", async () => {
      // First call (checkIn date) returns null, second call (checkIn-1) returns a record
      prismaMock.exchangeRateHistory.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ rate: "0.63" });

      const result = await enrichBookingWithRate(pastNonUsdBookingNoLock);

      expect(result.exchangeRateEstimated).toBe(false);
    });

    it("is false when ExchangeRateHistory exists for checkIn date itself", async () => {
      prismaMock.exchangeRateHistory.findUnique.mockResolvedValueOnce({ rate: "0.63" });

      const result = await enrichBookingWithRate(pastNonUsdBookingNoLock);

      expect(result.exchangeRateEstimated).toBe(false);
    });

    it("is false for a USD booking", async () => {
      const result = await enrichBookingWithRate(baseBooking); // baseBooking is USD
      expect(result.exchangeRateEstimated).toBe(false);
      expect(prismaMock.exchangeRateHistory.findUnique).not.toHaveBeenCalled();
    });

    it("is false for a future non-USD booking", async () => {
      mockGetCurrentRate.mockResolvedValueOnce(0.63);
      const futureBooking = {
        ...baseBooking,
        currency: "AUD",
        lockedExchangeRate: null,
        checkIn: futureDate,
      };

      const result = await enrichBookingWithRate(futureBooking);

      expect(result.exchangeRateEstimated).toBe(false);
      expect(prismaMock.exchangeRateHistory.findUnique).not.toHaveBeenCalled();
    });
  });
});

// ---------------------------------------------------------------------------
// finalizeCheckedInBookings
// ---------------------------------------------------------------------------

const makePastBooking = (overrides: Record<string, unknown> = {}) => ({
  id: "booking-1",
  userId: "user-1",
  currency: "EUR",
  checkIn: new Date("2025-01-15T00:00:00Z"),
  pretaxCost: "100",
  loyaltyPointsEarned: null,
  hotelChain: null,
  hotelChainSubBrand: null,
  ...overrides,
});

describe("finalizeCheckedInBookings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.booking.update.mockResolvedValue({});
    prismaMock.userStatus.findMany.mockResolvedValue([]);
  });

  it("returns empty array when there are no past-due bookings", async () => {
    prismaMock.booking.findMany.mockResolvedValue([]);

    const result = await finalizeCheckedInBookings();

    expect(result).toEqual([]);
    expect(prismaMock.booking.update).not.toHaveBeenCalled();
  });

  it("locks the exchange rate and returns the booking id", async () => {
    prismaMock.booking.findMany.mockResolvedValue([makePastBooking()]);
    mockGetOrFetchHistoricalRate.mockResolvedValue(1.08);

    const result = await finalizeCheckedInBookings();

    expect(result).toEqual(["booking-1"]);
    expect(prismaMock.booking.update).toHaveBeenCalledWith({
      where: { id: "booking-1" },
      data: expect.objectContaining({ lockedExchangeRate: 1.08 }),
    });
  });

  it("skips a booking when the historical rate is unavailable", async () => {
    prismaMock.booking.findMany.mockResolvedValue([makePastBooking()]);
    mockGetOrFetchHistoricalRate.mockResolvedValue(null);

    const result = await finalizeCheckedInBookings();

    expect(result).toEqual([]);
    expect(prismaMock.booking.update).not.toHaveBeenCalled();
  });

  it("fetches userStatuses in a single batch query scoped to booking userId/hotelChainId pairs", async () => {
    const hotelChain = { id: "chain-1", basePointRate: 10, pointType: null };
    prismaMock.booking.findMany.mockResolvedValue([
      makePastBooking({ userId: "user-42", hotelChain }),
    ]);
    mockGetOrFetchHistoricalRate.mockResolvedValue(1.1);
    mockCalculatePoints.mockReturnValue(500);

    await finalizeCheckedInBookings();

    expect(prismaMock.userStatus.findMany).toHaveBeenCalledWith({
      where: { OR: [{ userId: "user-42", hotelChainId: "chain-1" }] },
      include: { eliteStatus: true },
    });
  });

  it("passes the fetched elite status into calculatePoints", async () => {
    const eliteStatus = { isFixed: false, bonusPercentage: 0.5, fixedRate: null };
    const hotelChain = { id: "chain-1", basePointRate: 10, pointType: null };
    prismaMock.booking.findMany.mockResolvedValue([
      makePastBooking({ userId: "user-1", hotelChain, pretaxCost: "200" }),
    ]);
    mockGetOrFetchHistoricalRate.mockResolvedValue(1.0);
    prismaMock.userStatus.findMany.mockResolvedValue([
      { userId: "user-1", hotelChainId: "chain-1", eliteStatus },
    ]);
    mockCalculatePoints.mockReturnValue(300);

    await finalizeCheckedInBookings();

    expect(mockCalculatePoints).toHaveBeenCalledWith(
      expect.objectContaining({ eliteStatus, pretaxCost: 200 })
    );
    expect(prismaMock.booking.update).toHaveBeenCalledWith({
      where: { id: "booking-1" },
      data: expect.objectContaining({ loyaltyPointsEarned: 300 }),
    });
  });

  it("does not recalculate loyalty points when already set on the booking", async () => {
    const hotelChain = { id: "chain-1", basePointRate: 10, pointType: null };
    prismaMock.booking.findMany.mockResolvedValue([
      makePastBooking({ hotelChain, loyaltyPointsEarned: 999 }),
    ]);
    mockGetOrFetchHistoricalRate.mockResolvedValue(1.0);

    await finalizeCheckedInBookings();

    expect(mockCalculatePoints).not.toHaveBeenCalled();
    expect(prismaMock.booking.update).toHaveBeenCalledWith({
      where: { id: "booking-1" },
      data: expect.objectContaining({ loyaltyPointsEarned: 999 }),
    });
  });

  it("locks lockedLoyaltyUsdCentsPerPoint for a foreign-currency point type", async () => {
    const pointType = { programCurrency: "EUR", programCentsPerPoint: "0.5" };
    const hotelChain = { id: "chain-1", basePointRate: 10, pointType };
    prismaMock.booking.findMany.mockResolvedValue([
      makePastBooking({ hotelChain, loyaltyPointsEarned: 100 }),
    ]);
    mockGetOrFetchHistoricalRate.mockResolvedValue(1.1);
    mockFetchExchangeRate.mockResolvedValue(1.08); // EUR→USD

    await finalizeCheckedInBookings();

    expect(mockFetchExchangeRate).toHaveBeenCalledWith("EUR", "2025-01-15");
    expect(prismaMock.booking.update).toHaveBeenCalledWith({
      where: { id: "booking-1" },
      data: expect.objectContaining({ lockedLoyaltyUsdCentsPerPoint: 0.5 * 1.08 }),
    });
  });

  it("continues processing remaining bookings after a per-booking error", async () => {
    prismaMock.booking.findMany.mockResolvedValue([
      makePastBooking({ id: "booking-bad" }),
      makePastBooking({ id: "booking-good" }),
    ]);
    mockGetOrFetchHistoricalRate
      .mockRejectedValueOnce(new Error("API down"))
      .mockResolvedValueOnce(1.05);

    const result = await finalizeCheckedInBookings();

    expect(result).toEqual(["booking-good"]);
    expect(prismaMock.booking.update).toHaveBeenCalledTimes(1);
  });

  it("scopes the findMany query to userId when provided", async () => {
    prismaMock.booking.findMany.mockResolvedValue([]);

    await finalizeCheckedInBookings("user-seed");

    expect(prismaMock.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: "user-seed" }),
      })
    );
  });

  it("does not include userId in the query when called without argument", async () => {
    prismaMock.booking.findMany.mockResolvedValue([]);

    await finalizeCheckedInBookings();

    const callArg = prismaMock.booking.findMany.mock.calls[0][0] as {
      where: Record<string, unknown>;
    };
    expect(callArg.where).not.toHaveProperty("userId");
  });
});

// ---------------------------------------------------------------------------
// enrichBookingsWithPartnerships
// ---------------------------------------------------------------------------

const makeBookingForEnrich = (id: string) => ({
  ...baseBooking,
  id,
  hotelChainId: "chain-1",
  property: { countryCode: "US" },
});

const makeEarnRow = (overrides: Record<string, unknown> = {}) => ({
  partnershipEarn: {
    id: "earn-1",
    name: "Qantas",
    hotelChainId: null,
    earnRate: "3.5",
    earnCurrency: "AUD",
    countryCodes: [],
    pointType: {
      name: "Qantas Points",
      shortName: "QF",
      category: "airline",
      usdCentsPerPoint: "1.5",
    },
    ...overrides,
  },
});

describe("enrichBookingsWithPartnerships", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveCalcCurrencyRate.mockResolvedValue(null);
    prismaMock.userPartnershipEarn.findMany.mockResolvedValue([]);
  });

  it("fetches enabled earns scoped to the given userId", async () => {
    await enrichBookingsWithPartnerships([makeBookingForEnrich("b1")], "user-42");

    expect(prismaMock.userPartnershipEarn.findMany).toHaveBeenCalledWith({
      where: { userId: "user-42", isEnabled: true },
      include: { partnershipEarn: { include: { pointType: true } } },
    });
  });

  it("fetches enabled earns only once even for multiple bookings", async () => {
    const bookings = [makeBookingForEnrich("b1"), makeBookingForEnrich("b2")];

    await enrichBookingsWithPartnerships(bookings, "user-1");

    expect(prismaMock.userPartnershipEarn.findMany).toHaveBeenCalledTimes(1);
  });

  it("returns each booking with partnershipEarns attached", async () => {
    const earnResult = [{ id: "earn-1", name: "Qantas", pointsEarned: 100, earnedValue: 1.5 }];
    mockResolvePartnershipEarns.mockResolvedValue(earnResult);
    prismaMock.userPartnershipEarn.findMany.mockResolvedValue([makeEarnRow()]);

    const bookings = [makeBookingForEnrich("b1")];
    const result = await enrichBookingsWithPartnerships(bookings, "user-1");

    expect(result).toHaveLength(1);
    expect(result[0].partnershipEarns).toEqual(earnResult);
  });

  it("passes earnRate and usdCentsPerPoint as numbers to resolvePartnershipEarns", async () => {
    prismaMock.userPartnershipEarn.findMany.mockResolvedValue([makeEarnRow()]);

    await enrichBookingsWithPartnerships([makeBookingForEnrich("b1")], "user-1");

    expect(mockResolvePartnershipEarns).toHaveBeenCalledWith(
      expect.anything(),
      expect.arrayContaining([
        expect.objectContaining({
          earnRate: 3.5,
          pointType: expect.objectContaining({ usdCentsPerPoint: 1.5 }),
        }),
      ])
    );
  });

  it("returns an empty array when given no bookings", async () => {
    const result = await enrichBookingsWithPartnerships([], "user-1");
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// enrichBookingWithPartnerships
// ---------------------------------------------------------------------------

describe("enrichBookingWithPartnerships", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveCalcCurrencyRate.mockResolvedValue(null);
    prismaMock.userPartnershipEarn.findMany.mockResolvedValue([]);
  });

  it("returns the booking with partnershipEarns attached", async () => {
    const earnResult = [{ id: "earn-1", name: "Qantas", pointsEarned: 50, earnedValue: 0.75 }];
    mockResolvePartnershipEarns.mockResolvedValue(earnResult);
    prismaMock.userPartnershipEarn.findMany.mockResolvedValue([makeEarnRow()]);

    const result = await enrichBookingWithPartnerships(makeBookingForEnrich("b1"), "user-1");

    expect(result.partnershipEarns).toEqual(earnResult);
  });

  it("fetches enabled earns scoped to the given userId", async () => {
    await enrichBookingWithPartnerships(makeBookingForEnrich("b1"), "user-99");

    expect(prismaMock.userPartnershipEarn.findMany).toHaveBeenCalledWith({
      where: { userId: "user-99", isEnabled: true },
      include: { partnershipEarn: { include: { pointType: true } } },
    });
  });
});
