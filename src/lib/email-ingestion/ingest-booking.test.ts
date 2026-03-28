import { describe, it, expect, vi, beforeEach } from "vitest";
import { ingestBookingFromEmail } from "@/lib/email-ingestion/ingest-booking";
import type { ParsedBookingData } from "@/lib/email-ingestion/types";

const {
  mockBookingCreate,
  mockBookingFindFirst,
  mockHotelChainFindFirst,
  mockHotelChainFindUnique,
  mockUserStatusFindUnique,
  mockOtaAgencyFindFirst,
} = vi.hoisted(() => ({
  mockBookingCreate: vi.fn().mockResolvedValue({ id: "booking-abc" }),
  mockBookingFindFirst: vi.fn().mockResolvedValue(null),
  mockHotelChainFindFirst: vi.fn().mockResolvedValue({
    id: "chain-hyatt",
    basePointRate: 5,
    calculationCurrency: "USD",
    pointType: null,
  }),
  mockHotelChainFindUnique: vi.fn().mockResolvedValue({
    id: "chain-hyatt",
    basePointRate: 5,
    calculationCurrency: "USD",
    pointType: null,
  }),
  mockUserStatusFindUnique: vi.fn().mockResolvedValue({
    eliteStatus: {
      bonusPercentage: 30,
      fixedRate: null,
      isFixed: false,
      pointsFloorTo: null,
    },
  }),
  mockOtaAgencyFindFirst: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/property-utils", () => ({
  findOrCreateProperty: vi.fn().mockResolvedValue("prop-123"),
}));
vi.mock("@/lib/geo-lookup", () => ({
  searchProperties: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/lib/loyalty-utils", () => ({
  calculatePoints: vi.fn().mockReturnValue(1200),
  resolveBasePointRate: vi.fn().mockReturnValue(5),
}));
vi.mock("@/lib/exchange-rate", () => ({
  getOrFetchHistoricalRate: vi.fn().mockResolvedValue(1.0),
  getCurrentRate: vi.fn().mockResolvedValue(1.0),
  fetchExchangeRate: vi.fn().mockResolvedValue(1.0),
  resolveCalcCurrencyRate: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/promotion-matching", () => ({
  matchPromotionsForBooking: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    booking: { create: mockBookingCreate, findFirst: mockBookingFindFirst },
    hotelChain: { findFirst: mockHotelChainFindFirst, findUnique: mockHotelChainFindUnique },
    userStatus: { findUnique: mockUserStatusFindUnique },
    hotelChainSubBrand: { findMany: vi.fn().mockResolvedValue([]) },
    otaAgency: { findFirst: mockOtaAgencyFindFirst },
  },
}));

vi.mock("@/lib/email-ingestion/email-parser", () => ({
  matchSubBrand: vi.fn().mockResolvedValue(null),
}));

const baseParsed: ParsedBookingData = {
  propertyName: "Hyatt Regency Salt Lake City",
  checkIn: "2027-01-14",
  checkOut: "2027-01-18",
  numNights: 4,
  bookingType: "cash",
  confirmationNumber: "73829461",
  hotelChain: null,
  subBrand: null,
  currency: "USD",
  nightlyRates: null,
  pretaxCost: 591.04,
  taxAmount: 98.5,
  totalCost: 689.54,
  pointsRedeemed: null,
};

