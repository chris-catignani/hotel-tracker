import { render, screen, act } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { DashboardStats } from "./dashboard-stats";

describe("DashboardStats", () => {
  const defaultProps = {
    totalBookings: 5,
    totalSpend: 1250.5,
    totalSavings: 450.75,
    totalNights: 12,
    avgCashNetCostPerNight: 104.21,
    avgPointsPerNight: 35000,
    avgCertPointsPerNight: 40000,
    totalPointsRedeemed: 25000,
    totalCertificates: 2,
  };

  it("renders all summary statistics with correct formatting", async () => {
    await act(async () => {
      render(<DashboardStats {...defaultProps} />);
    });

    // Precise value checks using data-testid
    expect(screen.getByTestId("stat-value-total-bookings")).toHaveTextContent("5");
    expect(screen.getByTestId("stat-value-total-nights")).toHaveTextContent("12");

    // Formatted currency
    expect(screen.getByTestId("stat-value-total-savings")).toHaveTextContent("$451");

    // Spend breakdown
    expect(screen.getByTestId("stat-value-cash")).toHaveTextContent("$1,251");
    expect(screen.getByTestId("stat-value-points")).toHaveTextContent("25,000 pts");
    expect(screen.getByTestId("stat-value-certs")).toHaveTextContent("2 certs");

    // Avg / Night breakdown
    expect(screen.getByTestId("stat-value-avg-cash-net-per-night")).toHaveTextContent("$104");
    expect(screen.getByTestId("stat-value-avg-points-per-night")).toHaveTextContent("35,000 pts");
    expect(screen.getByTestId("stat-value-avg-certs-per-night")).toHaveTextContent("40,000 pts");
  });

  it("handles null avg values and zero spend correctly", async () => {
    const zeroProps = {
      totalBookings: 0,
      totalSpend: 0,
      totalSavings: 0,
      totalNights: 0,
      avgCashNetCostPerNight: null,
      avgPointsPerNight: null,
      avgCertPointsPerNight: null,
      totalPointsRedeemed: 0,
      totalCertificates: 0,
    };
    await act(async () => {
      render(<DashboardStats {...zeroProps} />);
    });

    expect(screen.getByTestId("stat-value-total-bookings")).toHaveTextContent("0");
    expect(screen.getByTestId("stat-value-total-nights")).toHaveTextContent("0");
    expect(screen.getByTestId("stat-value-total-savings")).toHaveTextContent("$0");

    // Spend breakdown shows em-dash for zero values
    expect(screen.getByTestId("stat-value-cash")).toHaveTextContent("—");
    expect(screen.getByTestId("stat-value-points")).toHaveTextContent("—");
    expect(screen.getByTestId("stat-value-certs")).toHaveTextContent("—");

    // Avg / Night breakdown shows em-dash when null
    expect(screen.getByTestId("stat-value-avg-cash-net-per-night")).toHaveTextContent("—");
    expect(screen.getByTestId("stat-value-avg-points-per-night")).toHaveTextContent("—");
    expect(screen.getByTestId("stat-value-avg-certs-per-night")).toHaveTextContent("—");
  });

  it("handles singular certificate correctly", async () => {
    await act(async () => {
      render(<DashboardStats {...defaultProps} totalCertificates={1} />);
    });
    expect(screen.getByText("1 cert")).toBeInTheDocument();
    expect(screen.queryByText("1 certs")).not.toBeInTheDocument();
  });

  it("formats large numbers with commas", async () => {
    await act(async () => {
      render(
        <DashboardStats {...defaultProps} totalSpend={1000000.49} totalPointsRedeemed={1250000} />
      );
    });
    expect(screen.getByText("$1,000,000")).toBeInTheDocument();
    expect(screen.getByText("1,250,000 pts")).toBeInTheDocument();
  });
});
