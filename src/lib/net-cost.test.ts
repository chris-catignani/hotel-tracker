import { describe, it, expect } from 'vitest';
import { getNetCostBreakdown, NetCostBooking } from './net-cost';

describe('net-cost', () => {
  const mockBaseBooking: NetCostBooking = {
    totalCost: 100,
    pretaxCost: 80,
    portalCashbackOnTotal: false,
    portalCashbackRate: null,
    loyaltyPointsEarned: null,
    pointsRedeemed: null,
    certificates: [],
    hotelChain: {
      name: 'Test Hotel',
      loyaltyProgram: 'Test Points',
      basePointRate: 10,
      pointType: { name: 'Test Pts', centsPerPoint: 0.01 },
    },
    creditCard: null,
    shoppingPortal: null,
    bookingPromotions: [],
  };

  it('should calculate base net cost correctly', () => {
    const result = getNetCostBreakdown(mockBaseBooking);
    expect(result.netCost).toBe(100);
    expect(result.promoSavings).toBe(0);
    expect(result.portalCashback).toBe(0);
  });

  it('should apply fixed value promotions', () => {
    const booking: NetCostBooking = {
      ...mockBaseBooking,
      bookingPromotions: [{
        appliedValue: 10,
        promotion: { name: 'Promo 1', value: 10, valueType: 'fixed' },
      }],
    };
    const result = getNetCostBreakdown(booking);
    expect(result.promoSavings).toBe(10);
    expect(result.netCost).toBe(90);
    expect(result.promotions[0].formula).toContain('$10.00 = $10.00');
  });

  it('should apply percentage promotions', () => {
    const booking: NetCostBooking = {
      ...mockBaseBooking,
      bookingPromotions: [{
        appliedValue: 20,
        promotion: { name: '20% off', value: 20, valueType: 'percentage' },
      }],
    };
    const result = getNetCostBreakdown(booking);
    expect(result.promoSavings).toBe(20);
    expect(result.netCost).toBe(80);
    expect(result.promotions[0].formula).toContain('$100.00 (total cost) × 20% = $20.00');
  });

  it('should apply points multiplier promotions', () => {
    const booking: NetCostBooking = {
      ...mockBaseBooking,
      loyaltyPointsEarned: 1000,
      bookingPromotions: [{
        appliedValue: 10,
        promotion: { name: '2x multiplier', value: 2, valueType: 'points_multiplier' },
      }],
    };
    const result = getNetCostBreakdown(booking);
    // (1000 earned * (2-1) = 1000 bonus pts) * 0.01 = $10.00
    expect(result.promoSavings).toBe(10);
    expect(result.netCost).toBe(80);
    expect(result.promotions[0].formula).toContain('1,000 pts (from pre-tax cost) × (2 - 1) × 1¢ = $10.00');
  });

  it('should calculate shopping portal cashback (pre-tax)', () => {
    const booking: NetCostBooking = {
      ...mockBaseBooking,
      portalCashbackRate: 0.05,
      shoppingPortal: {
        name: 'Rakuten',
        rewardType: 'cash',
        pointType: null,
      },
    };
    const result = getNetCostBreakdown(booking);
    // 0.05 * 80 (pre-tax) = 4
    expect(result.portalCashback).toBe(4);
    expect(result.netCost).toBe(96);
    expect(result.portalCashbackCalc?.formula).toContain('$80.00 (pre-tax cost) × 5.0% = $4.00');
  });

  it('should calculate shopping portal cashback (total)', () => {
    const booking: NetCostBooking = {
      ...mockBaseBooking,
      portalCashbackRate: 0.05,
      portalCashbackOnTotal: true,
      shoppingPortal: {
        name: 'Rakuten',
        rewardType: 'cash',
        pointType: null,
      },
    };
    const result = getNetCostBreakdown(booking);
    // 0.05 * 100 (total) = 5
    expect(result.portalCashback).toBe(5);
    expect(result.netCost).toBe(95);
    expect(result.portalCashbackCalc?.formula).toContain('$100.00 (total cost) × 5.0% = $5.00');
  });

  it('should calculate shopping portal points (valuation)', () => {
    const booking: NetCostBooking = {
      ...mockBaseBooking,
      portalCashbackRate: 10, // 10 pts/$
      shoppingPortal: {
        name: 'Chase Portal',
        rewardType: 'points',
        pointType: { name: 'Chase Pts', centsPerPoint: 0.015 },
      },
    };
    const result = getNetCostBreakdown(booking);
    // 80 pretax * 10 pts/$ * 0.015 $/pt = 12
    expect(result.portalCashback).toBe(12);
    expect(result.netCost).toBe(88);
    expect(result.portalCashbackCalc?.formula).toContain('$80.00 (pre-tax cost) × 10 pts/$ × 1.5¢ = $12.00');
  });

  it('should calculate credit card rewards', () => {
    const booking: NetCostBooking = {
      ...mockBaseBooking,
      creditCard: {
        name: 'Amex Plat',
        rewardRate: 5,
        pointType: { name: 'MR Pts', centsPerPoint: 0.02 },
      },
    };
    const result = getNetCostBreakdown(booking);
    // 100 total * 5 pts/$ * 0.02 $/pt = 10
    expect(result.cardReward).toBe(10);
    expect(result.netCost).toBe(90);
    expect(result.cardRewardCalc?.formula).toContain('$100.00 (total cost) × 5x × 2¢ = $10.00');
  });

  it('should calculate loyalty points value', () => {
    const booking: NetCostBooking = {
      ...mockBaseBooking,
      loyaltyPointsEarned: 2000,
    };
    const result = getNetCostBreakdown(booking);
    // 2000 earned * 0.01 = 20
    expect(result.loyaltyPointsValue).toBe(20);
    expect(result.netCost).toBe(80);
    expect(result.loyaltyPointsCalc?.formula).toContain('2,000 pts × 1¢ = $20.00');
  });

  it('should calculate points redeemed value', () => {
    const booking: NetCostBooking = {
      ...mockBaseBooking,
      pointsRedeemed: 10000,
    };
    const result = getNetCostBreakdown(booking);
    // 10000 redeemed * 0.01 = 100
    // Net cost is 100 (total) + 100 (redeemed value) = 200
    expect(result.pointsRedeemedValue).toBe(100);
    expect(result.netCost).toBe(200);
    expect(result.pointsRedeemedCalc?.formula).toContain('10,000 pts × 1¢ = $100.00');
  });

  it('should calculate certificates value', () => {
    const booking: NetCostBooking = {
      ...mockBaseBooking,
      certificates: [{ certType: 'marriott_35k' }],
    };
    const result = getNetCostBreakdown(booking);
    // marriott_35k = 35000 pts * 0.01 = 350
    // Net cost is 100 (total) + 350 (cert value) = 450
    expect(result.certsValue).toBe(350);
    expect(result.netCost).toBe(450);
    expect(result.certsCalc?.formula).toContain('35,000 pts × 1¢ = $350.00');
  });
});
