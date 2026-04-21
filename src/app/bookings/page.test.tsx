import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import BookingsPage from "./page";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

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

  it("shows amber needs-review badge on booking with needsReview=true", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [
        {
          id: "bk-review",
          currency: "USD",
          lockedExchangeRate: "1",
          pretaxCost: "100",
          taxAmount: "10",
          totalCost: "110",
          checkIn: "2026-06-14",
          checkOut: "2026-06-18",
          numNights: 4,
          isFutureEstimate: false,
          exchangeRateEstimated: false,
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
            countryCode: "US",
            city: "Salt Lake City",
            address: null,
            latitude: null,
            longitude: null,
          },
          partnershipEarns: [],
          accommodationType: "hotel",
          needsReview: true,
          ingestionMethod: "email",
          confirmationNumber: "12345",
          priceWatchBookings: [],
        },
      ],
    });

    render(<BookingsPage />);

    await waitFor(() => {
      expect(screen.getByTestId("needs-review-badge")).toBeInTheDocument();
    });
  });

  it("does not show needs-review badge when booking has needsReview=false", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [
        {
          id: "bk-no-review",
          currency: "USD",
          lockedExchangeRate: "1",
          pretaxCost: "100",
          taxAmount: "10",
          totalCost: "110",
          checkIn: "2026-01-14",
          checkOut: "2026-01-18",
          numNights: 4,
          isFutureEstimate: false,
          exchangeRateEstimated: false,
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
            countryCode: "US",
            city: "Salt Lake City",
            address: null,
            latitude: null,
            longitude: null,
          },
          partnershipEarns: [],
          accommodationType: "hotel",
          needsReview: false,
          ingestionMethod: "manual",
          confirmationNumber: null,
          priceWatchBookings: [],
        },
      ],
    });

    render(<BookingsPage />);

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByTestId("booking-card-bk-no-review")).toBeInTheDocument();
    });

    expect(screen.queryByTestId("needs-review-badge")).not.toBeInTheDocument();
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
          priceWatchBookings: [],
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

  it("shows dash for hotel booking with no matched chain", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [
        {
          id: "bk-no-chain",
          currency: "USD",
          lockedExchangeRate: "1",
          pretaxCost: "100",
          taxAmount: "10",
          totalCost: "110",
          checkIn: "2026-06-14",
          checkOut: "2026-06-16",
          numNights: 2,
          isFutureEstimate: false,
          exchangeRateEstimated: false,
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
            name: "Kimpton Margot Sydney",
            countryCode: "AU",
            city: "Sydney",
            address: null,
            latitude: null,
            longitude: null,
          },
          partnershipEarns: [],
          accommodationType: "hotel",
          needsReview: false,
          ingestionMethod: "email",
          confirmationNumber: "ABC123",
          priceWatchBookings: [],
        },
      ],
    });

    render(<BookingsPage />);

    await waitFor(() => {
      expect(screen.getByTestId("booking-row-bk-no-chain")).toBeInTheDocument();
    });

    expect(screen.getByTestId("chain-cell-bk-no-chain")).toHaveTextContent("—");
  });

  it("shows Apartment / Rental for apartment booking with no chain", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [
        {
          id: "bk-apt",
          currency: "USD",
          lockedExchangeRate: "1",
          pretaxCost: "100",
          taxAmount: "10",
          totalCost: "110",
          checkIn: "2026-06-14",
          checkOut: "2026-06-16",
          numNights: 2,
          isFutureEstimate: false,
          exchangeRateEstimated: false,
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
            name: "The Top Floor Apartment",
            countryCode: "NZ",
            city: "Queenstown",
            address: null,
            latitude: null,
            longitude: null,
          },
          partnershipEarns: [],
          accommodationType: "apartment",
          needsReview: false,
          ingestionMethod: "email",
          confirmationNumber: "ABC456",
          priceWatchBookings: [],
        },
      ],
    });

    render(<BookingsPage />);

    await waitFor(() => {
      expect(screen.getByTestId("booking-row-bk-apt")).toBeInTheDocument();
    });

    expect(screen.getByTestId("chain-cell-bk-apt")).toHaveTextContent("Apartment / Rental");
  });
});
