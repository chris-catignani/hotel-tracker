import { describe, it, expect, vi, beforeEach } from "vitest";
import { ingestBookingFromEmail } from "@/lib/email-ingestion/ingest-booking";
import type { ParsedBookingData } from "@/lib/email-ingestion/types";

const {
  mockBookingCreate,
  mockBookingFindFirst,
  mockHotelChainFindFirst,
  mockUserStatusFindFirst,
} = vi.hoisted(() => ({
  mockBookingCreate: vi.fn().mockResolvedValue({ id: "booking-abc" }),
  mockBookingFindFirst: vi.fn().mockResolvedValue(null),
  mockHotelChainFindFirst: vi.fn().mockResolvedValue({
    id: "chain-hyatt",
    basePointRate: 5,
    calculationCurrency: "USD",
    pointType: null,
  }),
  mockUserStatusFindFirst: vi.fn().mockResolvedValue({
    eliteStatus: {
      bonusPercentage: 30,
      fixedRate: null,
      isFixed: false,
      pointsFloorTo: null,
    },
  }),
}));

vi.mock("@/lib/property-utils", () => ({
  findOrCreateProperty: vi.fn().mockResolvedValue("prop-123"),
}));
vi.mock("@/lib/loyalty-utils", () => ({
  calculatePoints: vi.fn().mockReturnValue(1200),
  resolveBasePointRate: vi.fn().mockReturnValue(5),
}));
vi.mock("@/lib/exchange-rate", () => ({
  getOrFetchHistoricalRate: vi.fn().mockResolvedValue(1.0),
  getCurrentRate: vi.fn().mockResolvedValue(1.0),
}));
vi.mock("@/lib/promotion-matching", () => ({
  matchPromotionsForBooking: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    booking: { create: mockBookingCreate, findFirst: mockBookingFindFirst },
    hotelChain: { findFirst: mockHotelChainFindFirst },
    userStatus: { findFirst: mockUserStatusFindFirst },
  },
}));

const baseParsed: ParsedBookingData = {
  propertyName: "Hyatt Regency Salt Lake City",
  checkIn: "2027-01-14",
  checkOut: "2027-01-18",
  numNights: 4,
  bookingType: "cash",
  confirmationNumber: "64167883",
  currency: "USD",
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
  });

  it("creates a booking and returns its id", async () => {
    const result = await ingestBookingFromEmail(baseParsed, "user-1", "Hyatt");
    expect(result).toEqual({ bookingId: "booking-abc", duplicate: false });
    expect(mockBookingCreate).toHaveBeenCalledOnce();
    const createArg = mockBookingCreate.mock.calls[0][0].data;
    expect(createArg.ingestionMethod).toBe("email");
    expect(createArg.needsReview).toBe(true);
    expect(createArg.confirmationNumber).toBe("64167883");
  });

  it("returns duplicate=true when same conf number AND same booking details", async () => {
    mockBookingFindFirst.mockResolvedValueOnce({ id: "existing-booking" });
    const result = await ingestBookingFromEmail(baseParsed, "user-1", "Hyatt");
    expect(result).toEqual({ bookingId: "existing-booking", duplicate: true });
    expect(mockBookingCreate).not.toHaveBeenCalled();
    // Verify the where clause includes all 5 matching fields
    const whereClause = mockBookingFindFirst.mock.calls[0][0].where;
    expect(whereClause.confirmationNumber).toBe("64167883");
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
});
