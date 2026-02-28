import { render, screen, act } from "@testing-library/react";
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
    netCost: 80,
  };

  it("should render all cost components correctly", async () => {
    await act(async () => {
      render(<CostBreakdown breakdown={mockBreakdown} />);
    });

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
    await act(async () => {
      render(<CostBreakdown breakdown={mockBreakdown} />);
    });

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

  it("should not render components with 0 value", async () => {
    const zeroBreakdown = {
      ...mockBreakdown,
      portalCashback: 0,
      cardReward: 0,
      loyaltyPointsValue: 0,
      promoSavings: 0,
      promotions: [],
    };
    await act(async () => {
      render(<CostBreakdown breakdown={zeroBreakdown} />);
    });

    expect(screen.queryByText("Portal Cashback")).not.toBeInTheDocument();
    expect(screen.queryByText("Card Reward")).not.toBeInTheDocument();
    expect(screen.queryByText("Loyalty Points Value")).not.toBeInTheDocument();
    expect(screen.queryByText("Promotion Savings")).not.toBeInTheDocument();
  });
});
