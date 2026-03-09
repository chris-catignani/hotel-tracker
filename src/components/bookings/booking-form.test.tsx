import { render, screen, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BookingForm } from "./booking-form";
import { calculatePointsFromChain } from "@/lib/loyalty-utils";

// Mock the external dependencies
vi.mock("@/lib/loyalty-utils", () => ({
  calculatePointsFromChain: vi.fn(),
}));

vi.mock("@/components/ui/property-name-combobox", () => ({
  PropertyNameCombobox: ({
    id,
    value,
    onValueChange,
    "data-testid": testId,
  }: {
    id?: string;
    value: string;
    onValueChange: (v: string) => void;
    "data-testid"?: string;
  }) => (
    <input
      id={id}
      data-testid={testId}
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
    />
  ),
}));

vi.mock("@/components/ui/date-picker", () => ({
  DatePicker: ({
    setDate,
    id,
    date,
  }: {
    setDate: (date?: Date) => void;
    id?: string;
    date?: Date;
  }) => (
    <input
      id={id}
      type="date"
      value={date ? date.toISOString().split("T")[0] : ""}
      onChange={(e) => {
        const val = e.target.value;
        if (val) {
          const d = new Date(val);
          // Set to noon to avoid timezone issues during testing
          d.setHours(12, 0, 0, 0);
          setDate(d);
        } else {
          setDate(undefined);
        }
      }}
    />
  ),
}));

const mockHotelChains = [
  {
    id: "chain-1",
    name: "Chain 1",
    loyaltyProgram: "Program 1",
    basePointRate: 10,
    pointTypeId: "1",
    pointType: { id: "1", name: "Points", category: "hotel", centsPerPoint: 0.01 },
    hotelChainSubBrands: [{ id: "sb-1", name: "Sub 1" }],
    eliteStatuses: [],
    userStatus: null,
  },
  {
    id: "chain-2",
    name: "Chain 2",
    loyaltyProgram: "Program 2",
    basePointRate: 10,
    pointTypeId: "1",
    pointType: { id: "1", name: "Points", category: "hotel", centsPerPoint: 0.01 },
    hotelChainSubBrands: [],
    eliteStatuses: [],
    userStatus: null,
  },
];

describe("BookingForm", () => {
  const defaultProps = {
    onSubmit: vi.fn(),
    onCancel: vi.fn(),
    submitting: false,
    submitLabel: "Save",
    title: "Booking Details",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(calculatePointsFromChain).mockReturnValue("1000");
    // Mock global fetch
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url === "/api/hotel-chains") {
        return Promise.resolve({
          ok: true,
          json: async () => mockHotelChains,
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => [],
      });
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
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
    const user = userEvent.setup();
    await act(async () => {
      render(<BookingForm {...defaultProps} />);
    });

    const checkInInput = screen.getByLabelText(/Check-in Date/i);
    const checkOutInput = screen.getByLabelText(/Check-out Date/i);
    const numNightsInput = screen.getByLabelText(/Number of Nights/i) as HTMLInputElement;

    await act(async () => {
      await user.type(checkInInput, "2026-03-01");
      await user.clear(checkOutInput);
      await user.type(checkOutInput, "2026-03-05");
    });

    expect(numNightsInput.value).toBe("4");
  });

  it("calls onCancel when cancel button is clicked", async () => {
    const user = userEvent.setup();
    await act(async () => {
      render(<BookingForm {...defaultProps} />);
    });

    const cancelButton = screen.getByRole("button", { name: /Cancel/i });
    await act(async () => {
      await user.click(cancelButton);
    });

    expect(defaultProps.onCancel).toHaveBeenCalled();
  });

  it("Sub-brand selector is always visible but disabled if no chain or no sub-brands", async () => {
    const user = userEvent.setup();
    await act(async () => {
      render(<BookingForm {...defaultProps} />);
    });

    // 1. Initially disabled (no chain selected)
    const subBrandSelector = screen.getByTestId("sub-brand-select");
    expect(subBrandSelector).toBeDisabled();
    expect(await screen.findByText("Select chain first...")).toBeInTheDocument();

    // 2. Select chain with sub-brands -> should enable
    const hotelChainSelector = screen.getByTestId("hotel-chain-select");
    await user.click(hotelChainSelector);
    const optionChain1 = await screen.findByRole("option", { name: "Chain 1" });
    await user.click(optionChain1);

    await waitFor(() => {
      expect(screen.getByTestId("sub-brand-select")).not.toBeDisabled();
    });
    // Defaults to "none" which is "None / Not applicable"
    expect(screen.getByText("None / Not applicable")).toBeInTheDocument();

    // 3. Select chain without sub-brands -> should disable again
    await user.click(screen.getByTestId("hotel-chain-select"));
    const optionChain2 = await screen.findByRole("option", { name: "Chain 2" });
    await user.click(optionChain2);

    await waitFor(() => {
      expect(screen.getByTestId("sub-brand-select")).toBeDisabled();
    });
    expect(screen.getByText("None / Not applicable")).toBeInTheDocument();
  });
});
