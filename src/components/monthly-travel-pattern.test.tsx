import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { MonthlyTravelPattern } from "./monthly-travel-pattern";

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  BarChart: ({
    children: _children,
    data,
  }: {
    children: React.ReactNode;
    data: { month: string; count: number }[];
  }) => (
    <div data-testid="bar-chart">
      {data.map((d) => (
        <div key={d.month} data-testid={`bar-${d.month}`}>
          {d.month}: {d.count}
        </div>
      ))}
    </div>
  ),
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
}));

function makeBooking(id: string, checkIn: string, numNights: number) {
  return { id, checkIn, numNights };
}

describe("MonthlyTravelPattern", () => {
  it("renders all 12 months even when all counts are 0", () => {
    render(<MonthlyTravelPattern bookings={[makeBooking("1", "2026-06-15", 3) as never]} />);
    // All 12 month bars should be rendered
    expect(screen.getByTestId("bar-Jan")).toBeInTheDocument();
    expect(screen.getByTestId("bar-Dec")).toBeInTheDocument();
  });

  it("counts stays per check-in month correctly", () => {
    const bookings = [
      makeBooking("1", "2026-03-10", 2),
      makeBooking("2", "2026-03-25", 1),
      makeBooking("3", "2026-06-01", 5),
    ];
    render(<MonthlyTravelPattern bookings={bookings as never[]} />);
    expect(screen.getByTestId("bar-Mar")).toHaveTextContent("Mar: 2");
    expect(screen.getByTestId("bar-Jun")).toHaveTextContent("Jun: 1");
    expect(screen.getByTestId("bar-Jan")).toHaveTextContent("Jan: 0");
  });

  it("Nights mode sums numNights per check-in month", async () => {
    const user = userEvent.setup();
    const bookings = [makeBooking("1", "2026-03-10", 2), makeBooking("2", "2026-03-25", 4)];
    render(<MonthlyTravelPattern bookings={bookings as never[]} />);
    await user.click(screen.getByText("Nights"));
    expect(screen.getByTestId("bar-Mar")).toHaveTextContent("Mar: 6");
  });

  it("shows empty state when bookings array is empty", () => {
    render(<MonthlyTravelPattern bookings={[]} />);
    expect(screen.getByTestId("monthly-travel-pattern-card")).toBeInTheDocument();
    expect(screen.queryByTestId("bar-chart")).not.toBeInTheDocument();
  });

  it("assigns month by check-in month string slice, not Date parsing", () => {
    // "2026-01-31" should be January regardless of timezone
    const booking = makeBooking("1", "2026-01-31", 1);
    render(<MonthlyTravelPattern bookings={[booking as never]} />);
    expect(screen.getByTestId("bar-Jan")).toHaveTextContent("Jan: 1");
    expect(screen.getByTestId("bar-Dec")).toHaveTextContent("Dec: 0");
  });
});
