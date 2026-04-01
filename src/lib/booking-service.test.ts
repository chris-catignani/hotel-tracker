import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/promotion-apply", () => ({
  matchPromotionsForBooking: vi.fn().mockResolvedValue(["promo-1"]),
  reevaluateSubsequentBookings: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/card-benefit-apply", () => ({
  reapplyCardBenefitsAffectedByBooking: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

import { runPostBookingCreate } from "./booking-service";
import { matchPromotionsForBooking, reevaluateSubsequentBookings } from "@/lib/promotion-apply";
import { reapplyCardBenefitsAffectedByBooking } from "@/lib/card-benefit-apply";
import { logger } from "@/lib/logger";

const metadata = {
  userId: "user-1",
  accommodationType: "hotel",
  checkIn: "2026-06-01",
  checkOut: "2026-06-03",
  numNights: 2,
  totalCost: 300,
  currency: "USD",
  ingestionMethod: "email",
};

beforeEach(() => vi.clearAllMocks());

describe("runPostBookingCreate", () => {
  it("runs promotion matching with the bookingId", async () => {
    await runPostBookingCreate("booking-1", metadata);
    expect(matchPromotionsForBooking).toHaveBeenCalledWith("booking-1", "user-1");
  });

  it("logs booking:created with bookingId, promotionsApplied, and metadata", async () => {
    await runPostBookingCreate("booking-1", metadata);
    expect(logger.info).toHaveBeenCalledWith("booking:created", {
      bookingId: "booking-1",
      promotionsApplied: 1,
      userId: "user-1",
      accommodationType: "hotel",
      checkIn: "2026-06-01",
      checkOut: "2026-06-03",
      numNights: 2,
      totalCost: 300,
      currency: "USD",
      ingestionMethod: "email",
    });
  });

  it("re-evaluates subsequent bookings with appliedPromoIds", async () => {
    await runPostBookingCreate("booking-1", metadata);
    expect(reevaluateSubsequentBookings).toHaveBeenCalledWith("booking-1", "user-1", ["promo-1"]);
  });

  it("reapplies card benefits", async () => {
    await runPostBookingCreate("booking-1", metadata);
    expect(reapplyCardBenefitsAffectedByBooking).toHaveBeenCalledWith("booking-1");
  });

  it("calls steps in order: match → log → reevaluate → reapply", async () => {
    const order: string[] = [];
    vi.mocked(matchPromotionsForBooking).mockImplementation(async () => {
      order.push("match");
      return ["promo-1"];
    });
    vi.mocked(logger.info).mockImplementation(() => {
      order.push("log");
    });
    vi.mocked(reevaluateSubsequentBookings).mockImplementation(async () => {
      order.push("reevaluate");
    });
    vi.mocked(reapplyCardBenefitsAffectedByBooking).mockImplementation(async () => {
      order.push("reapply");
    });

    await runPostBookingCreate("booking-1", metadata);
    expect(order).toEqual(["match", "log", "reevaluate", "reapply"]);
  });
});
