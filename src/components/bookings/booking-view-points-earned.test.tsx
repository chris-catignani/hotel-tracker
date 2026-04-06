import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { BookingPointsEarned } from "./booking-view-points-earned";

const base = {
  loyaltyPointsEarned: null,
  loyaltyPointsEstimated: false,
  hotelChain: null,
  totalCost: "487",
  pretaxCost: "450",
  lockedExchangeRate: "1",
  hotelChainId: "chain-hyatt",
  otaAgencyId: null,
  userCreditCard: null,
  shoppingPortal: null,
  portalCashbackRate: null,
  portalCashbackOnTotal: null,
};

describe("BookingPointsEarned", () => {
  it("renders nothing when no points data exists", () => {
    const { container } = render(<BookingPointsEarned booking={base} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders loyalty points row", () => {
    render(
      <BookingPointsEarned
        booking={{
          ...base,
          loyaltyPointsEarned: 8200,
          hotelChain: { name: "Hyatt", loyaltyProgram: "World of Hyatt" },
        }}
      />
    );
    expect(screen.getByTestId("points-earned-card")).toBeInTheDocument();
    expect(screen.getByTestId("loyalty-points-row")).toBeInTheDocument();
    expect(screen.getByTestId("loyalty-points-value")).toHaveTextContent("8,200 pts");
  });

  it("renders loyalty points without estimated indicator", () => {
    render(
      <BookingPointsEarned
        booking={{
          ...base,
          loyaltyPointsEarned: 5000,
          loyaltyPointsEstimated: true,
          hotelChain: { name: "Hyatt", loyaltyProgram: "World of Hyatt" },
        }}
      />
    );
    expect(screen.getByTestId("loyalty-points-value")).toHaveTextContent("5,000 pts");
  });

  it("renders CC points row for a points card", () => {
    render(
      <BookingPointsEarned
        booking={{
          ...base,
          userCreditCard: {
            creditCard: {
              name: "Chase Sapphire Reserve",
              rewardType: "points",
              rewardRate: "3",
              rewardRules: [],
            },
          },
        }}
      />
    );
    expect(screen.getByTestId("cc-points-row")).toBeInTheDocument();
    // 487 * 3 = 1461
    expect(screen.getByTestId("cc-points-value")).toHaveTextContent("1,461 pts");
  });

  it("does not render CC points row for a cashback card", () => {
    render(
      <BookingPointsEarned
        booking={{
          ...base,
          userCreditCard: {
            creditCard: {
              name: "Amex Gold",
              rewardType: "cashback",
              rewardRate: "0.02",
              rewardRules: [],
            },
          },
        }}
      />
    );
    expect(screen.queryByTestId("cc-points-row")).not.toBeInTheDocument();
  });

  it("renders portal points row when portal rewardType is points", () => {
    render(
      <BookingPointsEarned
        booking={{
          ...base,
          shoppingPortal: { name: "Chase UR", rewardType: "points" },
          portalCashbackRate: "5",
          portalCashbackOnTotal: true,
        }}
      />
    );
    expect(screen.getByTestId("portal-points-row")).toBeInTheDocument();
    // 487 * 5 = 2435
    expect(screen.getByTestId("portal-points-value")).toHaveTextContent("2,435 pts");
  });

  it("does not render portal row for cashback portal", () => {
    render(
      <BookingPointsEarned
        booking={{
          ...base,
          shoppingPortal: { name: "Rakuten", rewardType: "cashback" },
          portalCashbackRate: "0.05",
          portalCashbackOnTotal: true,
        }}
      />
    );
    expect(screen.queryByTestId("portal-points-row")).not.toBeInTheDocument();
  });

  it("renders all three rows when all sources present", () => {
    render(
      <BookingPointsEarned
        booking={{
          ...base,
          loyaltyPointsEarned: 8200,
          hotelChain: { name: "Hyatt", loyaltyProgram: "World of Hyatt" },
          userCreditCard: {
            creditCard: {
              name: "Chase Sapphire",
              rewardType: "points",
              rewardRate: "3",
              rewardRules: [],
            },
          },
          shoppingPortal: { name: "Chase UR", rewardType: "points" },
          portalCashbackRate: "5",
          portalCashbackOnTotal: true,
        }}
      />
    );
    expect(screen.getByTestId("loyalty-points-row")).toBeInTheDocument();
    expect(screen.getByTestId("cc-points-row")).toBeInTheDocument();
    expect(screen.getByTestId("portal-points-row")).toBeInTheDocument();
  });
});
