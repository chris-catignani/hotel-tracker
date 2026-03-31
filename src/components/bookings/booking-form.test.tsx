import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { BookingForm } from "./booking-form";
import { calculatePointsFromChain } from "@/lib/loyalty-utils";
import type { Booking } from "@/lib/types";

// Mock the external dependencies
vi.mock("@/lib/loyalty-utils", () => ({
  calculatePointsFromChain: vi.fn(),
}));

vi.mock("@/components/ui/property-name-combobox", () => ({
  PropertyNameCombobox: ({
    id,
    value,
    confirmed,
    onValueChange,
    onReset,
    error,
    "data-testid": testId,
  }: {
    id?: string;
    value: string;
    confirmed: boolean;
    onValueChange: (v: string) => void;
    onReset: () => void;
    error?: string;
    "data-testid"?: string;
  }) =>
    confirmed ? (
      <div data-testid={testId ? `${testId}-confirmed` : undefined}>
        <span>{value}</span>
        <button data-testid={testId ? `${testId}-reset` : undefined} onClick={onReset}>
          Reset
        </button>
      </div>
    ) : (
      <>
        <input
          id={id}
          data-testid={testId}
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
        />
        {error && <p>{error}</p>}
      </>
    ),
}));

vi.mock("@/components/ui/manual-geo-modal", () => ({
  ManualGeoModal: () => null,
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
    pointType: { id: "1", name: "Points", category: "hotel", usdCentsPerPoint: 0.01 },
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
    pointType: { id: "1", name: "Points", category: "hotel", usdCentsPerPoint: 0.01 },
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

  it("shows geo confirmation error when property name is typed but not confirmed", async () => {
    const user = userEvent.setup();
    render(<BookingForm {...defaultProps} />);

    // Type a property name without confirming via autocomplete
    const propertyInput = screen.getByTestId("property-name-input");
    await user.type(propertyInput, "Park Hyatt");

    // Submit the form to trigger validation
    const submitButton = screen.getByTestId("booking-form-submit");
    await user.click(submitButton);

    expect(
      screen.getByText(/please select your property from the list or enter details manually/i)
    ).toBeInTheDocument();
    expect(defaultProps.onSubmit).not.toHaveBeenCalled();
  });

  it("renders correctly with basic fields", async () => {
    render(<BookingForm {...defaultProps} />);
    expect(screen.getByText("Booking Details")).toBeInTheDocument();
    expect(screen.getByText(/Hotel Chain \*/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Property Name/i)).toBeInTheDocument();
  });

  it("calculates number of nights correctly when dates change", async () => {
    const user = userEvent.setup();
    render(<BookingForm {...defaultProps} />);

    const checkInInput = screen.getByLabelText(/Check-in Date/i);
    const checkOutInput = screen.getByLabelText(/Check-out Date/i);
    const numNightsInput = screen.getByLabelText(/Number of Nights/i) as HTMLInputElement;

    await user.type(checkInInput, "2026-03-01");
    await user.clear(checkOutInput);
    await user.type(checkOutInput, "2026-03-05");

    expect(numNightsInput.value).toBe("4");
  });

  it("calls onCancel when cancel button is clicked", async () => {
    const user = userEvent.setup();
    render(<BookingForm {...defaultProps} />);

    const cancelButton = screen.getByRole("button", { name: /Cancel/i });
    await user.click(cancelButton);

    expect(defaultProps.onCancel).toHaveBeenCalled();
  });

  it("Sub-brand selector is always visible but disabled if no chain or no sub-brands", async () => {
    const user = userEvent.setup();
    render(<BookingForm {...defaultProps} />);

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

  it("renders the Confirmation Number field and accepts input", async () => {
    const user = userEvent.setup();
    render(<BookingForm {...defaultProps} />);

    const confirmationInput = screen.getByTestId("confirmation-number-input") as HTMLInputElement;
    expect(confirmationInput).toBeInTheDocument();
    expect(confirmationInput.value).toBe("");

    await user.type(confirmationInput, "ABC-123");
    expect(confirmationInput.value).toBe("ABC-123");
  });
});

describe("BookingForm benefit approximate value", () => {
  // chain-1: basePointRate=10, usdCentsPerPoint=0.01
  const defaultProps = {
    onSubmit: vi.fn(),
    onCancel: vi.fn(),
    submitting: false,
    submitLabel: "Save",
    title: "Booking Details",
  };

  const mockBookingWithMultiplierBenefit = (currency: string): Booking =>
    ({
      id: "booking-1",
      hotelChainId: "chain-1",
      accommodationType: "hotel",
      hotelChainSubBrandId: null,
      propertyId: "prop-1",
      property: {
        id: "prop-1",
        name: "Test Hotel",
        placeId: null,
        chainPropertyId: null,
        hotelChainId: "chain-1",
        countryCode: "US",
        city: "NYC",
        address: null,
        latitude: null,
        longitude: null,
        starRating: null,
        createdAt: "2025-01-01",
      },
      checkIn: "2025-06-01",
      checkOut: "2025-06-03",
      numNights: 2,
      pretaxCost: 100,
      taxAmount: 10,
      totalCost: 110,
      currency,
      lockedExchangeRate: null,
      lockedLoyaltyUsdCentsPerPoint: null,
      userCreditCardId: null,
      userCreditCard: null,
      bookingDate: null,
      paymentTiming: "postpaid",
      shoppingPortalId: null,
      portalCashbackRate: null,
      portalCashbackOnTotal: false,
      loyaltyPointsEarned: null,
      pointsRedeemed: null,
      notes: null,
      certificates: [],
      bookingSource: null,
      otaAgencyId: null,
      loyaltyPostingStatus: null,
      cardRewardPostingStatus: null,
      portalCashbackPostingStatus: null,
      bookingPartnershipEarnStatuses: [],
      benefits: [
        {
          id: "b1",
          benefitType: "other",
          label: "Double Points",
          dollarValue: null,
          pointsEarnType: "multiplier_on_base",
          pointsAmount: null,
          pointsMultiplier: 2,
          postingStatus: "pending",
        },
      ],
      bookingCardBenefits: [],
      confirmationNumber: null,
      ingestionMethod: "manual",
      needsReview: false,
    }) as Booking;

  beforeEach(() => {
    vi.mocked(calculatePointsFromChain).mockReturnValue("0");
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === "/api/hotel-chains") {
        return Promise.resolve({ ok: true, json: async () => mockHotelChains });
      }
      if (url === "/api/exchange-rates") {
        return Promise.resolve({
          ok: true,
          json: async () => [{ fromCurrency: "EUR", rate: "1.1" }],
        });
      }
      if (url === "/api/portals") {
        // Must return non-empty: LOAD_INITIAL_DATA only fires when portals.length > 0
        return Promise.resolve({
          ok: true,
          json: async () => [
            { id: "p1", name: "Test Portal", rewardType: "cashback", pointTypeId: null },
          ],
        });
      }
      return Promise.resolve({ ok: true, json: async () => [] });
    });
  });

  it("multiplier benefit approx value converts native pretaxCost to USD using exchange rate", async () => {
    // EUR booking: pretaxCost=100 EUR, rate=1.1 → costUsd=110
    // extraPts = floor((2-1) × 10 × 110) = 1100; value = 1100 × 0.01 = $11.00
    render(<BookingForm {...defaultProps} initialData={mockBookingWithMultiplierBenefit("EUR")} />);

    // Wait for hotel chains + exchange rates to load, then approx value updates from "—" to "$11.00"
    await waitFor(() => {
      const approxEl = screen.getByTestId("benefit-approx-value-0");
      expect(approxEl).toHaveTextContent("≈ $11.00");
    });
  });

  it("multiplier benefit approx value is correct for USD booking (rate=1)", async () => {
    // USD booking: pretaxCost=100 USD, rate=1 → costUsd=100
    // extraPts = floor((2-1) × 10 × 100) = 1000; value = 1000 × 0.01 = $10.00
    render(<BookingForm {...defaultProps} initialData={mockBookingWithMultiplierBenefit("USD")} />);

    await waitFor(() => {
      const approxEl = screen.getByTestId("benefit-approx-value-0");
      expect(approxEl).toHaveTextContent("≈ $10.00");
    });
  });
});
