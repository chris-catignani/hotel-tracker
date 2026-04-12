import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import {
  getChargeDate,
  reapplyBenefitForPeriod,
  reapplyCardBenefitsAffectedByBooking,
} from "./card-benefit-apply";
import prisma from "@/lib/prisma";
import { BenefitPeriod } from "@prisma/client";

vi.mock("@/lib/prisma", () => ({
  default: {
    cardBenefit: { findUnique: vi.fn() },
    booking: { findMany: vi.fn(), findUnique: vi.fn() },
    bookingCardBenefit: { findMany: vi.fn(), deleteMany: vi.fn(), createMany: vi.fn() },
  },
}));

const prismaMock = prisma as unknown as {
  cardBenefit: { findUnique: Mock };
  booking: { findMany: Mock; findUnique: Mock };
  bookingCardBenefit: { findMany: Mock; deleteMany: Mock; createMany: Mock };
};

// ---------------------------------------------------------------------------
// getChargeDate
// ---------------------------------------------------------------------------

describe("getChargeDate", () => {
  const checkIn = new Date("2025-09-01T00:00:00Z");
  const bookingDate = new Date("2025-06-01T00:00:00Z");

  it("returns bookingDate for prepaid when bookingDate is set", () => {
    expect(getChargeDate({ paymentTiming: "prepaid", bookingDate, checkIn })).toBe(bookingDate);
  });

  it("returns checkIn for prepaid when bookingDate is null", () => {
    expect(getChargeDate({ paymentTiming: "prepaid", bookingDate: null, checkIn })).toBe(checkIn);
  });

  it("returns checkIn for postpaid regardless of bookingDate", () => {
    expect(getChargeDate({ paymentTiming: "postpaid", bookingDate, checkIn })).toBe(checkIn);
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface BenefitShape {
  id: string;
  creditCardId: string;
  hotelChainId: string | null;
  value: string;
  maxValuePerBooking: string | null;
  isActive: boolean;
  period: BenefitPeriod;
  startDate: Date | null;
  endDate: Date | null;
  otaAgencies: { otaAgencyId: string }[];
}

interface BookingShape {
  id: string;
  checkIn: Date;
  bookingDate: Date | null;
  paymentTiming: string;
  totalCost: string;
  lockedExchangeRate: string;
  createdAt: Date;
  userCreditCard: { openedDate: Date | null; closedDate: Date | null };
}

function makeBenefit(overrides: Partial<BenefitShape> = {}): BenefitShape {
  return {
    id: "benefit-1",
    creditCardId: "card-1",
    hotelChainId: null,
    value: "300",
    maxValuePerBooking: null,
    isActive: true,
    period: "annual",
    startDate: null,
    endDate: null,
    otaAgencies: [],
    ...overrides,
  };
}

function makeBooking(overrides: Partial<BookingShape> = {}): BookingShape {
  return {
    id: "booking-1",
    checkIn: new Date("2025-09-01T00:00:00Z"),
    bookingDate: null,
    paymentTiming: "postpaid",
    totalCost: "200",
    lockedExchangeRate: "1",
    createdAt: new Date("2025-01-01T00:00:00Z"),
    userCreditCard: { openedDate: null, closedDate: null },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// reapplyBenefitForPeriod — pool scoped by userCreditCardId
// ---------------------------------------------------------------------------

describe("reapplyBenefitForPeriod", () => {
  beforeEach(() => {
    prismaMock.bookingCardBenefit.findMany.mockResolvedValue([]);
    prismaMock.bookingCardBenefit.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.bookingCardBenefit.createMany.mockResolvedValue({ count: 0 });
  });

  it("queries bookings by userCreditCardId, not userId", async () => {
    prismaMock.cardBenefit.findUnique.mockResolvedValue(makeBenefit());
    prismaMock.booking.findMany.mockResolvedValue([]);

    await reapplyBenefitForPeriod("benefit-1", "2025", "ucc-chris-sells");

    expect(prismaMock.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userCreditCardId: "ucc-chris-sells" }),
      })
    );
  });

  it("scopes deleteMany to the specific userCreditCardId", async () => {
    prismaMock.cardBenefit.findUnique.mockResolvedValue(makeBenefit());
    prismaMock.booking.findMany.mockResolvedValue([]);

    await reapplyBenefitForPeriod("benefit-1", "2025", "ucc-chris-sells");

    expect(prismaMock.bookingCardBenefit.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ booking: { userCreditCardId: "ucc-chris-sells" } }),
      })
    );
  });

  it("two card instances each get the full benefit pool independently", async () => {
    // Booking on "Chris Codes" card consumes $200 of the $300 pool
    const codesBooking = makeBooking({ id: "b-codes", totalCost: "200", lockedExchangeRate: "1" });
    // Booking on "Chris Sells" card should ALSO get $200 from its own independent pool
    const sellsBooking = makeBooking({ id: "b-sells", totalCost: "200", lockedExchangeRate: "1" });

    prismaMock.cardBenefit.findUnique.mockResolvedValue(makeBenefit({ value: "300" }));

    // First call: "Chris Codes" instance
    prismaMock.booking.findMany.mockResolvedValueOnce([codesBooking]);
    await reapplyBenefitForPeriod("benefit-1", "2025", "ucc-chris-codes");
    expect(prismaMock.bookingCardBenefit.createMany).toHaveBeenCalledWith({
      data: [
        {
          bookingId: "b-codes",
          cardBenefitId: "benefit-1",
          appliedValue: 200,
          periodKey: "2025",
          postingStatus: "pending",
        },
      ],
    });

    prismaMock.bookingCardBenefit.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.bookingCardBenefit.createMany.mockResolvedValue({ count: 0 });

    // Second call: "Chris Sells" instance — should also get $200, not share the codes pool
    prismaMock.cardBenefit.findUnique.mockResolvedValue(makeBenefit({ value: "300" }));
    prismaMock.booking.findMany.mockResolvedValueOnce([sellsBooking]);
    await reapplyBenefitForPeriod("benefit-1", "2025", "ucc-chris-sells");
    expect(prismaMock.bookingCardBenefit.createMany).toHaveBeenCalledWith({
      data: [
        {
          bookingId: "b-sells",
          cardBenefitId: "benefit-1",
          appliedValue: 200,
          periodKey: "2025",
          postingStatus: "pending",
        },
      ],
    });
  });

  it("applies benefit to multiple bookings in charge-date order up to the cap", async () => {
    const booking1 = makeBooking({
      id: "b1",
      checkIn: new Date("2025-06-01T00:00:00Z"),
      totalCost: "150",
      lockedExchangeRate: "1",
      createdAt: new Date("2025-01-01T00:00:00Z"),
    });
    const booking2 = makeBooking({
      id: "b2",
      checkIn: new Date("2025-09-01T00:00:00Z"),
      totalCost: "150",
      lockedExchangeRate: "1",
      createdAt: new Date("2025-01-02T00:00:00Z"),
    });

    prismaMock.cardBenefit.findUnique.mockResolvedValue(makeBenefit({ value: "200" }));
    prismaMock.booking.findMany.mockResolvedValue([booking1, booking2]);

    await reapplyBenefitForPeriod("benefit-1", "2025", "ucc-1");

    expect(prismaMock.bookingCardBenefit.createMany).toHaveBeenCalledWith({
      data: [
        {
          bookingId: "b1",
          cardBenefitId: "benefit-1",
          appliedValue: 150,
          periodKey: "2025",
          postingStatus: "pending",
        },
        {
          bookingId: "b2",
          cardBenefitId: "benefit-1",
          appliedValue: 50,
          periodKey: "2025",
          postingStatus: "pending",
        },
      ],
    });
  });

  it("maxValuePerBooking caps what a single booking can consume from the pool", async () => {
    // $500 pool, $250 max per booking — first booking gets $250, second also gets $250
    const booking1 = makeBooking({
      id: "b1",
      checkIn: new Date("2025-06-01T00:00:00Z"),
      totalCost: "500",
      lockedExchangeRate: "1",
      createdAt: new Date("2025-01-01T00:00:00Z"),
    });
    const booking2 = makeBooking({
      id: "b2",
      checkIn: new Date("2025-09-01T00:00:00Z"),
      totalCost: "500",
      lockedExchangeRate: "1",
      createdAt: new Date("2025-01-02T00:00:00Z"),
    });

    prismaMock.cardBenefit.findUnique.mockResolvedValue(
      makeBenefit({ value: "500", maxValuePerBooking: "250" })
    );
    prismaMock.booking.findMany.mockResolvedValue([booking1, booking2]);

    await reapplyBenefitForPeriod("benefit-1", "2025", "ucc-1");

    expect(prismaMock.bookingCardBenefit.createMany).toHaveBeenCalledWith({
      data: [
        {
          bookingId: "b1",
          cardBenefitId: "benefit-1",
          appliedValue: 250,
          periodKey: "2025",
          postingStatus: "pending",
        },
        {
          bookingId: "b2",
          cardBenefitId: "benefit-1",
          appliedValue: 250,
          periodKey: "2025",
          postingStatus: "pending",
        },
      ],
    });
  });

  it("excludes bookings with charge date before benefit startDate", async () => {
    const earlyBooking = makeBooking({
      id: "b-early",
      checkIn: new Date("2025-01-15T00:00:00Z"),
      totalCost: "200",
      lockedExchangeRate: "1",
    });
    const lateBooking = makeBooking({
      id: "b-late",
      checkIn: new Date("2025-06-01T00:00:00Z"),
      totalCost: "200",
      lockedExchangeRate: "1",
    });

    prismaMock.cardBenefit.findUnique.mockResolvedValue(
      makeBenefit({ value: "300", startDate: new Date("2025-02-01T00:00:00Z") })
    );
    prismaMock.booking.findMany.mockResolvedValue([earlyBooking, lateBooking]);

    await reapplyBenefitForPeriod("benefit-1", "2025", "ucc-1");

    expect(prismaMock.bookingCardBenefit.createMany).toHaveBeenCalledWith({
      data: [
        {
          bookingId: "b-late",
          cardBenefitId: "benefit-1",
          appliedValue: 200,
          periodKey: "2025",
          postingStatus: "pending",
        },
      ],
    });
  });

  it("excludes bookings with charge date after benefit endDate", async () => {
    const earlyBooking = makeBooking({
      id: "b-early",
      checkIn: new Date("2025-06-01T00:00:00Z"),
      totalCost: "200",
      lockedExchangeRate: "1",
    });
    const lateBooking = makeBooking({
      id: "b-late",
      checkIn: new Date("2025-12-01T00:00:00Z"),
      totalCost: "200",
      lockedExchangeRate: "1",
    });

    prismaMock.cardBenefit.findUnique.mockResolvedValue(
      makeBenefit({ value: "300", endDate: new Date("2025-09-30T00:00:00Z") })
    );
    prismaMock.booking.findMany.mockResolvedValue([earlyBooking, lateBooking]);

    await reapplyBenefitForPeriod("benefit-1", "2025", "ucc-1");

    expect(prismaMock.bookingCardBenefit.createMany).toHaveBeenCalledWith({
      data: [
        {
          bookingId: "b-early",
          cardBenefitId: "benefit-1",
          appliedValue: 200,
          periodKey: "2025",
          postingStatus: "pending",
        },
      ],
    });
  });

  it("excludes bookings charged before the card's openedDate", async () => {
    const tooEarlyBooking = makeBooking({
      id: "b-early",
      checkIn: new Date("2025-03-01T00:00:00Z"),
      totalCost: "200",
      lockedExchangeRate: "1",
      userCreditCard: {
        openedDate: new Date("2025-06-01T00:00:00Z"),
        closedDate: null,
      },
    });
    const validBooking = makeBooking({
      id: "b-valid",
      checkIn: new Date("2025-09-01T00:00:00Z"),
      totalCost: "200",
      lockedExchangeRate: "1",
      userCreditCard: {
        openedDate: new Date("2025-06-01T00:00:00Z"),
        closedDate: null,
      },
    });

    prismaMock.cardBenefit.findUnique.mockResolvedValue(makeBenefit({ value: "300" }));
    prismaMock.booking.findMany.mockResolvedValue([tooEarlyBooking, validBooking]);

    await reapplyBenefitForPeriod("benefit-1", "2025", "ucc-1");

    expect(prismaMock.bookingCardBenefit.createMany).toHaveBeenCalledWith({
      data: [
        {
          bookingId: "b-valid",
          cardBenefitId: "benefit-1",
          appliedValue: 200,
          periodKey: "2025",
          postingStatus: "pending",
        },
      ],
    });
  });

  it("excludes bookings charged after the card's closedDate", async () => {
    const validBooking = makeBooking({
      id: "b-valid",
      checkIn: new Date("2025-03-01T00:00:00Z"),
      totalCost: "200",
      lockedExchangeRate: "1",
      userCreditCard: {
        openedDate: null,
        closedDate: new Date("2025-06-30T00:00:00Z"),
      },
    });
    const tooLateBooking = makeBooking({
      id: "b-late",
      checkIn: new Date("2025-09-01T00:00:00Z"),
      totalCost: "200",
      lockedExchangeRate: "1",
      userCreditCard: {
        openedDate: null,
        closedDate: new Date("2025-06-30T00:00:00Z"),
      },
    });

    prismaMock.cardBenefit.findUnique.mockResolvedValue(makeBenefit({ value: "300" }));
    prismaMock.booking.findMany.mockResolvedValue([validBooking, tooLateBooking]);

    await reapplyBenefitForPeriod("benefit-1", "2025", "ucc-1");

    expect(prismaMock.bookingCardBenefit.createMany).toHaveBeenCalledWith({
      data: [
        {
          bookingId: "b-valid",
          cardBenefitId: "benefit-1",
          appliedValue: 200,
          periodKey: "2025",
          postingStatus: "pending",
        },
      ],
    });
  });

  it("OTA restriction — only passes bookings for matching OTA agencies to the findMany query", async () => {
    prismaMock.cardBenefit.findUnique.mockResolvedValue(
      makeBenefit({ otaAgencies: [{ otaAgencyId: "ota-amex-fhr" }] })
    );
    prismaMock.booking.findMany.mockResolvedValue([]);

    await reapplyBenefitForPeriod("benefit-1", "2025", "ucc-1");

    expect(prismaMock.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          otaAgencyId: { in: ["ota-amex-fhr"] },
        }),
      })
    );
  });

  it("no OTA restriction — does not add otaAgencyId filter to the query", async () => {
    prismaMock.cardBenefit.findUnique.mockResolvedValue(makeBenefit({ otaAgencies: [] }));
    prismaMock.booking.findMany.mockResolvedValue([]);

    await reapplyBenefitForPeriod("benefit-1", "2025", "ucc-1");

    const where = prismaMock.booking.findMany.mock.calls[0][0].where;
    expect(where).not.toHaveProperty("otaAgencyId");
  });

  it("clears all usages and does not create rows when benefit is inactive", async () => {
    prismaMock.cardBenefit.findUnique.mockResolvedValue(makeBenefit({ isActive: false }));

    await reapplyBenefitForPeriod("benefit-1", "2025", "ucc-1");

    expect(prismaMock.bookingCardBenefit.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ cardBenefitId: "benefit-1", periodKey: "2025" }),
      })
    );
    expect(prismaMock.bookingCardBenefit.createMany).not.toHaveBeenCalled();
    expect(prismaMock.booking.findMany).not.toHaveBeenCalled();
  });

  it("does not call createMany when no eligible bookings", async () => {
    prismaMock.cardBenefit.findUnique.mockResolvedValue(makeBenefit());
    prismaMock.booking.findMany.mockResolvedValue([]);

    await reapplyBenefitForPeriod("benefit-1", "2025", "ucc-1");

    expect(prismaMock.bookingCardBenefit.createMany).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// reapplyCardBenefitsAffectedByBooking — oldPairs include userCreditCardId
// ---------------------------------------------------------------------------

describe("reapplyCardBenefitsAffectedByBooking", () => {
  beforeEach(() => {
    prismaMock.bookingCardBenefit.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.bookingCardBenefit.createMany.mockResolvedValue({ count: 0 });
  });

  it("re-evaluates oldPairs using their userCreditCardId even if the booking no longer matches", async () => {
    // Booking switched from card A to card B — old pair (from card A) should still be re-evaluated
    prismaMock.booking.findUnique.mockResolvedValue({
      id: "booking-1",
      userId: "user-1",
      checkIn: new Date("2025-09-01T00:00:00Z"),
      bookingDate: null,
      paymentTiming: "postpaid",
      hotelChainId: "chain-1",
      otaAgencyId: null,
      userCreditCardId: "ucc-card-b",
      userCreditCard: {
        creditCard: {
          cardBenefits: [],
        },
      },
    });

    prismaMock.cardBenefit.findUnique.mockResolvedValue(makeBenefit({ isActive: false }));
    prismaMock.booking.findMany.mockResolvedValue([]);

    const oldPairs = [
      { benefitId: "benefit-old", periodKey: "2025", userCreditCardId: "ucc-card-a" },
    ];

    await reapplyCardBenefitsAffectedByBooking("booking-1", oldPairs);

    // reapplyBenefitForPeriod is called with the old pair's userCreditCardId
    expect(prismaMock.bookingCardBenefit.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          cardBenefitId: "benefit-old",
          periodKey: "2025",
          booking: { userCreditCardId: "ucc-card-a" },
        }),
      })
    );
  });
});

