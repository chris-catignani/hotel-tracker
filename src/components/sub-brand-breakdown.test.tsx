import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import { SubBrandBreakdown } from "./sub-brand-breakdown";

describe("SubBrandBreakdown", () => {
  const mockBookings = [
    {
      id: "1",
      numNights: 3,
      hotelChainSubBrand: { id: "1", name: "Courtyard" },
    },
    {
      id: "2",
      numNights: 2,
      hotelChainSubBrand: { id: "2", name: "Residence Inn" },
    },
    {
      id: "3",
      numNights: 1,
      hotelChainSubBrand: null,
    },
    {
      id: "4",
      numNights: 1,
      hotelChainSubBrand: { id: "1", name: "Courtyard" },
    },
  ];

  it("calculates stays breakdown correctly", () => {
    render(<SubBrandBreakdown bookings={mockBookings} />);

    expect(screen.getByTestId("legend-item-courtyard")).toHaveTextContent("Courtyard");
    expect(screen.getByTestId("legend-item-courtyard")).toHaveTextContent("2");
    expect(screen.getByTestId("legend-item-residence-inn")).toHaveTextContent("Residence Inn");
    expect(screen.getByTestId("legend-item-residence-inn")).toHaveTextContent("1");
    expect(screen.getByTestId("legend-item-other")).toHaveTextContent("Other");
    expect(screen.getByTestId("legend-item-other")).toHaveTextContent("1");
  });

  it("calculates nights breakdown correctly", async () => {
    const user = userEvent.setup();
    render(<SubBrandBreakdown bookings={mockBookings} />);

    await user.click(screen.getByText("Nights"));

    expect(screen.getByTestId("legend-item-courtyard")).toHaveTextContent("4");
    expect(screen.getByTestId("legend-item-residence-inn")).toHaveTextContent("2");
    expect(screen.getByTestId("legend-item-other")).toHaveTextContent("1");
  });

  it("limits to top 10 items without a Remaining entry", () => {
    const manyBookings = Array.from({ length: 15 }, (_, i) => ({
      id: String(i),
      numNights: 1,
      hotelChainSubBrand: { id: String(i), name: `Brand ${i + 1}` },
    }));

    render(<SubBrandBreakdown bookings={manyBookings} />);

    const rows = screen.getAllByTestId(/^legend-item-/);
    expect(rows).toHaveLength(10);
    expect(screen.queryByTestId("legend-item-remaining")).not.toBeInTheDocument();
  });

  it("shows empty state when no bookings", () => {
    render(<SubBrandBreakdown bookings={[]} />);

    expect(screen.getByTestId("sub-brand-breakdown-empty")).toBeInTheDocument();
    expect(screen.getByText(/No data/i)).toBeInTheDocument();
  });

  it("sorts data by value descending", () => {
    const skewedBookings = [
      { id: "1", numNights: 1, hotelChainSubBrand: { id: "1", name: "Small" } },
      { id: "2", numNights: 1, hotelChainSubBrand: { id: "2", name: "Large" } },
      { id: "3", numNights: 1, hotelChainSubBrand: { id: "2", name: "Large" } },
    ];

    render(<SubBrandBreakdown bookings={skewedBookings} />);

    const rows = screen.getAllByTestId(/^legend-item-/);
    expect(rows[0]).toHaveTextContent("Large");
    expect(rows[1]).toHaveTextContent("Small");
  });
});
