import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/services/promotion-apply", () => ({
  matchPromotionsForBooking: vi.fn().mockResolvedValue(["promo-1"]),
  reevaluateSubsequentBookings: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/services/card-benefit-apply", () => ({
  reapplyCardBenefitsAffectedByBooking: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

import {
  runPostBookingCreate,
  derivePostingStatusesForCreate,
  derivePostingStatusesForUpdate,
} from "./booking.service";
import {
  matchPromotionsForBooking,
  reevaluateSubsequentBookings,
} from "@/services/promotion-apply";
import { reapplyCardBenefitsAffectedByBooking } from "@/services/card-benefit-apply";
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

// ---------------------------------------------------------------------------
// derivePostingStatusesForCreate
// ---------------------------------------------------------------------------

describe("derivePostingStatusesForCreate", () => {
  const base = {
    loyaltyPointsEarned: 500,
    accommodationType: "hotel",
    hotelChainId: "chain-1",
    userCreditCardId: "card-1",
    shoppingPortalId: "portal-1",
  };

  it("returns all pending when all fields are eligible", () => {
    expect(derivePostingStatusesForCreate(base)).toEqual({
      loyaltyPostingStatus: "pending",
      cardRewardPostingStatus: "pending",
      portalCashbackPostingStatus: "pending",
    });
  });

  it("sets loyaltyPostingStatus to null when loyaltyPointsEarned is null", () => {
    const { loyaltyPostingStatus } = derivePostingStatusesForCreate({
      ...base,
      loyaltyPointsEarned: null,
    });
    expect(loyaltyPostingStatus).toBeNull();
  });

  it("sets loyaltyPostingStatus to null when loyaltyPointsEarned is 0", () => {
    const { loyaltyPostingStatus } = derivePostingStatusesForCreate({
      ...base,
      loyaltyPointsEarned: 0,
    });
    expect(loyaltyPostingStatus).toBeNull();
  });

  it("sets loyaltyPostingStatus to null for apartment bookings", () => {
    const { loyaltyPostingStatus } = derivePostingStatusesForCreate({
      ...base,
      accommodationType: "apartment",
    });
    expect(loyaltyPostingStatus).toBeNull();
  });

  it("sets loyaltyPostingStatus to null when hotelChainId is null", () => {
    const { loyaltyPostingStatus } = derivePostingStatusesForCreate({
      ...base,
      hotelChainId: null,
    });
    expect(loyaltyPostingStatus).toBeNull();
  });

  it("sets cardRewardPostingStatus to null when userCreditCardId is null", () => {
    const { cardRewardPostingStatus } = derivePostingStatusesForCreate({
      ...base,
      userCreditCardId: null,
    });
    expect(cardRewardPostingStatus).toBeNull();
  });

  it("sets portalCashbackPostingStatus to null when shoppingPortalId is null", () => {
    const { portalCashbackPostingStatus } = derivePostingStatusesForCreate({
      ...base,
      shoppingPortalId: null,
    });
    expect(portalCashbackPostingStatus).toBeNull();
  });

  it("returns all null when no eligible fields", () => {
    expect(
      derivePostingStatusesForCreate({
        loyaltyPointsEarned: null,
        accommodationType: "hotel",
        hotelChainId: null,
        userCreditCardId: null,
        shoppingPortalId: null,
      })
    ).toEqual({
      loyaltyPostingStatus: null,
      cardRewardPostingStatus: null,
      portalCashbackPostingStatus: null,
    });
  });
});

// ---------------------------------------------------------------------------
// derivePostingStatusesForUpdate
// ---------------------------------------------------------------------------

