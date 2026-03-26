import { describe, it, expect, vi, beforeEach } from "vitest";
import { ingestBookingFromEmail } from "@/lib/email-ingestion/ingest-booking";
import type { ParsedBookingData } from "@/lib/email-ingestion/types";

const {
  mockBookingCreate,
  mockBookingFindFirst,
  mockHotelChainFindFirst,
  mockUserEliteStatusFindFirst,
} = vi.hoisted(() => ({
  mockBookingCreate: vi.fn().mockResolvedValue({ id: "booking-abc" }),
  mockBookingFindFirst: vi.fn().mockResolvedValue(null),
  mockHotelChainFindFirst: vi.fn().mockResolvedValue({
    id: "chain-hyatt",
    pointTypes: [
      {
        id: "pt-1",
        programCurrency: null,
        programCentsPerPoint: 0.7,
        usdCentsPerPoint: 0.7,
        basePointRate: 5,
        bonusPercentage: 30,
      },
    ],
  }),
  mockUserEliteStatusFindFirst: vi.fn().mockResolvedValue({
    bonusPercentage: 30,
    fixedRate: null,
    isFixed: false,
    pointsFloorTo: null,
  }),
}));

vi.mock("@/lib/property-utils", () => ({
  findOrCreateProperty: vi.fn().mockResolvedValue("prop-123"),
}));
vi.mock("@/lib/loyalty-utils", () => ({
  calculatePoints: vi.fn().mockReturnValue(1200),
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
    userEliteStatus: { findFirst: mockUserEliteStatusFindFirst },
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

  it("returns duplicate=true and skips creation when confirmationNumber already exists", async () => {
    mockBookingFindFirst.mockResolvedValueOnce({ id: "existing-booking" });
    const result = await ingestBookingFromEmail(baseParsed, "user-1", "Hyatt");
    expect(result).toEqual({ bookingId: "existing-booking", duplicate: true });
    expect(mockBookingCreate).not.toHaveBeenCalled();
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
});
