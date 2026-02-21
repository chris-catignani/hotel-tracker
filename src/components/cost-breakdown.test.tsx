import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { CostBreakdown } from './cost-breakdown';
import { NetCostBreakdown } from '@/lib/net-cost';

describe('CostBreakdown', () => {
  const mockBreakdown: NetCostBreakdown = {
    totalCost: 100,
    promoSavings: 10,
    promotions: [
      { id: 1, name: 'Promo 1', appliedValue: 10, label: 'Promotion', formula: '10 = 10', description: 'desc' }
    ],
    portalCashback: 5,
    portalCashbackCalc: { label: 'Portal', formula: '5 = 5', description: 'desc' },
    cardReward: 2,
    cardRewardCalc: { label: 'Card', formula: '2 = 2', description: 'desc' },
    loyaltyPointsValue: 3,
    loyaltyPointsCalc: { label: 'Loyalty', formula: '3 = 3', description: 'desc' },
    pointsRedeemedValue: 0,
    certsValue: 0,
    netCost: 80
  };

  it('should render all cost components correctly', () => {
    render(<CostBreakdown breakdown={mockBreakdown} />);
    
    expect(screen.getByText('Cash Cost')).toBeInTheDocument();
    expect(screen.getByText('$100.00')).toBeInTheDocument();
    
    expect(screen.getByText('Portal Cashback')).toBeInTheDocument();
    expect(screen.getByText('-$5.00')).toBeInTheDocument();
    
    expect(screen.getByText('Card Reward')).toBeInTheDocument();
    expect(screen.getByText('-$2.00')).toBeInTheDocument();
    
    expect(screen.getByText('Loyalty Points Value')).toBeInTheDocument();
    expect(screen.getByText('-$3.00')).toBeInTheDocument();
    
    expect(screen.getByText('Promotion Savings')).toBeInTheDocument();
    expect(screen.getByText('-$10.00')).toBeInTheDocument();
    
    expect(screen.getByText('Net Cost')).toBeInTheDocument();
    expect(screen.getByText('$80.00')).toBeInTheDocument();
  });

  it('should toggle promotion details', () => {
    render(<CostBreakdown breakdown={mockBreakdown} />);
    
    // Initially hidden
    expect(screen.queryByText('Promo 1')).not.toBeInTheDocument();
    
    // Click to expand
    const promoButton = screen.getByRole('button', { name: /Promotion Savings/i });
    fireEvent.click(promoButton);
    
    // Now visible
    expect(screen.getByText('Promo 1')).toBeInTheDocument();
    
    // Click to collapse
    fireEvent.click(promoButton);
    expect(screen.queryByText('Promo 1')).not.toBeInTheDocument();
  });

  it('should not render components with 0 value', () => {
    const zeroBreakdown = { ...mockBreakdown, portalCashback: 0, cardReward: 0, loyaltyPointsValue: 0, promoSavings: 0, promotions: [] };
    render(<CostBreakdown breakdown={zeroBreakdown} />);
    
    expect(screen.queryByText('Portal Cashback')).not.toBeInTheDocument();
    expect(screen.queryByText('Card Reward')).not.toBeInTheDocument();
    expect(screen.queryByText('Loyalty Points Value')).not.toBeInTheDocument();
    expect(screen.queryByText('Promotion Savings')).not.toBeInTheDocument();
  });
});
