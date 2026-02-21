import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { DashboardStats } from "./dashboard-stats";

describe("DashboardStats", () => {
  const defaultProps = {
    totalBookings: 5,
    totalSpend: 1250.5,
    totalSavings: 450.75,
    totalNights: 12,
    avgNetCostPerNight: 104.21,
    totalPointsRedeemed: 25000,
    totalCertificates: 2,
  };

  it("renders all summary statistics with correct formatting", () => {
    render(<DashboardStats {...defaultProps} />);

    // Precise value checks using data-testid
    expect(screen.getByTestId("stat-value-total-bookings")).toHaveTextContent("5");
    expect(screen.getByTestId("stat-value-total-nights")).toHaveTextContent("12");

    // Formatted currency
    expect(screen.getByTestId("stat-value-total-savings")).toHaveTextContent("$450.75");
    expect(screen.getByTestId("stat-value-avg-net-cost-/-night")).toHaveTextContent("$104.21");

    // Spend breakdown
    expect(screen.getByTestId("stat-value-cash")).toHaveTextContent("$1,251");
    expect(screen.getByTestId("stat-value-points")).toHaveTextContent("25,000 pts");
    expect(screen.getByTestId("stat-value-certs")).toHaveTextContent("2 certs");
  });

  it("handles zero values and empty states correctly", () => {
    const zeroProps = {
      totalBookings: 0,
      totalSpend: 0,
      totalSavings: 0,
      totalNights: 0,
      avgNetCostPerNight: 0,
      totalPointsRedeemed: 0,
      totalCertificates: 0,
    };
    render(<DashboardStats {...zeroProps} />);

    // Basic counts show "0", currency shows "$0.00"
    expect(screen.getByTestId("stat-value-total-bookings")).toHaveTextContent("0");
    expect(screen.getByTestId("stat-value-total-nights")).toHaveTextContent("0");
    expect(screen.getByTestId("stat-value-total-savings")).toHaveTextContent("$0.00");
    expect(screen.getByTestId("stat-value-avg-net-cost-/-night")).toHaveTextContent("$0.00");

    // Spend breakdown shows em-dash for zero values
    expect(screen.getByTestId("stat-value-cash")).toHaveTextContent("—");
    expect(screen.getByTestId("stat-value-points")).toHaveTextContent("—");
    expect(screen.getByTestId("stat-value-certs")).toHaveTextContent("—");
  });

  it("handles singular certificate correctly", () => {
    render(<DashboardStats {...defaultProps} totalCertificates={1} />);
    expect(screen.getByText("1 cert")).toBeInTheDocument();
    expect(screen.queryByText("1 certs")).not.toBeInTheDocument();
  });

  it("formats large numbers with commas", () => {
    render(
      <DashboardStats {...defaultProps} totalSpend={1000000.49} totalPointsRedeemed={1250000} />
    );
    expect(screen.getByText("$1,000,000")).toBeInTheDocument();
    expect(screen.getByText("1,250,000 pts")).toBeInTheDocument();
  });
});
