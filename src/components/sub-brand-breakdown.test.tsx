import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { SubBrandBreakdown } from "./sub-brand-breakdown";

// Mock Recharts to avoid issues in JSDOM
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PieChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Pie: ({ data }: { data: { name: string; value: number }[] }) => (
    <div data-testid="pie-chart">
      {data.map((entry, i: number) => (
        <div key={i} data-testid={`pie-slice-${entry.name.toLowerCase().replace(/\s+/g, "-")}`}>
          {entry.name}: {entry.value}
        </div>
      ))}
    </div>
  ),
  Cell: () => null,
  Tooltip: () => null,
}));

describe("SubBrandBreakdown", () => {
  const mockBookings = [
    {
      id: 1,
      numNights: 3,
      hotelChainSubBrand: { id: 1, name: "Courtyard" },
    },
    {
      id: 2,
      numNights: 2,
      hotelChainSubBrand: { id: 2, name: "Residence Inn" },
    },
    {
      id: 3,
      numNights: 1,
      hotelChainSubBrand: null, // Should be "Other / Independent"
    },
    {
      id: 4,
      numNights: 1,
      hotelChainSubBrand: { id: 1, name: "Courtyard" },
    },
  ];

  it("calculates stays breakdown correctly", async () => {
    await act(async () => {
      render(<SubBrandBreakdown bookings={mockBookings} />);
    });

    // Default mode is "stays"
    expect(screen.getByTestId("pie-slice-courtyard")).toHaveTextContent("Courtyard: 2");
    expect(screen.getByTestId("pie-slice-residence-inn")).toHaveTextContent("Residence Inn: 1");
    expect(screen.getByTestId("pie-slice-other-/-independent")).toHaveTextContent(
      "Other / Independent: 1"
    );
  });

  it("calculates nights breakdown correctly", async () => {
    const user = userEvent.setup();
    await act(async () => {
      render(<SubBrandBreakdown bookings={mockBookings} />);
    });

    // Switch to "nights" mode
    await user.click(screen.getByText("Nights"));

    expect(screen.getByTestId("pie-slice-courtyard")).toHaveTextContent("Courtyard: 4");
    expect(screen.getByTestId("pie-slice-residence-inn")).toHaveTextContent("Residence Inn: 2");
    expect(screen.getByTestId("pie-slice-other-/-independent")).toHaveTextContent(
      "Other / Independent: 1"
    );
  });

  it("shows empty state when no bookings", async () => {
    await act(async () => {
      render(<SubBrandBreakdown bookings={[]} />);
    });

    expect(screen.getByTestId("sub-brand-breakdown-empty")).toBeInTheDocument();
    expect(screen.getByText(/No data/i)).toBeInTheDocument();
  });

  it("sorts data by value descending", async () => {
    const skewedBookings = [
      { id: 1, numNights: 1, hotelChainSubBrand: { id: 1, name: "Small" } },
      { id: 2, numNights: 1, hotelChainSubBrand: { id: 2, name: "Large" } },
      { id: 3, numNights: 1, hotelChainSubBrand: { id: 2, name: "Large" } },
    ];

    await act(async () => {
      render(<SubBrandBreakdown bookings={skewedBookings} />);
    });

    const slices = screen.getAllByTestId(/pie-slice-/);
    expect(slices[0]).toHaveTextContent("Large: 2");
    expect(slices[1]).toHaveTextContent("Small: 1");
  });
});
