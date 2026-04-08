import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import DashboardPage from "./page";

// recharts doesn't work in jsdom — mock the components that use it
vi.mock("@/components/payment-type-breakdown", () => ({
  PaymentTypeBreakdown: () => null,
}));
vi.mock("@/components/sub-brand-breakdown", () => ({
  SubBrandBreakdown: () => null,
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("DashboardPage", () => {
  it("shows needs-review callout when bookings have needsReview=true", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [
        {
          id: "bk1",
          checkIn: "2026-06-14",
          checkOut: "2026-06-18",
          numNights: 4,
          pretaxCost: "500",
          taxAmount: "80",
          totalCost: "580",
          currency: "USD",
          lockedExchangeRate: 1,
          portalCashbackRate: null,
          portalCashbackOnTotal: false,
          loyaltyPointsEarned: null,
          pointsRedeemed: null,
          notes: null,
          hotelChainId: null,
          accommodationType: "hotel",
          needsReview: true,
          otaAgencyId: null,
          bookingSource: null,
          hotelChain: null,
          hotelChainSubBrand: null,
          userCreditCard: null,
          shoppingPortal: null,
          bookingPromotions: [],
          bookingCardBenefits: [],
          certificates: [],
          benefits: [],
          partnershipEarns: [],
          property: {
            name: "Test Hotel",
            countryCode: "US",
            city: "Salt Lake City",
            address: null,
            latitude: null,
            longitude: null,
          },
          propertyId: "prop1",
          isFutureEstimate: false,
          exchangeRateEstimated: false,
          loyaltyPointsEstimated: false,
        },
      ],
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByTestId("needs-review-callout")).toBeInTheDocument();
    });
  });

  it("does not show needs-review callout when no bookings need review", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [
        {
          id: "bk2",
          checkIn: "2026-06-14",
          checkOut: "2026-06-18",
          numNights: 4,
          pretaxCost: "500",
          taxAmount: "80",
          totalCost: "580",
          currency: "USD",
          lockedExchangeRate: 1,
          portalCashbackRate: null,
          portalCashbackOnTotal: false,
          loyaltyPointsEarned: null,
          pointsRedeemed: null,
          notes: null,
          hotelChainId: null,
          accommodationType: "hotel",
          needsReview: false,
          otaAgencyId: null,
          bookingSource: null,
          hotelChain: null,
          hotelChainSubBrand: null,
          userCreditCard: null,
          shoppingPortal: null,
          bookingPromotions: [],
          bookingCardBenefits: [],
          certificates: [],
          benefits: [],
          partnershipEarns: [],
          property: {
            name: "Test Hotel",
            countryCode: "US",
            city: "Salt Lake City",
            address: null,
            latitude: null,
            longitude: null,
          },
          propertyId: "prop2",
          isFutureEstimate: false,
          exchangeRateEstimated: false,
          loyaltyPointsEstimated: false,
        },
      ],
    });

    render(<DashboardPage />);

    // Wait for data to load (stat widget renders after fetch resolves)
    await waitFor(() => {
      expect(screen.getByTestId("stat-value-total-bookings")).toBeInTheDocument();
    });
    // Now absence is meaningful — data has loaded and callout should not be there
    expect(screen.queryByTestId("needs-review-callout")).not.toBeInTheDocument();
  });

  it("shows an error banner when the bookings API fails", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: "Internal server error" }),
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByTestId("error-banner")).toBeInTheDocument();
    });
  });
});
