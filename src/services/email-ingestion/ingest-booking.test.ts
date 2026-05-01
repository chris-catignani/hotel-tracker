import { describe, it, expect, vi, beforeEach } from "vitest";
import { ingestBookingFromEmail } from "@/services/email-ingestion/ingest-booking";
import type { ParsedBookingData } from "@/services/email-ingestion/types";

const {
  mockBookingCreate,
  mockBookingUpdate,
  mockBookingFindFirst,
  mockHotelChainFindFirst,
  mockHotelChainFindUnique,
  mockUserStatusFindUnique,
  mockOtaAgencyFindFirst,
} = vi.hoisted(() => ({
  mockBookingCreate: vi.fn().mockResolvedValue({ id: "booking-abc" }),
  mockBookingUpdate: vi.fn().mockResolvedValue({ id: "booking-abc" }),
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

vi.mock("@/services/property-utils", () => ({
  findOrCreateProperty: vi.fn().mockResolvedValue("prop-123"),
}));
vi.mock("@/services/geo-lookup", () => ({
  searchPlaces: vi.fn().mockResolvedValue([]),
  searchLocalProperties: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/lib/loyalty-utils", () => ({
  calculatePoints: vi.fn().mockReturnValue(1200),
  resolveBasePointRate: vi.fn().mockReturnValue(5),
}));
vi.mock("@/services/exchange-rate", () => ({
  getOrFetchHistoricalRate: vi.fn().mockResolvedValue(1.0),
  getCurrentRate: vi.fn().mockResolvedValue(1.0),
  fetchExchangeRate: vi.fn().mockResolvedValue(1.0),
  resolveCalcCurrencyRate: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/services/booking.service", () => ({
  runPostBookingCreate: vi.fn().mockResolvedValue(undefined),
  updateBooking: vi.fn().mockResolvedValue({ id: "booking-abc" }),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    booking: {
      create: mockBookingCreate,
      update: mockBookingUpdate,
      findFirst: mockBookingFindFirst,
    },
    hotelChain: { findFirst: mockHotelChainFindFirst, findUnique: mockHotelChainFindUnique },
    userStatus: { findUnique: mockUserStatusFindUnique },
    hotelChainSubBrand: { findMany: vi.fn().mockResolvedValue([]) },
    otaAgency: { findFirst: mockOtaAgencyFindFirst },
  },
}));

vi.mock("@/services/email-ingestion/email-parser", () => ({
  matchSubBrand: vi.fn().mockResolvedValue(null),
}));

const baseParsed: ParsedBookingData = {
  propertyName: "Hyatt Regency Salt Lake City",
  propertyAddress: null,
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
  taxLines: [{ label: "Taxes", amount: 98.5 }],
  discounts: null,
  totalCost: 689.54,
  pointsRedeemed: null,
  certsRedeemed: null,
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
    expect(result).toEqual({ bookingId: "booking-abc", duplicate: false, updated: false });
    expect(mockBookingCreate).toHaveBeenCalledOnce();
    const createArg = mockBookingCreate.mock.calls[0][0].data;
    expect(createArg.ingestionMethod).toBe("email");
    expect(createArg.needsReview).toBe(true);
    expect(createArg.confirmationNumber).toBe("73829461");
  });

  it("returns duplicate=true when same conf number AND same booking details", async () => {
    mockBookingFindFirst.mockResolvedValueOnce({
      id: "existing-booking",
      checkIn: new Date("2027-01-14"),
      checkOut: new Date("2027-01-18"),
      totalCost: 689.54,
      pointsRedeemed: null,
    });
    const result = await ingestBookingFromEmail(baseParsed, "user-1", "Hyatt");
    expect(result).toEqual({ bookingId: "existing-booking", duplicate: true, updated: false });
    expect(mockBookingCreate).not.toHaveBeenCalled();
    // Verify the where clause includes matching fields
    const whereClause = mockBookingFindFirst.mock.calls[0][0].where;
    expect(whereClause.confirmationNumber).toBe("73829461");
    expect(whereClause.userId).toBe("user-1");
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
        taxLines: null,
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
    const { getOrFetchHistoricalRate } = await import("@/services/exchange-rate");
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
    const { getOrFetchHistoricalRate } = await import("@/services/exchange-rate");

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

    const { getOrFetchHistoricalRate } = await import("@/services/exchange-rate");
    vi.mocked(getOrFetchHistoricalRate).mockResolvedValueOnce(1.1); // EUR/USD = 1.1

    const result = await ingestBookingFromEmail(
      { ...baseParsed, checkIn: "2024-01-10", checkOut: "2024-01-14" },
      "user-1",
      "Accor"
    );

    expect(result.duplicate).toBe(false);
    expect(getOrFetchHistoricalRate).toHaveBeenCalledWith("EUR", "2024-01-10");
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

  it("resolves hotel property via searchLocalProperties and uses matched propertyId directly", async () => {
    const { searchLocalProperties } = await import("@/services/geo-lookup");
    const { findOrCreateProperty } = await import("@/services/property-utils");
    vi.mocked(searchLocalProperties).mockResolvedValueOnce([
      {
        source: "local",
        propertyId: "local-prop-456",
        hotelChainId: "chain-hyatt",
        displayName: "Hyatt Regency Salt Lake City",
        city: "Salt Lake City",
        countryCode: "US",
        address: "170 South West Temple, Salt Lake City, UT 84101",
        latitude: 40.7608,
        longitude: -111.8911,
      },
    ]);

    await ingestBookingFromEmail(baseParsed, "user-1", "Hyatt");

    expect(searchLocalProperties).toHaveBeenCalledWith(baseParsed.propertyName, "chain-hyatt");
    expect(findOrCreateProperty).not.toHaveBeenCalled();
    const data = mockBookingCreate.mock.calls[0][0].data;
    expect(data.propertyId).toBe("local-prop-456");
  });

  it("sets propertyId to null when no local property match found for a hotel booking", async () => {
    await ingestBookingFromEmail(baseParsed, "user-1", "Hyatt");
    const data = mockBookingCreate.mock.calls[0][0].data;
    expect(data.propertyId).toBeNull();
  });

  it("does not call searchPlaces for hotel bookings", async () => {
    const { searchPlaces } = await import("@/services/geo-lookup");
    await ingestBookingFromEmail(baseParsed, "user-1", "Hyatt");
    expect(searchPlaces).not.toHaveBeenCalled();
  });

  it("uses propertyAddress (not propertyName) for apartment geo lookup via searchPlaces", async () => {
    const { searchPlaces } = await import("@/services/geo-lookup");
    const address = "135 Hallenstein Street, Queenstown 9300, New Zealand";
    await ingestBookingFromEmail(
      { ...baseParsed, accommodationType: "apartment", propertyAddress: address },
      "user-1",
      null
    );
    expect(searchPlaces).toHaveBeenCalledWith(address, false);
  });

  it("falls back to propertyName for apartment geo lookup when propertyAddress is null", async () => {
    const { searchPlaces } = await import("@/services/geo-lookup");
    await ingestBookingFromEmail(
      { ...baseParsed, accommodationType: "apartment", propertyAddress: null },
      "user-1",
      null
    );
    expect(searchPlaces).toHaveBeenCalledWith(baseParsed.propertyName, false);
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

  it("derives pretaxCost from totalCost - taxAmount when Claude returns pretaxCost null (Airbnb discounts)", async () => {
    await ingestBookingFromEmail(
      {
        ...baseParsed,
        pretaxCost: null,
        taxLines: [{ label: "Taxes and fees", amount: 69.17 }],
        totalCost: 1038.78,
      },
      "user-1",
      null
    );
    const data = mockBookingCreate.mock.calls[0][0].data;
    expect(data.pretaxCost).toBe(969.61);
    expect(data.taxAmount).toBe(69.17);
    expect(data.totalCost).toBe(1038.78);
  });

  it("computes net taxAmount and pretaxCost using fee and accommodation discounts (no nightlyRates)", async () => {
    await ingestBookingFromEmail(
      {
        ...baseParsed,
        nightlyRates: null,
        pretaxCost: null,
        taxLines: [{ label: "Taxes and fees", amount: 69.17 }],
        totalCost: 1038.78,
        discounts: [
          { label: "Special offer", amount: 247.0, type: "accommodation" },
          { label: "Airbnb monthly stay savings", amount: 31.02, type: "fee" },
        ],
      },
      "user-1",
      null
    );
    const data = mockBookingCreate.mock.calls[0][0].data;
    // netTax = 69.17 - 31.02 = 38.15
    // pretaxCost = 1038.78 - 38.15 = 1000.63
    expect(data.taxAmount).toBe(38.15);
    expect(data.pretaxCost).toBe(1000.63);
  });

  it("logs a warning when Method A (nightlyRates - accommodation discounts) disagrees with Method B (totalCost - netTax) beyond tolerance", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    await ingestBookingFromEmail(
      {
        ...baseParsed,
        // nightlyRates sum = 44.56 × 28 = 1247.68; Method A = 1247.68 - 100.00 = 1147.68
        nightlyRates: Array.from({ length: 28 }, () => ({ amount: 44.56 })),
        pretaxCost: null,
        taxLines: [{ label: "Taxes and fees", amount: 69.17 }],
        totalCost: 1038.78,
        discounts: [
          { label: "Special offer", amount: 100.0, type: "accommodation" }, // deliberately wrong
          { label: "Airbnb monthly stay savings", amount: 31.02, type: "fee" },
        ],
      },
      "user-1",
      null
    );
    // Method B: 1038.78 - (69.17 - 31.02) = 1000.63
    // Method A: 1247.68 - 100.00 = 1147.68 → discrepancy 147.05 > 0.10 → warn
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("pretaxCost mismatch"));
    const data = mockBookingCreate.mock.calls[0][0].data;
    // Method B is authoritative
    expect(data.pretaxCost).toBe(1000.63);
    warnSpy.mockRestore();
  });

  it("does not warn when Method A and Method B agree within tolerance", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    await ingestBookingFromEmail(
      {
        ...baseParsed,
        // 28 × 44.56 = 1247.68; Method A = 1247.68 - 247.00 = 1000.68
        // Method B = 1038.78 - (69.17 - 31.02) = 1000.63 → diff = 0.05 < 0.10
        nightlyRates: Array.from({ length: 28 }, () => ({ amount: 44.56 })),
        pretaxCost: null,
        taxLines: [{ label: "Taxes and fees", amount: 69.17 }],
        totalCost: 1038.78,
        discounts: [
          { label: "Special offer", amount: 247.0, type: "accommodation" },
          { label: "Airbnb monthly stay savings", amount: 31.02, type: "fee" },
        ],
      },
      "user-1",
      null
    );
    expect(warnSpy).not.toHaveBeenCalledWith(expect.stringContaining("pretaxCost mismatch"));
    warnSpy.mockRestore();
  });

  it("uses discount-aware path and treats taxAmount as 0 when discounts present but taxLines absent", async () => {
    await ingestBookingFromEmail(
      {
        ...baseParsed,
        nightlyRates: null,
        pretaxCost: null,
        taxLines: null,
        totalCost: 800.0,
        discounts: [{ label: "Special offer", amount: 200.0, type: "accommodation" }],
      },
      "user-1",
      null
    );
    const data = mockBookingCreate.mock.calls[0][0].data;
    // No tax lines → parsedTaxAmount = null → treated as 0
    // feeDiscountsTotal = 0 (discount is accommodation type)
    // taxAmount = (0) - 0 = 0
    // pretaxCost = 800.00 - 0 = 800.00
    expect(data.taxAmount).toBe(0);
    expect(data.pretaxCost).toBe(800.0);
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
        taxLines: null,
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

  it("updates existing booking when confirmation number matches but details differ", async () => {
    mockBookingFindFirst.mockResolvedValueOnce({
      id: "existing-id",
      checkIn: new Date("2027-01-14"),
      checkOut: new Date("2027-01-18"),
      totalCost: 100.0, // Different from baseParsed (689.54)
      pointsRedeemed: null,
    });

    const result = await ingestBookingFromEmail(baseParsed, "user-1", "Hyatt");

    expect(result).toEqual({ bookingId: "existing-id", duplicate: false, updated: true });

    const { updateBooking } = await import("@/services/booking.service");
    expect(updateBooking).toHaveBeenCalledOnce();
    const args = vi.mocked(updateBooking).mock.calls[0];
    expect(args[0]).toBe("existing-id");
    expect(args[1]).toBe("user-1");
    expect(args[2].totalCost).toBe(689.54);
    expect(args[2].needsReview).toBe(true);
  });

  it("calls updateBooking instead of runPostBookingCreate directly on update", async () => {
    mockBookingFindFirst.mockResolvedValueOnce({
      id: "existing-id",
      checkIn: new Date("2027-01-14"),
      checkOut: new Date("2027-01-18"),
      totalCost: 100.0,
      pointsRedeemed: null,
    });

    await ingestBookingFromEmail(baseParsed, "user-1", "Hyatt");

    const { updateBooking, runPostBookingCreate } = await import("@/services/booking.service");
    expect(updateBooking).toHaveBeenCalledWith("existing-id", "user-1", expect.any(Object));
    // updateBooking handles the post-update logic internally, so ingest-booking shouldn't call runPostBookingCreate
    expect(runPostBookingCreate).not.toHaveBeenCalled();
  });
});
