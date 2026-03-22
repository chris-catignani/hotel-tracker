import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import { CostBreakdown } from "./cost-breakdown";
import { NetCostBreakdown } from "@/lib/net-cost";

describe("CostBreakdown", () => {
  const mockBreakdown: NetCostBreakdown = {
    totalCost: 100,
    promoSavings: 10,
    promotions: [
      {
        id: "1",
        name: "Promo 1",
        appliedValue: 10,
        isOrphaned: false,
        isPreQualifying: false,
        label: "Promotion",
        description: "desc",
        groups: [
          {
            name: "Benefit Group",
            segments: [{ label: "Benefit 1", value: 10, formula: "10", description: "desc" }],
          },
        ],
      },
    ],
    portalCashback: 5,
    portalCashbackCalc: {
      label: "Portal",
      appliedValue: 5,
      description: "desc",
      groups: [
        {
          segments: [{ label: "Portal", value: 5, formula: "5", description: "desc" }],
        },
      ],
    },
    cardReward: 2,
    cardRewardCalc: {
      label: "Card",
      appliedValue: 2,
      description: "desc",
      groups: [
        {
          segments: [{ label: "Card", value: 2, formula: "2", description: "desc" }],
        },
      ],
    },
    loyaltyPointsValue: 3,
    loyaltyPointsCalc: {
      label: "Loyalty",
      appliedValue: 3,
      description: "desc",
      groups: [
        {
          segments: [{ label: "Loyalty", value: 3, formula: "3", description: "desc" }],
        },
      ],
    },
    pointsRedeemedValue: 0,
    certsValue: 0,
    partnershipEarns: [],
    partnershipEarnsValue: 0,
    bookingBenefitsValue: 0,
    bookingBenefitsCalc: undefined,
    bookingBenefits: [],
    netCost: 80,
  };

  it("should render all cost components correctly", () => {
    render(<CostBreakdown breakdown={mockBreakdown} />);

    expect(screen.getByText("Cash Cost")).toBeInTheDocument();
    expect(screen.getByText("$100.00")).toBeInTheDocument();

    expect(screen.getByText("Portal Cashback")).toBeInTheDocument();
    expect(screen.getByText("-$5.00")).toBeInTheDocument();

    expect(screen.getByText("Card Reward")).toBeInTheDocument();
    expect(screen.getByText("-$2.00")).toBeInTheDocument();

    expect(screen.getByText("Loyalty Points Value")).toBeInTheDocument();
    expect(screen.getByText("-$3.00")).toBeInTheDocument();

    expect(screen.getByText("Promotion Savings")).toBeInTheDocument();
    expect(screen.getByText("-$10.00")).toBeInTheDocument();

    expect(screen.getByText("Net Cost")).toBeInTheDocument();
    expect(screen.getByText("$80.00")).toBeInTheDocument();
  });

  it("should toggle promotion details", async () => {
    const user = userEvent.setup();
    render(<CostBreakdown breakdown={mockBreakdown} />);

    // Initially hidden
    expect(screen.queryByText("Promo 1")).not.toBeInTheDocument();

    // Click to expand
    const promoButton = screen.getByRole("button", { name: /Promotion Savings/i });
    await user.click(promoButton);

    // Now visible
    expect(screen.getByText("Promo 1")).toBeInTheDocument();

    // Click to collapse
    await user.click(promoButton);
    expect(screen.queryByText("Promo 1")).not.toBeInTheDocument();
  });

  it("should show Orphaned badge when promotion isOrphaned=true", async () => {
    const user = userEvent.setup();
    const orphanedBreakdown = {
      ...mockBreakdown,
      promotions: [{ ...mockBreakdown.promotions[0], isOrphaned: true }],
    };
    render(<CostBreakdown breakdown={orphanedBreakdown} />);
    await user.click(screen.getByRole("button", { name: /Promotion Savings/i }));
    expect(screen.getByText("Orphaned")).toBeInTheDocument();
  });

  it("should show Orphaned badge when a segment formula contains '(orphaned)'", async () => {
    const user = userEvent.setup();
    const breakdown = {
      ...mockBreakdown,
      promotions: [
        {
          ...mockBreakdown.promotions[0],
          isOrphaned: false,
          groups: [
            {
              name: "3,000 Bonus Points",
              segments: [
                {
                  label: "Full Reward Cycle (3/3 nights)",
                  value: 60,
                  formula: "60",
                  description: "desc",
                },
                {
                  label: "Orphaned Reward Cycle (1/3 nights)",
                  value: 0,
                  formula: "(1 of 3 nights) × 3,000 bonus pts × 2¢ = $0.00 (orphaned)",
                  description: "There are not enough future bookings to fulfill this promotion.",
                },
              ],
            },
          ],
        },
      ],
    };
    render(<CostBreakdown breakdown={breakdown} />);
    await user.click(screen.getByRole("button", { name: /Promotion Savings/i }));
    expect(screen.getByText("Orphaned")).toBeInTheDocument();
  });

  it("should not show Orphaned badge when promotion is neither orphaned nor has orphaned segments", async () => {
    const user = userEvent.setup();
    render(<CostBreakdown breakdown={mockBreakdown} />);
    await user.click(screen.getByRole("button", { name: /Promotion Savings/i }));
    expect(screen.queryByText("Orphaned")).not.toBeInTheDocument();
  });

  it("should not render components with 0 value", () => {
    const zeroBreakdown = {
      ...mockBreakdown,
      portalCashback: 0,
      cardReward: 0,
      loyaltyPointsValue: 0,
      promoSavings: 0,
      promotions: [],
    };
    render(<CostBreakdown breakdown={zeroBreakdown} />);

    expect(screen.queryByText("Portal Cashback")).not.toBeInTheDocument();
    expect(screen.queryByText("Card Reward")).not.toBeInTheDocument();
    expect(screen.queryByText("Loyalty Points Value")).not.toBeInTheDocument();
    expect(screen.queryByText("Promotion Savings")).not.toBeInTheDocument();
  });

  it("Booking Benefits toggle is a button for keyboard accessibility", async () => {
    const user = userEvent.setup();
    const breakdownWithBenefits = {
      ...mockBreakdown,
      bookingBenefitsValue: 25,
      bookingBenefits: [{ label: "Free Breakfast", value: 25, detail: "$25.00 cash value" }],
    };
    render(<CostBreakdown breakdown={breakdownWithBenefits} />);

    const toggle = screen.getByTestId("breakdown-benefits-toggle");
    expect(toggle.tagName).toBe("BUTTON");

    // Verify it is also keyboard-operable (role=button is focusable/clickable)
    await user.click(toggle);
    expect(screen.getByTestId("breakdown-benefits-list")).toBeInTheDocument();
  });
});
