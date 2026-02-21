import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { DashboardStats } from './dashboard-stats';

describe('DashboardStats', () => {
  const defaultProps = {
    totalBookings: 5,
    totalSpend: 1250.5,
    totalSavings: 450.75,
    totalNights: 12,
    avgNetCostPerNight: 104.21,
    totalPointsRedeemed: 25000,
    totalCertificates: 2,
  };

  it('renders all summary statistics with correct formatting', () => {
    render(<DashboardStats {...defaultProps} />);

    // Basic counts
    expect(screen.getByText('5')).toBeInTheDocument(); // Total Bookings
    expect(screen.getByText('12')).toBeInTheDocument(); // Total Nights

    // Formatted currency
    expect(screen.getByText('$450.75')).toBeInTheDocument(); // Total Savings
    expect(screen.getByText('$104.21')).toBeInTheDocument(); // Avg Net Cost / Night

    // Spend breakdown
    expect(screen.getByText('$1,251')).toBeInTheDocument(); // Math.round(1250.5) = 1251
    expect(screen.getByText('25,000 pts')).toBeInTheDocument();
    expect(screen.getByText('2 certs')).toBeInTheDocument();
  });

  it('handles zero values and empty states correctly', () => {
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
    expect(screen.getAllByText('0')).toHaveLength(2); // Bookings, Nights
    expect(screen.getAllByText('$0.00')).toHaveLength(2); // Savings, Avg Net Cost

    // Spend breakdown shows em-dash for zero values
    const emDashes = screen.getAllByText('—');
    expect(emDashes).toHaveLength(3); // Cash, Points, Certs
  });

  it('handles singular certificate correctly', () => {
    render(<DashboardStats {...defaultProps} totalCertificates={1} />);
    expect(screen.getByText('1 cert')).toBeInTheDocument();
    expect(screen.queryByText('1 certs')).not.toBeInTheDocument();
  });

  it('formats large numbers with commas', () => {
    render(<DashboardStats {...defaultProps} totalSpend={1000000.49} totalPointsRedeemed={1250000} />);
    expect(screen.getByText('$1,000,000')).toBeInTheDocument();
    expect(screen.getByText('1,250,000 pts')).toBeInTheDocument();
  });
});
