import { describe, it, expect } from 'vitest';
import { calculateMatchedPromotions, MatchingBooking } from './promotion-matching';
import { PromotionType, ValueType, Promotion } from '@prisma/client';

describe('promotion-matching', () => {
  const mockBooking: MatchingBooking = {
    creditCardId: 1,
    shoppingPortalId: 2,
    hotelChainId: 3,
    hotelChainSubBrandId: 4,
    checkIn: new Date('2026-06-01'),
    totalCost: 100,
    loyaltyPointsEarned: 1000,
    hotelChain: {
      pointType: { centsPerPoint: 0.01 }
    },
    creditCard: {
      pointType: { centsPerPoint: 0.01 }
    }
  };

  const basePromo: Promotion = {
    id: 1,
    name: 'Test Promo',
    type: PromotionType.credit_card,
    creditCardId: 1,
    shoppingPortalId: null,
    hotelChainId: null,
    hotelChainSubBrandId: null,
    startDate: null,
    endDate: null,
    minSpend: null,
    value: 10,
    valueType: ValueType.fixed,
    isActive: true,
    description: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('should match a valid credit card promotion', () => {
    const matched = calculateMatchedPromotions(mockBooking, [basePromo]);
    expect(matched).toHaveLength(1);
    expect(matched[0].promotionId).toBe(1);
    expect(matched[0].appliedValue).toBe(10);
  });

  it('should not match if credit card ID differs', () => {
    const promo = { ...basePromo, creditCardId: 99 };
    const matched = calculateMatchedPromotions(mockBooking, [promo]);
    expect(matched).toHaveLength(0);
  });

  it('should match loyalty promotion', () => {
    const promo: Promotion = { 
      ...basePromo, 
      type: PromotionType.loyalty, 
      creditCardId: null, 
      hotelChainId: 3 
    };
    const matched = calculateMatchedPromotions(mockBooking, [promo]);
    expect(matched).toHaveLength(1);
  });

  it('should respect sub-brand filter', () => {
    const promoWithCorrectSubBrand: Promotion = { ...basePromo, hotelChainSubBrandId: 4 };
    const promoWithWrongSubBrand: Promotion = { ...basePromo, hotelChainSubBrandId: 99 };
    
    expect(calculateMatchedPromotions(mockBooking, [promoWithCorrectSubBrand])).toHaveLength(1);
    expect(calculateMatchedPromotions(mockBooking, [promoWithWrongSubBrand])).toHaveLength(0);
  });

  it('should respect date ranges', () => {
    const promoInRange: Promotion = { 
      ...basePromo, 
      startDate: new Date('2026-05-01'), 
      endDate: new Date('2026-07-01') 
    };
    const promoPast: Promotion = { 
      ...basePromo, 
      startDate: new Date('2026-01-01'), 
      endDate: new Date('2026-02-01') 
    };
    
    expect(calculateMatchedPromotions(mockBooking, [promoInRange])).toHaveLength(1);
    expect(calculateMatchedPromotions(mockBooking, [promoPast])).toHaveLength(0);
  });

  it('should respect min spend for credit card promos', () => {
    const promoLowMin: Promotion = { ...basePromo, minSpend: 50 };
    const promoHighMin: Promotion = { ...basePromo, minSpend: 200 };
    
    expect(calculateMatchedPromotions(mockBooking, [promoLowMin])).toHaveLength(1);
    expect(calculateMatchedPromotions(mockBooking, [promoHighMin])).toHaveLength(0);
  });

  it('should calculate percentage value correctly', () => {
    const promo: Promotion = { ...basePromo, value: 15, valueType: ValueType.percentage };
    const matched = calculateMatchedPromotions(mockBooking, [promo]);
    expect(matched[0].appliedValue).toBe(15); // 15% of 100
  });

  it('should calculate points multiplier value correctly', () => {
    const promo: Promotion = { ...basePromo, value: 3, valueType: ValueType.points_multiplier };
    const matched = calculateMatchedPromotions(mockBooking, [promo]);
    // 1000 pts * (3-1) * 0.01 $/pt = 20
    expect(matched[0].appliedValue).toBe(20);
  });
});
