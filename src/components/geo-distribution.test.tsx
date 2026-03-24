import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import { GeoDistribution } from "./geo-distribution";

function makeBooking(id: string, countryCode: string | null, city: string | null) {
  return {
    id,
    property: { name: "Hotel", countryCode, city },
  };
}

describe("GeoDistribution", () => {
  it("groups bookings by country code", () => {
    const bookings = [
      makeBooking("1", "US", "New York"),
      makeBooking("2", "US", "Chicago"),
      makeBooking("3", "FR", "Paris"),
    ];
    render(<GeoDistribution bookings={bookings as never[]} />);
    expect(screen.getByText("US")).toBeInTheDocument();
    expect(screen.getByText("FR")).toBeInTheDocument();
    // US should show 2 stays
    const usRow = screen.getByTestId("geo-row-US");
    expect(usRow).toHaveTextContent("2");
  });

  it("groups bookings by city when City toggle is selected", async () => {
    const user = userEvent.setup();
    const bookings = [
      makeBooking("1", "US", "New York"),
      makeBooking("2", "US", "New York"),
      makeBooking("3", "US", "Chicago"),
    ];
    render(<GeoDistribution bookings={bookings as never[]} />);
    await user.click(screen.getByText("City"));
    expect(screen.getByTestId("geo-row-New York")).toHaveTextContent("2");
    expect(screen.getByTestId("geo-row-Chicago")).toHaveTextContent("1");
  });

  it("excludes bookings with null countryCode from country view", () => {
    const bookings = [makeBooking("1", "US", "New York"), makeBooking("2", null, null)];
    render(<GeoDistribution bookings={bookings as never[]} />);
    // Only US row should appear
    expect(screen.getAllByTestId(/^geo-row-/)).toHaveLength(1);
  });

  it("excludes bookings with null city from city view", async () => {
    const user = userEvent.setup();
    const bookings = [makeBooking("1", "US", "New York"), makeBooking("2", "US", null)];
    render(<GeoDistribution bookings={bookings as never[]} />);
    await user.click(screen.getByText("City"));
    expect(screen.getAllByTestId(/^geo-row-/)).toHaveLength(1);
  });

  it("caps display at top 10 entries", () => {
    const bookings = Array.from({ length: 15 }, (_, i) =>
      makeBooking(String(i), `C${i}`, `City${i}`)
    );
    render(<GeoDistribution bookings={bookings as never[]} />);
    expect(screen.getAllByTestId(/^geo-row-/)).toHaveLength(10);
  });

  it("shows empty state when all bookings have null geo data", () => {
    const bookings = [makeBooking("1", null, null)];
    render(<GeoDistribution bookings={bookings as never[]} />);
    expect(screen.getByTestId("geo-distribution-card")).toBeInTheDocument();
    expect(screen.queryByTestId(/^geo-row-/)).not.toBeInTheDocument();
  });
});
