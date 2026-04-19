import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { PaymentTypeBreakdown } from "./payment-type-breakdown";

// Mock Recharts to avoid issues in JSDOM
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PieChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Pie: ({ data }: { data: { name: string; value: number }[] }) => (
    <div data-testid="pie-chart">
      {data.map((entry, i: number) => (
        <div key={i} data-testid={`pie-slice-${entry.name}`}>
          {entry.name}: {entry.value}
        </div>
      ))}
    </div>
  ),
  Cell: () => null,
  Tooltip: () => null,
  Legend: () => null,
}));

describe("PaymentTypeBreakdown", () => {
  const mockBookings = [
    {
      id: "1",
      numNights: 3,
      totalCost: 500,
      pointsRedeemed: 0,
      certificates: [],
    },
    {
      id: "2",
      numNights: 2,
      totalCost: 0,
      pointsRedeemed: 20000,
      certificates: [],
    },
    {
      id: "3",
      numNights: 1,
      totalCost: 0,
      pointsRedeemed: 0,
      certificates: [{ id: "1", certType: "marriott_35k" }],
    },
  ];

  it("calculates stays breakdown correctly", async () => {
    render(<PaymentTypeBreakdown bookings={mockBookings} />);

    // By default it shows "Stays" mode
    expect(screen.getByTestId("pie-slice-Cash")).toHaveTextContent("Cash: 1");
    expect(screen.getByTestId("pie-slice-Points")).toHaveTextContent("Points: 1");
    expect(screen.getByTestId("pie-slice-Certificates")).toHaveTextContent("Certificates: 1");
  });

  it("calculates nights breakdown correctly", async () => {
    const user = userEvent.setup();
    render(<PaymentTypeBreakdown bookings={mockBookings} />);

    // Switch to Nights mode
    await user.click(screen.getByText("Nights"));

    expect(screen.getByTestId("pie-slice-Cash")).toHaveTextContent("Cash: 3");
    expect(screen.getByTestId("pie-slice-Points")).toHaveTextContent("Points: 2");
    expect(screen.getByTestId("pie-slice-Certificates")).toHaveTextContent("Certificates: 1");
  });

  it("handles combination stays correctly", async () => {
    const user = userEvent.setup();
    const combinationBookings = [
      {
        id: "4",
        numNights: 3,
        totalCost: 100, // Cash
        pointsRedeemed: 10000, // Points
        certificates: [],
      },
    ];
    render(<PaymentTypeBreakdown bookings={combinationBookings} />);

    // Stays mode: 1 combination stay
    expect(screen.getByTestId("pie-slice-Combination")).toHaveTextContent("Combination: 1");

    // Nights mode: cash + points with 3 nights can't be deduced per-night,
    // so all 3 nights appear as Combination.
    await user.click(screen.getByText("Nights"));
    expect(screen.getByTestId("pie-slice-Combination")).toHaveTextContent("Combination: 3");
    expect(screen.queryByText(/ignored/)).not.toBeInTheDocument();
  });

  it("applies the $20 significant cash rule", async () => {
    const user = userEvent.setup();
    const incidentalBooking = [
      {
        id: "5",
        numNights: 1,
        totalCost: 12.5, // Insignificant cash (< $20)
        pointsRedeemed: 15000, // Points
        certificates: [],
      },
    ];
    render(<PaymentTypeBreakdown bookings={incidentalBooking} />);

    // In "stays" mode, it still counts as a combination
    expect(screen.getByTestId("pie-slice-Combination")).toHaveTextContent("Combination: 1");

    // In "nights" mode, the < $20 cash is ignored because there's another method (Points)
    await user.click(screen.getByText("Nights"));
    expect(screen.getByTestId("pie-slice-Points")).toHaveTextContent("Points: 1");
    expect(screen.queryByText(/ignored/)).not.toBeInTheDocument();
  });

  it("deduces nightly breakdown for cert + one other type", async () => {
    const user = userEvent.setup();
    const certPlusCash = [
      {
        id: "6",
        numNights: 3,
        totalCost: 200, // Significant cash
        pointsRedeemed: 0,
        certificates: [{ id: "1", certType: "cat4" }], // 1 cert
      },
    ];
    render(<PaymentTypeBreakdown bookings={certPlusCash} />);
    await user.click(screen.getByText("Nights"));

    // Deduction: 1 cert night, 2 cash nights
    expect(screen.getByTestId("pie-slice-Certificates")).toHaveTextContent("Certificates: 1");
    expect(screen.getByTestId("pie-slice-Cash")).toHaveTextContent("Cash: 2");
  });

  it("ignores no-payment bookings in nights mode", async () => {
    const user = userEvent.setup();
    const noPaymentBooking = [
      {
        id: "7",
        numNights: 7,
        totalCost: 0,
        pointsRedeemed: null,
        certificates: [],
      },
    ];
    render(<PaymentTypeBreakdown bookings={noPaymentBooking} />);

    // Stays mode: not counted as any type (typesCount === 0)
    expect(screen.getByTestId("payment-type-empty")).toBeInTheDocument();

    // Nights mode: should also be invisible, not show as Combination
    await user.click(screen.getByText("Nights"));
    expect(screen.queryByTestId("pie-slice-Combination")).not.toBeInTheDocument();
    expect(screen.getByTestId("payment-type-empty")).toBeInTheDocument();
  });

  it("uses cert count for nights when certs + one other type equals numNights", async () => {
    const user = userEvent.setup();
    const certPlusPoints = [
      {
        id: "8",
        numNights: 2,
        totalCost: 0,
        pointsRedeemed: 4000, // supplemental points co-pay
        certificates: [
          { id: "c1", certType: "marriott_35k" },
          { id: "c2", certType: "marriott_40k" },
        ],
      },
    ];
    render(<PaymentTypeBreakdown bookings={certPlusPoints} />);
    await user.click(screen.getByText("Nights"));

    // Both nights are cert nights (2 certs for 2 nights); points are a co-pay, not a separate night
    expect(screen.getByTestId("pie-slice-Certificates")).toHaveTextContent("Certificates: 2");
    expect(screen.queryByTestId("pie-slice-Points")).not.toBeInTheDocument();
  });

  it("shows empty state when no bookings", async () => {
    render(<PaymentTypeBreakdown bookings={[]} />);

    expect(screen.getByTestId("payment-type-empty")).toBeInTheDocument();
    expect(screen.getByText(/No data/i)).toBeInTheDocument();
    expect(screen.getByText(/Payment breakdown will appear/i)).toBeInTheDocument();
  });
});
