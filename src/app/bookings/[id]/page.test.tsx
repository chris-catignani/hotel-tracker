import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import BookingDetailPage from "./page";

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "bk-1" }),
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Minimal booking fixture — cash, postpaid, no portal, no OTA
const cashBooking = {
  id: "bk-1",
  accommodationType: "hotel",
  paymentType: "cash",
  paymentTiming: "postpaid",
  bookingDate: null,
  currency: "USD",
  lockedExchangeRate: "1",
  pretaxCost: "450",
  taxAmount: "37",
  totalCost: "487",
  pointsRedeemed: null,
  loyaltyPointsEarned: null,
  loyaltyPointsEstimated: false,
  isFutureEstimate: false,
  exchangeRateEstimated: false,
  checkIn: "2026-06-10",
  checkOut: "2026-06-13",
  numNights: 3,
  needsReview: false,
  bookingSource: null,
  otaAgencyId: null,
  otaAgency: null,
  confirmationNumber: null,
  notes: null,
  certificates: [],
  benefits: [],
  bookingPromotions: [],
  bookingCardBenefits: [],
  partnershipEarns: [],
  priceWatchBooking: null,
  shoppingPortalId: null,
  shoppingPortal: null,
  portalCashbackRate: null,
  portalCashbackOnTotal: null,
  userCreditCardId: null,
  userCreditCard: null,
  hotelChainId: "chain-hyatt",
  hotelChain: {
    id: "chain-hyatt",
    name: "Hyatt",
    loyaltyProgram: "World of Hyatt",
    pointType: null,
  },
  hotelChainSubBrand: null,
  property: {
    id: "prop-1",
    name: "Hyatt Regency Chicago",
    city: "Chicago",
    countryCode: "US",
    chainPropertyId: null,
  },
  propertyId: "prop-1",
};

function mockSuccess(booking: object) {
  mockFetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => booking,
  });
}

describe("BookingDetailPage", () => {
  it("shows property name as page title", async () => {
    mockSuccess(cashBooking);
    render(<BookingDetailPage />);
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Hyatt Regency Chicago" })).toBeInTheDocument()
    );
  });

  it("renders hero card with dates and net cost", async () => {
    mockSuccess(cashBooking);
    render(<BookingDetailPage />);
    await waitFor(() => expect(screen.getByTestId("hero-net-cost")).toBeInTheDocument());
    expect(screen.getByTestId("hero-check-in")).toBeInTheDocument();
    expect(screen.getByTestId("hero-check-out")).toBeInTheDocument();
    expect(screen.getByTestId("hero-nights")).toHaveTextContent("3");
  });

  it("shows points redeemed in hero for an award stay", async () => {
    mockSuccess({
      ...cashBooking,
      paymentType: "points",
      totalCost: "0",
      pretaxCost: "0",
      taxAmount: "0",
      pointsRedeemed: 30000,
    });
    render(<BookingDetailPage />);
    await waitFor(() =>
      expect(screen.getByTestId("hero-net-cost")).toHaveTextContent("30,000 pts")
    );
  });

  it("shows payment type in details card", async () => {
    mockSuccess(cashBooking);
    render(<BookingDetailPage />);
    await waitFor(() => expect(screen.getByTestId("payment-type")).toHaveTextContent("Cash"));
  });

  it("shows total cost for cash bookings", async () => {
    mockSuccess(cashBooking);
    render(<BookingDetailPage />);
    await waitFor(() => expect(screen.getByTestId("total-cost-usd")).toBeInTheDocument());
  });

  it("hides booking date for postpaid booking", async () => {
    mockSuccess(cashBooking);
    render(<BookingDetailPage />);
    await waitFor(() => screen.getByTestId("payment-type"));
    expect(screen.queryByTestId("booking-date")).not.toBeInTheDocument();
  });

  it("shows booking date for prepaid booking", async () => {
    mockSuccess({ ...cashBooking, paymentTiming: "prepaid", bookingDate: "2026-05-01" });
    render(<BookingDetailPage />);
    await waitFor(() => expect(screen.getByTestId("booking-date")).toBeInTheDocument());
  });

  it("shows OTA field when booking source is ota", async () => {
    mockSuccess({
      ...cashBooking,
      bookingSource: "ota",
      otaAgencyId: "ota-1",
      otaAgency: { id: "ota-1", name: "Expedia" },
    });
    render(<BookingDetailPage />);
    await waitFor(() => expect(screen.getByTestId("booking-ota")).toHaveTextContent("Expedia"));
  });

  it("hides OTA field when booking source is direct", async () => {
    mockSuccess({ ...cashBooking, bookingSource: "direct_web" });
    render(<BookingDetailPage />);
    await waitFor(() => screen.getByTestId("booking-source"));
    expect(screen.queryByTestId("booking-ota")).not.toBeInTheDocument();
  });

  it("shows confirmation number when present", async () => {
    mockSuccess({ ...cashBooking, confirmationNumber: "H-12345" });
    render(<BookingDetailPage />);
    await waitFor(() =>
      expect(screen.getByTestId("confirmation-number")).toHaveTextContent("H-12345")
    );
  });

  it("shows cert badges for cert payment", async () => {
    mockSuccess({
      ...cashBooking,
      paymentType: "cert",
      totalCost: "0",
      pretaxCost: "0",
      certificates: [{ id: "c1", certType: "hyatt_cat1_4" }],
    });
    render(<BookingDetailPage />);
    await waitFor(() => expect(screen.getByTestId("cert-badges")).toBeInTheDocument());
  });

  it("shows both cash fields and cert badges for cash+cert payment", async () => {
    mockSuccess({
      ...cashBooking,
      paymentType: "cash_cert",
      certificates: [{ id: "c1", certType: "hyatt_cat1_4" }],
    });
    render(<BookingDetailPage />);
    await waitFor(() => screen.getByTestId("total-cost-usd"));
    expect(screen.getByTestId("cert-badges")).toBeInTheDocument();
  });

  it("shows needs-review banner when needsReview is true", async () => {
    mockSuccess({ ...cashBooking, needsReview: true });
    render(<BookingDetailPage />);
    await waitFor(() => expect(screen.getByTestId("needs-review-banner")).toBeInTheDocument());
  });

  it("shows error banner on fetch failure", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    render(<BookingDetailPage />);
    await waitFor(() => expect(screen.getByTestId("error-banner")).toBeInTheDocument());
  });
});