describe("derivePostingStatusesForUpdate", () => {
  const baseCurrent = {
    loyaltyPointsEarned: 500,
    accommodationType: "hotel",
    hotelChainId: "chain-1",
    userCreditCardId: "card-1",
    shoppingPortalId: "portal-1",
    loyaltyPostingStatus: "posted" as const,
    cardRewardPostingStatus: "posted" as const,
    portalCashbackPostingStatus: "posted" as const,
  };

  // --- loyaltyPostingStatus ---

  it("preserves existing loyaltyPostingStatus when nothing relevant changed", () => {
    const { loyaltyPostingStatus } = derivePostingStatusesForUpdate(
      { loyaltyPointsEarned: 500 },
      baseCurrent,
      {}
    );
    expect(loyaltyPostingStatus).toBe("posted");
  });

  it("resets loyaltyPostingStatus to pending when loyaltyPointsEarned changes", () => {
    const { loyaltyPostingStatus } = derivePostingStatusesForUpdate(
      { loyaltyPointsEarned: 600 },
      baseCurrent,
      { loyaltyPointsEarned: 600 }
    );
    expect(loyaltyPostingStatus).toBe("pending");
  });

  it("resets loyaltyPostingStatus to pending when accommodationType changes", () => {
    const { loyaltyPostingStatus } = derivePostingStatusesForUpdate(
      { accommodationType: "suite" },
      baseCurrent,
      { accommodationType: "suite" }
    );
    expect(loyaltyPostingStatus).toBe("pending");
  });

  it("resets loyaltyPostingStatus to pending when hotelChainId changes", () => {
    const { loyaltyPostingStatus } = derivePostingStatusesForUpdate(
      { hotelChainId: "chain-2" },
      baseCurrent,
      { hotelChainId: "chain-2" }
    );
    expect(loyaltyPostingStatus).toBe("pending");
  });

  it("sets loyaltyPostingStatus to null when accommodation changes to apartment", () => {
    const { loyaltyPostingStatus } = derivePostingStatusesForUpdate(
      { accommodationType: "apartment" },
      baseCurrent,
      { accommodationType: "apartment" }
    );
    expect(loyaltyPostingStatus).toBeNull();
  });

  it("sets loyaltyPostingStatus to null when hotelChainId is cleared", () => {
    const { loyaltyPostingStatus } = derivePostingStatusesForUpdate(
      { hotelChainId: null },
      baseCurrent,
      { hotelChainId: null }
    );
    expect(loyaltyPostingStatus).toBeNull();
  });

  it("falls back to pending when eligible but current status is null", () => {
    const { loyaltyPostingStatus } = derivePostingStatusesForUpdate(
      {},
      { ...baseCurrent, loyaltyPostingStatus: null },
      {}
    );
    expect(loyaltyPostingStatus).toBe("pending");
  });

  // --- cardRewardPostingStatus ---

  it("preserves existing cardRewardPostingStatus when card is unchanged", () => {
    const { cardRewardPostingStatus } = derivePostingStatusesForUpdate(
      { userCreditCardId: "card-1" },
      baseCurrent,
      {}
    );
    expect(cardRewardPostingStatus).toBe("posted");
  });

  it("resets cardRewardPostingStatus to pending when card changes", () => {
    const { cardRewardPostingStatus } = derivePostingStatusesForUpdate(
      { userCreditCardId: "card-2" },
      baseCurrent,
      { userCreditCardId: "card-2" }
    );
    expect(cardRewardPostingStatus).toBe("pending");
  });

  it("sets cardRewardPostingStatus to null when card is cleared", () => {
    const { cardRewardPostingStatus } = derivePostingStatusesForUpdate(
      { userCreditCardId: null },
      baseCurrent,
      { userCreditCardId: null }
    );
    expect(cardRewardPostingStatus).toBeNull();
  });

  it("falls back to pending when card eligible but current status is null", () => {
    const { cardRewardPostingStatus } = derivePostingStatusesForUpdate(
      {},
      { ...baseCurrent, cardRewardPostingStatus: null },
      {}
    );
    expect(cardRewardPostingStatus).toBe("pending");
  });

  // --- portalCashbackPostingStatus ---

  it("preserves existing portalCashbackPostingStatus when portal is unchanged", () => {
    const { portalCashbackPostingStatus } = derivePostingStatusesForUpdate(
      { shoppingPortalId: "portal-1" },
      baseCurrent,
      {}
    );
    expect(portalCashbackPostingStatus).toBe("posted");
  });

  it("resets portalCashbackPostingStatus to pending when portal changes", () => {
    const { portalCashbackPostingStatus } = derivePostingStatusesForUpdate(
      { shoppingPortalId: "portal-2" },
      baseCurrent,
      { shoppingPortalId: "portal-2" }
    );
    expect(portalCashbackPostingStatus).toBe("pending");
  });

  it("sets portalCashbackPostingStatus to null when portal is cleared", () => {
    const { portalCashbackPostingStatus } = derivePostingStatusesForUpdate(
      { shoppingPortalId: null },
      baseCurrent,
      { shoppingPortalId: null }
    );
    expect(portalCashbackPostingStatus).toBeNull();
  });

  it("falls back to pending when portal eligible but current status is null", () => {
    const { portalCashbackPostingStatus } = derivePostingStatusesForUpdate(
      {},
      { ...baseCurrent, portalCashbackPostingStatus: null },
      {}
    );
    expect(portalCashbackPostingStatus).toBe("pending");
  });
});
