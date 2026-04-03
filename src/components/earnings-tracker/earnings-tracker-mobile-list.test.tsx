import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { EarningsTrackerMobileList } from "./earnings-tracker-mobile-list";
import type { EarningsTrackerBooking } from "@/app/api/earnings-tracker/route";
import type { EarningsTrackerGridProps } from "./earnings-tracker-grid";

// Minimal booking factory
function makeBooking(overrides: Partial<EarningsTrackerBooking> = {}): EarningsTrackerBooking {
  return {
    id: "b1",
    property: { name: "Park Hyatt Chicago" },
    checkIn: "2024-06-01",
    checkOut: "2024-06-04",
    currency: "USD",
    lockedExchangeRate: 1,
    pretaxCost: 300,
    totalCost: 330,
    portalCashbackOnTotal: false,
    portalCashbackRate: null,
    portalCashback: 0,
    portalCashbackPostingStatus: null,
    loyaltyPointsEarned: null,
    loyaltyPostingStatus: null,
    cardReward: 0,
    cardRewardPostingStatus: null,
    userCreditCard: null,
    shoppingPortal: null,
    hotelChain: null,
    bookingPromotions: [],
    bookingCardBenefits: [],
    benefits: [],
    partnershipEarns: [],
    bookingPartnershipEarnStatuses: [],
    ...overrides,
  } as EarningsTrackerBooking;
}

function makeProps(bookings: EarningsTrackerBooking[]): EarningsTrackerGridProps {
  return {
    bookings,
    expandedCells: {},
    setExpandedCells: vi.fn(),
    patchBookingStatus: vi.fn(),
    patchPromotionStatus: vi.fn(),
    patchCardBenefitStatus: vi.fn(),
    patchBenefitStatus: vi.fn(),
    patchPartnershipStatus: vi.fn(),
  };
}

describe("EarningsTrackerMobileList", () => {
  it("renders a collapsed row for each booking", () => {
    const props = makeProps([
      makeBooking(),
      makeBooking({ id: "b2", property: { name: "Marriott DT" } }),
    ]);
    render(<EarningsTrackerMobileList {...props} />);
    expect(screen.getByTestId("mobile-booking-row-b1")).toBeInTheDocument();
    expect(screen.getByTestId("mobile-booking-row-b2")).toBeInTheDocument();
  });

  it("shows hotel name and formatted dates in collapsed row", () => {
    const props = makeProps([makeBooking()]);
    render(<EarningsTrackerMobileList {...props} />);
    expect(screen.getByTestId("mobile-booking-row-b1")).toHaveTextContent("Park Hyatt Chicago");
  });

  it("shows no expanded content when collapsed", () => {
    const props = makeProps([
      makeBooking({ loyaltyPointsEarned: 1000, loyaltyPostingStatus: "pending" }),
    ]);
    render(<EarningsTrackerMobileList {...props} />);
    expect(screen.queryByTestId("mobile-earnings-list-b1")).not.toBeInTheDocument();
  });

  it("expands to show earnings items when header is clicked", () => {
    const props = makeProps([
      makeBooking({ loyaltyPointsEarned: 1000, loyaltyPostingStatus: "pending" }),
    ]);
    render(<EarningsTrackerMobileList {...props} />);
    fireEvent.click(screen.getByTestId("mobile-booking-row-b1"));
    expect(screen.getByTestId("mobile-earnings-list-b1")).toBeInTheDocument();
  });

  it("collapses again when header is clicked a second time", () => {
    const props = makeProps([
      makeBooking({ loyaltyPointsEarned: 1000, loyaltyPostingStatus: "pending" }),
    ]);
    render(<EarningsTrackerMobileList {...props} />);
    fireEvent.click(screen.getByTestId("mobile-booking-row-b1"));
    fireEvent.click(screen.getByTestId("mobile-booking-row-b1"));
    expect(screen.queryByTestId("mobile-earnings-list-b1")).not.toBeInTheDocument();
  });

  it("shows 'all posted' badge when all items are posted", () => {
    const props = makeProps([
      makeBooking({
        loyaltyPointsEarned: 1000,
        loyaltyPostingStatus: "posted",
        cardReward: 20,
        cardRewardPostingStatus: "posted",
      }),
    ]);
    render(<EarningsTrackerMobileList {...props} />);
    expect(screen.getByTestId("mobile-summary-badge-b1")).toHaveTextContent("all posted");
  });

  it("shows 'N pending' badge when any item is pending", () => {
    const props = makeProps([
      makeBooking({
        loyaltyPointsEarned: 1000,
        loyaltyPostingStatus: "pending",
        cardReward: 20,
        cardRewardPostingStatus: "posted",
      }),
    ]);
    render(<EarningsTrackerMobileList {...props} />);
    expect(screen.getByTestId("mobile-summary-badge-b1")).toHaveTextContent("pending");
  });

  it("shows 'N failed' badge (highest priority) even when others are pending", () => {
    const props = makeProps([
      makeBooking({
        loyaltyPointsEarned: 1000,
        loyaltyPostingStatus: "failed",
        cardReward: 20,
        cardRewardPostingStatus: "pending",
      }),
    ]);
    render(<EarningsTrackerMobileList {...props} />);
    expect(screen.getByTestId("mobile-summary-badge-b1")).toHaveTextContent("failed");
  });

  it("shows no badge when booking has no trackable earnings", () => {
    const props = makeProps([makeBooking()]);
    render(<EarningsTrackerMobileList {...props} />);
    expect(screen.queryByTestId("mobile-summary-badge-b1")).not.toBeInTheDocument();
  });

  it("calls patchBookingStatus when loyalty status badge is tapped", () => {
    const patchBookingStatus = vi.fn();
    const props = {
      ...makeProps([makeBooking({ loyaltyPointsEarned: 1000, loyaltyPostingStatus: "pending" })]),
      patchBookingStatus,
    };
    render(<EarningsTrackerMobileList {...props} />);
    fireEvent.click(screen.getByTestId("mobile-booking-row-b1"));
    fireEvent.click(screen.getByTestId("mobile-status-badge-b1-loyalty"));
    expect(patchBookingStatus).toHaveBeenCalledWith("b1", "loyaltyPostingStatus", "pending");
  });

  it("renders multiple promotions as separate rows with repeated category label", () => {
    const props = makeProps([
      makeBooking({
        bookingPromotions: [
          {
            id: "bp1",
            bookingId: "b1",
            promotionId: "p1",
            appliedValue: 50,
            autoApplied: true,
            postingStatus: "posted",
            promotion: {
              id: "p1",
              name: "Bonus Q2",
              type: "loyalty",
              valueType: "fixed",
              value: 50,
            },
          },
          {
            id: "bp2",
            bookingId: "b1",
            promotionId: "p2",
            appliedValue: 25,
            autoApplied: false,
            postingStatus: "pending",
            promotion: {
              id: "p2",
              name: "Suite Award",
              type: "loyalty",
              valueType: "fixed",
              value: 25,
            },
          },
        ],
      }),
    ]);
    render(<EarningsTrackerMobileList {...props} />);
    fireEvent.click(screen.getByTestId("mobile-booking-row-b1"));
    const list = screen.getByTestId("mobile-earnings-list-b1");
    const promoLabels = list.querySelectorAll("[data-testid='mobile-category-label-promo']");
    expect(promoLabels).toHaveLength(2);
  });
});
