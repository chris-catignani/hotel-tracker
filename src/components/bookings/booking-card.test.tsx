import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { BookingCard } from "./booking-card";

describe("BookingCard", () => {
  const mockBooking = {
    id: 1,
    propertyName: "Grand Hyatt New York",
    checkIn: "2026-03-01",
    checkOut: "2026-03-04",
    numNights: 3,
    totalCost: 900,
    pretaxCost: 750,
    portalCashbackOnTotal: true,
    portalCashbackRate: 0.05,
    loyaltyPointsEarned: 7500,
    pointsRedeemed: null,
    certificates: [],
    hotelChain: {
      name: "Hyatt",
      loyaltyProgram: "World of Hyatt",
      basePointRate: 5,
      pointType: { name: "Hyatt Points", centsPerPoint: 0.015 },
    },
    hotelChainSubBrand: { name: "Grand Hyatt" },
    creditCard: {
      name: "Chase Sapphire Reserve",
      rewardRate: 3,
      pointType: { name: "Ultimate Rewards", centsPerPoint: 0.02 },
    },
    shoppingPortal: {
      name: "Rakuten",
      rewardType: "cash",
      pointType: null,
    },
    bookingPromotions: [],
  };

  it("renders booking information correctly", async () => {
    await act(async () => {
      render(<BookingCard booking={mockBooking} />);
    });

    expect(screen.getByTestId("booking-card-property")).toHaveTextContent("Grand Hyatt New York");
    expect(screen.getByText("Hyatt")).toBeInTheDocument();
    expect(screen.getByText("Grand Hyatt")).toBeInTheDocument();

    // Check formatting
    expect(screen.getByText("03/01/2026 (3n)")).toBeInTheDocument();
    expect(screen.getByText("$900.00")).toBeInTheDocument();
  });

  it("shows delete button when showActions and onDelete are provided", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    await act(async () => {
      render(<BookingCard booking={mockBooking} showActions={true} onDelete={onDelete} />);
    });

    const deleteBtn = screen.getByTestId("booking-card-delete");
    expect(deleteBtn).toBeInTheDocument();

    await user.click(deleteBtn);
    expect(onDelete).toHaveBeenCalledWith(1);
  });

  it("calculates and displays the correct net cost per night", async () => {
    await act(async () => {
      render(<BookingCard booking={mockBooking} />);
    });

    // Total Cost = 900
    // Portal Cashback = 900 * 0.05 = 45
    // Card Reward = 900 * 3 * 0.02 = 54
    // Loyalty Points Value = 7500 * 0.015 = 112.5
    // Net Cost = 900 - 45 - 54 - 112.5 = 688.5
    // Net/Night = 688.5 / 3 = 229.5

    expect(screen.getByTestId("booking-card-net-night")).toHaveTextContent("$229.50");
  });
});
