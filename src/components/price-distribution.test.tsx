import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { PriceDistribution } from "./price-distribution";

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  BarChart: ({
    children: _children,
    data,
  }: {
    children: React.ReactNode;
    data: { label: string; count: number }[];
  }) => (
    <div data-testid="bar-chart">
      {data.map((d) => (
        <div key={d.label} data-testid={`bar-${d.label}`}>
          {d.label}: {d.count}
        </div>
      ))}
    </div>
  ),
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  Cell: () => null,
}));

// Minimal BookingWithRelations shape needed by PriceDistribution
function makeBooking(overrides: {
  id?: string;
  totalCost?: number;
  numNights?: number;
  pretaxCost?: number;
  taxAmount?: number;
  lockedExchangeRate?: number | null;
  pointsRedeemed?: number | null;
}) {
  const {
    id = "1",
    totalCost = 300,
    numNights = 3,
    pretaxCost = 270,
    taxAmount = 30,
    lockedExchangeRate = 1,
    pointsRedeemed = null,
  } = overrides;
  return {
    id,
    totalCost: String(totalCost),
    numNights,
    pretaxCost: String(pretaxCost),
    taxAmount: String(taxAmount),
    lockedExchangeRate,
    currency: "USD",
    checkIn: "2026-06-01",
    checkOut: "2026-06-04",
    pointsRedeemed,
    portalCashbackRate: null,
    portalCashbackOnTotal: false,
    loyaltyPointsEarned: null,
    notes: null,
    hotelChainId: null,
    accommodationType: "hotel",
    otaAgencyId: null,
    bookingSource: null,
    hotelChain: null,
    hotelChainSubBrand: null,
    userCreditCard: null,
    shoppingPortal: null,
    bookingPromotions: [],
    certificates: [],
    property: { name: "Test Hotel", countryCode: "US", city: "New York" },
  };
}

describe("PriceDistribution", () => {
  it("buckets a cash booking by Net/Night correctly", () => {
    // $300 total, 3 nights, no savings → Net/Night = $100 → $100–150 bucket
    const booking = makeBooking({ totalCost: 300, numNights: 3 });
    render(<PriceDistribution bookings={[booking as never]} />);
    expect(screen.getByTestId("bar-$100–150")).toHaveTextContent("$100–150: 1");
    expect(screen.getByTestId("bar-$0–50")).toHaveTextContent("$0–50: 0");
  });

  it("clamps negative Net/Night to $0–50 bucket", () => {
    // Make net cost effectively 0 — $0 totalCost award stay with no redemption value
    // calculateNetCost will return 0, clamped to $0–50
    const booking = makeBooking({ totalCost: 0, numNights: 3, pretaxCost: 0, taxAmount: 0 });
    render(<PriceDistribution bookings={[booking as never]} />);
    expect(screen.getByTestId("bar-$0–50")).toHaveTextContent("$0–50: 1");
  });

  it("Total/Night mode includes award stays via redemption value", async () => {
    const user = userEvent.setup();
    // Award stay: totalCost=0, pointsRedeemed=30000 pts
    // getNetCostBreakdown will compute pointsRedeemedValue from the points and point type
    // Without a hotelChain/pointType, pointsRedeemedValue = 0 → lands in $0–50
    // This test verifies the award stay IS included (count=1), not excluded
    const awardBooking = makeBooking({
      totalCost: 0,
      numNights: 3,
      pretaxCost: 0,
      taxAmount: 0,
      pointsRedeemed: 30000,
    });
    render(<PriceDistribution bookings={[awardBooking as never]} />);
    await user.click(screen.getByText("Total/Night"));
    // Award stay should appear in some bucket (not be excluded)
    const allBuckets = screen.getAllByTestId(/^bar-/);
    const totalCount = allBuckets.reduce((sum, el) => {
      const match = el.textContent?.match(/: (\d+)$/);
      return sum + (match ? parseInt(match[1]) : 0);
    }, 0);
    expect(totalCount).toBe(1); // Award stay is included, not excluded
  });

  it("Nights mode sums numNights per bucket", async () => {
    const user = userEvent.setup();
    const booking = makeBooking({ totalCost: 300, numNights: 5 });
    render(<PriceDistribution bookings={[booking as never]} />);
    await user.click(screen.getByText("Nights"));
    expect(screen.getByTestId("bar-$100–150")).toHaveTextContent("$100–150: 5");
  });

  it("Total/Night mode uses gross cost for cash stays", async () => {
    const user = userEvent.setup();
    // $300 / 3 nights = $100/night → $100–150 bucket
    const booking = makeBooking({ totalCost: 300, numNights: 3 });
    render(<PriceDistribution bookings={[booking as never]} />);
    await user.click(screen.getByText("Total/Night"));
    expect(screen.getByTestId("bar-$100–150")).toHaveTextContent("$100–150: 1");
  });

  it("shows empty state when no bookings", () => {
    render(<PriceDistribution bookings={[]} />);
    expect(screen.getByTestId("price-distribution-card")).toBeInTheDocument();
    // Empty state should appear
    expect(screen.queryByTestId("bar-chart")).not.toBeInTheDocument();
  });
});
