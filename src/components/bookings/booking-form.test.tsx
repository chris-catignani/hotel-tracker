import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { BookingForm } from "./booking-form";
import { HotelChain } from "@/lib/types";

// Mock the external dependencies
vi.mock("@/lib/loyalty-utils", () => ({
  calculatePointsFromChain: vi.fn(() => 1000),
}));

const mockHotelChains: HotelChain[] = [
  {
    id: 1,
    name: "Marriott",
    loyaltyProgram: "Bonvoy",
    basePointRate: 10,
    pointTypeId: 1,
    pointType: { id: 1, name: "Points", category: "hotel", centsPerPoint: 0.01 },
    hotelChainSubBrands: [],
    eliteStatuses: [],
    userStatus: null,
  },
];

describe("BookingForm", () => {
  const defaultProps = {
    hotelChains: mockHotelChains,
    creditCards: [],
    portals: [],
    otaAgencies: [],
    onSubmit: vi.fn(),
    onCancel: vi.fn(),
    submitting: false,
    submitLabel: "Save",
    title: "Booking Details",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock global fetch
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    });
  });

  it("renders correctly with basic fields", async () => {
    await act(async () => {
      render(<BookingForm {...defaultProps} />);
    });
    expect(screen.getByText("Booking Details")).toBeInTheDocument();
    expect(screen.getByText(/Hotel Chain \*/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Property Name/i)).toBeInTheDocument();
  });

  it("calculates number of nights correctly when dates change", async () => {
    await act(async () => {
      render(<BookingForm {...defaultProps} />);
    });

    const checkInInput = screen.getByLabelText(/Check-in Date/i);
    const checkOutInput = screen.getByLabelText(/Check-out Date/i);
    const numNightsInput = screen.getByLabelText(/Number of Nights/i) as HTMLInputElement;

    await act(async () => {
      fireEvent.change(checkInInput, { target: { value: "2026-03-01" } });
      fireEvent.change(checkOutInput, { target: { value: "2026-03-05" } });
    });

    expect(numNightsInput.value).toBe("4");
  });

  it("calls onCancel when cancel button is clicked", async () => {
    await act(async () => {
      render(<BookingForm {...defaultProps} />);
    });
    await act(async () => {
      fireEvent.click(screen.getByText(/Cancel/i));
    });
    expect(defaultProps.onCancel).toHaveBeenCalled();
  });
});