describe("ingestBookingFromEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBookingFindFirst.mockResolvedValue(null);
    mockBookingCreate.mockResolvedValue({ id: "booking-abc" });
    mockHotelChainFindUnique.mockResolvedValue({
      id: "chain-hyatt",
      basePointRate: 5,
      calculationCurrency: "USD",
      pointType: null,
    });
    mockUserStatusFindUnique.mockResolvedValue({
      eliteStatus: {
        bonusPercentage: 30,
        fixedRate: null,
        isFixed: false,
        pointsFloorTo: null,
      },
    });
  });

  it("creates a booking and returns its id", async () => {
    const result = await ingestBookingFromEmail(baseParsed, "user-1", "Hyatt");
    expect(result).toEqual({ bookingId: "booking-abc", duplicate: false });
    expect(mockBookingCreate).toHaveBeenCalledOnce();
    const createArg = mockBookingCreate.mock.calls[0][0].data;
    expect(createArg.ingestionMethod).toBe("email");
    expect(createArg.needsReview).toBe(true);
    expect(createArg.confirmationNumber).toBe("73829461");
  });

  it("returns duplicate=true when same conf number AND same booking details", async () => {
    mockBookingFindFirst.mockResolvedValueOnce({ id: "existing-booking" });
    const result = await ingestBookingFromEmail(baseParsed, "user-1", "Hyatt");
    expect(result).toEqual({ bookingId: "existing-booking", duplicate: true });
    expect(mockBookingCreate).not.toHaveBeenCalled();
    // Verify the where clause includes all 5 matching fields
    const whereClause = mockBookingFindFirst.mock.calls[0][0].where;
    expect(whereClause.confirmationNumber).toBe("73829461");
    expect(whereClause.checkIn).toEqual(new Date("2027-01-14"));
    expect(whereClause.checkOut).toEqual(new Date("2027-01-18"));
    expect(whereClause.totalCost).toBe(689.54);
  });

  it("creates a new booking when conf number matches but dates differ (modification email)", async () => {
    // findFirst returns null (no match with new dates) → should create
    mockBookingFindFirst.mockResolvedValueOnce(null);
    const result = await ingestBookingFromEmail(
      { ...baseParsed, checkIn: "2027-02-01", checkOut: "2027-02-05" },
      "user-1",
      "Hyatt"
    );
    expect(result.duplicate).toBe(false);
    expect(mockBookingCreate).toHaveBeenCalledOnce();
  });

  it("still creates booking if confirmationNumber is null (no duplicate check possible)", async () => {
    const result = await ingestBookingFromEmail(
      { ...baseParsed, confirmationNumber: null },
      "user-1",
      "Hyatt"
    );
    expect(result.duplicate).toBe(false);
    expect(mockBookingCreate).toHaveBeenCalledOnce();
  });

  it("creates a points booking with pointsRedeemed set and no loyalty points earned", async () => {
    const result = await ingestBookingFromEmail(
      {
        ...baseParsed,
        bookingType: "points",
        pointsRedeemed: 25000,
        pretaxCost: null,
        taxAmount: null,
        totalCost: null,
        currency: null,
      },
      "user-1",
      "Hyatt"
    );
    expect(result.duplicate).toBe(false);
    expect(mockBookingCreate).toHaveBeenCalledOnce();
    const data = mockBookingCreate.mock.calls[0][0].data;
    expect(data.pointsRedeemed).toBe(25000);
    expect(data.loyaltyPointsEarned).toBeNull();
    // loyalty points NOT calculated for points bookings
    const { calculatePoints } = await import("@/lib/loyalty-utils");
    expect(vi.mocked(calculatePoints)).not.toHaveBeenCalled();
  });

  it("locks exchange rate for non-USD past check-in", async () => {
    const { getOrFetchHistoricalRate } = await import("@/lib/exchange-rate");
    vi.mocked(getOrFetchHistoricalRate).mockResolvedValueOnce(1.35);

    const result = await ingestBookingFromEmail(
      { ...baseParsed, currency: "SGD", checkIn: "2024-01-10", checkOut: "2024-01-14" },
      "user-1",
      "Hyatt"
    );
    expect(result.duplicate).toBe(false);
    expect(getOrFetchHistoricalRate).toHaveBeenCalledWith("SGD", "2024-01-10");
    const data = mockBookingCreate.mock.calls[0][0].data;
    expect(data.lockedExchangeRate).toBe(1.35);
  });

  it("does not lock exchange rate for future non-USD check-in", async () => {
    const { getOrFetchHistoricalRate } = await import("@/lib/exchange-rate");

    const result = await ingestBookingFromEmail(
      { ...baseParsed, currency: "EUR", checkIn: "2099-01-10", checkOut: "2099-01-14" },
      "user-1",
      "Hyatt"
    );
    expect(result.duplicate).toBe(false);
    expect(getOrFetchHistoricalRate).not.toHaveBeenCalled();
    const data = mockBookingCreate.mock.calls[0][0].data;
    expect(data.lockedExchangeRate).toBeNull();
  });

  it("locks lockedLoyaltyUsdCentsPerPoint for a past stay with a foreign-currency program", async () => {
    // Simulate a chain with a EUR-denominated points program
    mockHotelChainFindUnique.mockImplementation(
      (args: { where?: { id?: string }; select?: unknown }) => {
        if (args.select) {
          // Called for lockedLoyaltyUsdCentsPerPoint lookup
          return Promise.resolve({
            pointType: { programCurrency: "EUR", programCentsPerPoint: 2.0 },
          });
        }
        return Promise.resolve({
          id: "chain-accor",
          basePointRate: 10,
          calculationCurrency: "EUR",
          pointType: null,
        });
      }
    );

    const { fetchExchangeRate } = await import("@/lib/exchange-rate");
    vi.mocked(fetchExchangeRate).mockResolvedValueOnce(1.1); // EUR/USD = 1.1

    const result = await ingestBookingFromEmail(
      { ...baseParsed, checkIn: "2024-01-10", checkOut: "2024-01-14" },
      "user-1",
      "Accor"
    );

    expect(result.duplicate).toBe(false);
    expect(fetchExchangeRate).toHaveBeenCalledWith("EUR", "2024-01-10");
    const data = mockBookingCreate.mock.calls[0][0].data;
    expect(data.lockedLoyaltyUsdCentsPerPoint).toBeCloseTo(2.2); // 2.0 * 1.1
  });

  it("sums nightlyRates in code for pretaxCost when provided", async () => {
    const result = await ingestBookingFromEmail(
      {
        ...baseParsed,
        nightlyRates: [{ amount: 160.72 }, { amount: 142.1 }, { amount: 142.1 }, { amount: 142.1 }],
        pretaxCost: null,
      },
      "user-1",
      null
    );
    expect(result.duplicate).toBe(false);
    const data = mockBookingCreate.mock.calls[0][0].data;
    expect(data.pretaxCost).toBe(587.02);
  });

  it("falls back to pretaxCost when nightlyRates is null", async () => {
    const result = await ingestBookingFromEmail(baseParsed, "user-1", null);
    expect(result.duplicate).toBe(false);
    const data = mockBookingCreate.mock.calls[0][0].data;
    expect(data.pretaxCost).toBe(591.04);
  });

  it("defaults accommodationType to hotel when not provided in parsed data", async () => {
    await ingestBookingFromEmail(baseParsed, "user-1", null);
    const data = mockBookingCreate.mock.calls[0][0].data;
    expect(data.accommodationType).toBe("hotel");
  });

  it("uses accommodationType from parsed data when provided", async () => {
    await ingestBookingFromEmail({ ...baseParsed, accommodationType: "apartment" }, "user-1", null);
    const data = mockBookingCreate.mock.calls[0][0].data;
    expect(data.accommodationType).toBe("apartment");
  });

  it("geo-enriches the property using searchProperties and passes geo fields to findOrCreateProperty", async () => {
    const { searchProperties } = await import("@/lib/geo-lookup");
    const { findOrCreateProperty } = await import("@/lib/property-utils");
    vi.mocked(searchProperties).mockResolvedValueOnce([
      {
        placeId: "gplace-123",
        displayName: "Kimpton Margot Sydney",
        city: "Sydney",
        countryCode: "AU",
        address: "339 Pitt Street, Sydney NSW 2000, Australia",
        latitude: -33.8734,
        longitude: 151.2059,
      },
    ]);

    await ingestBookingFromEmail(baseParsed, "user-1", null);

    expect(searchProperties).toHaveBeenCalledWith(baseParsed.propertyName, true);
    expect(findOrCreateProperty).toHaveBeenCalledWith(
      expect.objectContaining({
        propertyName: "Kimpton Margot Sydney",
        placeId: "gplace-123",
        city: "Sydney",
        countryCode: "AU",
        address: "339 Pitt Street, Sydney NSW 2000, Australia",
        latitude: -33.8734,
        longitude: 151.2059,
      })
    );
  });

  it("falls back to parsed propertyName when geo lookup returns no results", async () => {
    const { findOrCreateProperty } = await import("@/lib/property-utils");
    await ingestBookingFromEmail(baseParsed, "user-1", null);
    expect(findOrCreateProperty).toHaveBeenCalledWith(
      expect.objectContaining({ propertyName: baseParsed.propertyName })
    );
  });

  it("uses isHotel=false for apartment geo lookup", async () => {
    const { searchProperties } = await import("@/lib/geo-lookup");
    await ingestBookingFromEmail({ ...baseParsed, accommodationType: "apartment" }, "user-1", null);
    expect(searchProperties).toHaveBeenCalledWith(baseParsed.propertyName, false);
  });

  it("sets bookingSource to ota and resolves otaAgencyId when otaAgencyName is provided", async () => {
    mockOtaAgencyFindFirst.mockResolvedValueOnce({ id: "ota-amex-thc" });
    await ingestBookingFromEmail({ ...baseParsed, otaAgencyName: "AMEX THC" }, "user-1", null);
    const data = mockBookingCreate.mock.calls[0][0].data;
    expect(data.bookingSource).toBe("ota");
    expect(data.otaAgencyId).toBe("ota-amex-thc");
    expect(mockOtaAgencyFindFirst).toHaveBeenCalledWith({
      where: { name: { equals: "AMEX THC", mode: "insensitive" } },
    });
  });

  it("leaves bookingSource null when no otaAgencyName", async () => {
    await ingestBookingFromEmail(baseParsed, "user-1", null);
    const data = mockBookingCreate.mock.calls[0][0].data;
    expect(data.bookingSource).toBeNull();
    expect(data.otaAgencyId).toBeNull();
  });

  it("derives taxAmount from totalCost - pretaxCost when nightlyRates is present", async () => {
    const result = await ingestBookingFromEmail(
      {
        ...baseParsed,
        nightlyRates: [
          { amount: 294.98 },
          { amount: 319.2 },
          { amount: 270.75 },
          { amount: 270.75 },
          { amount: 270.75 },
        ],
        pretaxCost: null,
        taxAmount: null,
        totalCost: 1683.19,
      },
      "user-1",
      null
    );
    expect(result.duplicate).toBe(false);
    const data = mockBookingCreate.mock.calls[0][0].data;
    expect(data.pretaxCost).toBe(1426.43);
    expect(data.taxAmount).toBe(256.76);
  });
});
