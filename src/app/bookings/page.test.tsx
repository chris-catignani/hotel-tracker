import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import BookingsPage from "./page";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("BookingsPage", () => {
  it("shows an error banner and no booking rows when the bookings API fails", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: "Internal server error" }),
    });

    render(<BookingsPage />);

    await waitFor(() => {
      expect(screen.getByTestId("error-banner")).toBeInTheDocument();
    });

    expect(screen.queryAllByTestId(/^booking-row-/)).toHaveLength(0);
  });

  it("shows estimated rate warning when booking has exchangeRateEstimated=true", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [
        {
          id: "bk1",
          currency: "AUD",
          lockedExchangeRate: "0.63",
          pretaxCost: "100",
          taxAmount: "10",
          totalCost: "110",
          checkIn: "2026-01-15",
          checkOut: "2026-01-17",
          numNights: 2,
          isFutureEstimate: false,
          exchangeRateEstimated: true,
          hotelChainId: null,
          hotelChain: null,
          hotelChainSubBrand: null,
          shoppingPortal: null,
          portalCashbackRate: null,
          portalCashbackOnTotal: false,
          userCreditCard: null,
          loyaltyPointsEarned: null,
          pointsRedeemed: null,
          loyaltyPointsEstimated: false,
          certificates: [],
          bookingPromotions: [],
          benefits: [],
          propertyId: "prop1",
          property: {
            name: "Test Hotel",
            countryCode: "AU",
            city: "Sydney",
            address: null,
            latitude: null,
            longitude: null,
          },
          partnershipEarns: [],
          accommodationType: "hotel",
        },
      ],
    });

    const user = userEvent.setup();
    render(<BookingsPage />);

    // jsdom has no media queries, so only the mobile card view renders
    await waitFor(() => {
      expect(screen.getByTestId("booking-card-bk1")).toBeInTheDocument();
    });

    // Open the cost popover to reveal the estimated rate warning.
    // Both mobile card and desktop table render in jsdom (CSS visibility ignored),
    // so use getAllByTestId and click the first one.
    const triggers = screen.getAllByTestId("cost-popover-trigger");
    await user.click(triggers[0]);

    await waitFor(() => {
      expect(
        screen.getByText("Historical rate unavailable — estimated using current rate")
      ).toBeInTheDocument();
    });
  });
});
