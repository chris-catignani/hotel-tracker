import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import NewBookingPage from "./page";

// Mock next/navigation
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Mock BookingForm with a simplified version that calls onSubmit with a fixed payload
vi.mock("@/components/bookings/booking-form", () => ({
  BookingForm: ({
    onSubmit,
    onCancel,
  }: {
    onSubmit: (data: unknown) => void;
    onCancel: () => void;
  }) => (
    <div>
      <button
        onClick={() =>
          onSubmit({
            hotelChainId: "chain1",
            checkIn: "2025-01-10",
            checkOut: "2025-01-15",
            numNights: 5,
            pretaxCost: 400,
            taxAmount: 80,
            totalCost: 480,
            currency: "USD",
            pointsRedeemed: null,
            certificates: [],
            userCreditCardId: null,
            bookingDate: null,
            paymentTiming: "postpaid",
            shoppingPortalId: null,
            portalCashbackRate: null,
            portalCashbackOnTotal: false,
            loyaltyPointsEarned: null,
            bookingSource: null,
            otaAgencyId: null,
            benefits: [],
            notes: null,
          })
        }
      >
        Submit
      </button>
      <button onClick={onCancel}>Cancel</button>
    </div>
  ),
}));

vi.mock("@/components/ui/error-banner", () => ({
  ErrorBanner: () => null,
}));

describe("NewBookingPage", () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === "/api/bookings") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ id: "booking-123", propertyId: "prop-456" }),
        });
      }
      if (url === "/api/price-watches") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
  });

  it("renders the price watch card", () => {
    render(<NewBookingPage />);
    expect(screen.getByText("Price Watch")).toBeInTheDocument();
    expect(screen.getByTestId("new-booking-price-watch-toggle")).toBeInTheDocument();
  });

  it("threshold inputs are hidden by default", () => {
    render(<NewBookingPage />);
    expect(screen.queryByTestId("new-booking-cash-threshold")).not.toBeInTheDocument();
  });

  it("threshold inputs appear when toggle is enabled", async () => {
    const user = userEvent.setup();
    render(<NewBookingPage />);

    await user.click(screen.getByTestId("new-booking-price-watch-toggle"));

    expect(screen.getByTestId("new-booking-cash-threshold")).toBeInTheDocument();
    expect(screen.getByTestId("new-booking-award-threshold")).toBeInTheDocument();
  });

  it("submitting without price watch redirects to booking detail without creating a watch", async () => {
    const user = userEvent.setup();
    render(<NewBookingPage />);

    await user.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/bookings",
        expect.objectContaining({ method: "POST" })
      );
    });

    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    const calls = fetchMock.mock.calls.map((c: unknown[]) => c[0]);
    expect(calls).not.toContain("/api/price-watches");

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/bookings/booking-123");
    });
  });

  it("submitting with price watch enabled creates a watch and redirects to booking detail", async () => {
    const user = userEvent.setup();
    render(<NewBookingPage />);

    // Enable the toggle
    await user.click(screen.getByTestId("new-booking-price-watch-toggle"));

    // Set cash threshold
    const cashInput = screen.getByTestId("new-booking-cash-threshold");
    await user.type(cashInput, "300");

    // Submit the form
    await user.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/price-watches",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            propertyId: "prop-456",
            isEnabled: true,
            bookingId: "booking-123",
            cashThreshold: 300,
            awardThreshold: null,
          }),
        })
      );
    });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/bookings/booking-123");
    });
  });
});