// ---------------------------------------------------------------------------
// reapplyBenefitForPeriod — postingStatus preservation
// ---------------------------------------------------------------------------

describe("reapplyBenefitForPeriod — postingStatus preservation", () => {
  beforeEach(() => {
    prismaMock.bookingCardBenefit.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.bookingCardBenefit.createMany.mockResolvedValue({ count: 0 });
  });

  it("preserves postingStatus from an existing row when the booking is re-applied", async () => {
    prismaMock.cardBenefit.findUnique.mockResolvedValue(makeBenefit({ value: "200" }));
    prismaMock.booking.findMany.mockResolvedValue([
      makeBooking({ id: "b1", totalCost: "200", lockedExchangeRate: "1" }),
    ]);
    // b1 was previously marked "posted"
    prismaMock.bookingCardBenefit.findMany.mockResolvedValueOnce([
      { bookingId: "b1", postingStatus: "posted" },
    ]);

    await reapplyBenefitForPeriod("benefit-1", "2025", "ucc-1");

    expect(prismaMock.bookingCardBenefit.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ bookingId: "b1", postingStatus: "posted" })],
    });
  });

  it("defaults to pending for a newly applied booking with no prior row", async () => {
    prismaMock.cardBenefit.findUnique.mockResolvedValue(makeBenefit({ value: "200" }));
    prismaMock.booking.findMany.mockResolvedValue([
      makeBooking({ id: "b-new", totalCost: "200", lockedExchangeRate: "1" }),
    ]);
    // No prior row for b-new
    prismaMock.bookingCardBenefit.findMany.mockResolvedValueOnce([]);

    await reapplyBenefitForPeriod("benefit-1", "2025", "ucc-1");

    expect(prismaMock.bookingCardBenefit.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ bookingId: "b-new", postingStatus: "pending" })],
    });
  });

  it("uses a pre-built statusSnapshot when provided (no extra findMany)", async () => {
    prismaMock.cardBenefit.findUnique.mockResolvedValue(makeBenefit({ value: "200" }));
    prismaMock.booking.findMany.mockResolvedValue([
      makeBooking({ id: "b1", totalCost: "200", lockedExchangeRate: "1" }),
    ]);
    const snapshot = new Map([["b1", "posted" as const]]);

    await reapplyBenefitForPeriod("benefit-1", "2025", "ucc-1", snapshot);

    // findMany should NOT have been called — snapshot was provided
    expect(prismaMock.bookingCardBenefit.findMany).not.toHaveBeenCalled();
    expect(prismaMock.bookingCardBenefit.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ bookingId: "b1", postingStatus: "posted" })],
    });
  });
});
