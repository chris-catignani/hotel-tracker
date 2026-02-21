import { render, screen, fireEvent } from "@testing-library/react";
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
      id: 1,
      numNights: 3,
      totalCost: 500,
      pointsRedeemed: 0,
      certificates: [],
    },
    {
      id: 2,
      numNights: 2,
      totalCost: 0,
      pointsRedeemed: 20000,
      certificates: [],
    },
    {
      id: 3,
      numNights: 1,
      totalCost: 0,
      pointsRedeemed: 0,
      certificates: [{ id: 1, certType: "marriott_35k" }],
    },
  ];

  it("calculates stays breakdown correctly", () => {
    render(<PaymentTypeBreakdown bookings={mockBookings} />);

    // By default it shows "Stays" mode
    expect(screen.getByTestId("pie-slice-Cash")).toHaveTextContent("Cash: 1");
    expect(screen.getByTestId("pie-slice-Points")).toHaveTextContent("Points: 1");
    expect(screen.getByTestId("pie-slice-Certificates")).toHaveTextContent("Certificates: 1");
  });

  it("calculates nights breakdown correctly", () => {
    render(<PaymentTypeBreakdown bookings={mockBookings} />);

    // Switch to Nights mode
    fireEvent.click(screen.getByText("Nights"));

    expect(screen.getByTestId("pie-slice-Cash")).toHaveTextContent("Cash: 3");
    expect(screen.getByTestId("pie-slice-Points")).toHaveTextContent("Points: 2");
    expect(screen.getByTestId("pie-slice-Certificates")).toHaveTextContent("Certificates: 1");
  });

  it("handles combination stays correctly", () => {
    const combinationBookings = [
      {
        id: 4,
        numNights: 3, // Changed from 2 to 3
        totalCost: 100, // Cash
        pointsRedeemed: 10000, // Points
        certificates: [],
      },
    ];
    render(<PaymentTypeBreakdown bookings={combinationBookings} />);

    expect(screen.getByTestId("pie-slice-Combination")).toHaveTextContent("Combination: 1");

    // Switch to Nights - this specific combo (cash + points, 3 nights) is not
    // automatically deduced (2 types vs 3 nights) and should be ignored.
    fireEvent.click(screen.getByText("Nights"));
    expect(screen.queryByTestId("pie-chart")).not.toBeInTheDocument();

    // Use a custom matcher because the text is split across elements
    expect(
      screen.getByText((content, element) => {
        const hasText = (node: Element | null) =>
          node?.textContent?.includes(
            "1 combination booking ignored because nightly breakdown is unavailable"
          );
        const nodeHasText = hasText(element);
        const childrenDontHaveText = Array.from(element?.children || []).every(
          (child) => !hasText(child as Element)
        );
        return nodeHasText && childrenDontHaveText;
      })
    ).toBeInTheDocument();
  });

  it("applies the $20 significant cash rule", () => {
    const incidentalBooking = [
      {
        id: 5,
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
    fireEvent.click(screen.getByText("Nights"));
    expect(screen.getByTestId("pie-slice-Points")).toHaveTextContent("Points: 1");
    expect(screen.queryByText(/ignored/)).not.toBeInTheDocument();
  });

  it("deduces nightly breakdown for cert + one other type", () => {
    const certPlusCash = [
      {
        id: 6,
        numNights: 3,
        totalCost: 200, // Significant cash
        pointsRedeemed: 0,
        certificates: [{ id: 1, certType: "cat4" }], // 1 cert
      },
    ];
    render(<PaymentTypeBreakdown bookings={certPlusCash} />);
    fireEvent.click(screen.getByText("Nights"));

    // Deduction: 1 cert night, 2 cash nights
    expect(screen.getByTestId("pie-slice-Certificates")).toHaveTextContent("Certificates: 1");
    expect(screen.getByTestId("pie-slice-Cash")).toHaveTextContent("Cash: 2");
  });
});
