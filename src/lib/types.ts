// ---------------------------------------------------------------------------
// Core Data Models
// ---------------------------------------------------------------------------

export interface PointType {
  id: number;
  name: string;
  category: "hotel" | "airline" | "transferable";
  centsPerPoint: string | number;
}

export interface HotelChainEliteStatus {
  id: number;
  name: string;
  bonusPercentage: number | null;
  fixedRate: number | null;
  isFixed: boolean;
}

export interface UserStatus {
  id: number;
  hotelChainId: number;
  eliteStatusId: number | null;
  eliteStatus: HotelChainEliteStatus | null;
}

export interface HotelChainSubBrand {
  id: number;
  hotelChainId: number;
  name: string;
  basePointRate: number | null;
}

export interface HotelChain {
  id: number;
  name: string;
  loyaltyProgram: string | null;
  basePointRate: number | null;
  pointTypeId: number | null;
  pointType: PointType | null;
  hotelChainSubBrands: HotelChainSubBrand[];
  eliteStatuses: HotelChainEliteStatus[];
  userStatus: UserStatus | null;
}

export interface CreditCard {
  id: number;
  name: string;
  rewardType: string;
  rewardRate: number;
  pointTypeId: number | null;
  pointType: PointType | null;
  isDeleted: boolean;
}

export interface ShoppingPortal {
  id: number;
  name: string;
  rewardType: string;
  pointTypeId: number | null;
  pointType: PointType | null;
}

export interface OtaAgency {
  id: number;
  name: string;
}

// ---------------------------------------------------------------------------
// Promotion Related Types
// ---------------------------------------------------------------------------

export type PromotionType = "credit_card" | "portal" | "loyalty";
export type PromotionRewardType = "points" | "cashback" | "certificate" | "eqn";
export type PromotionBenefitValueType = "fixed" | "percentage" | "multiplier";
export type PointsMultiplierBasis = "base_only" | "base_and_elite";

export interface PromotionExclusion {
  id: number;
  promotionId: number;
  hotelChainSubBrandId: number;
}

export interface PromotionBenefit {
  id: number;
  promotionId: number | null;
  promotionTierId?: number | null;
  rewardType: PromotionRewardType;
  valueType: PromotionBenefitValueType;
  value: string | number;
  certType: string | null;
  pointsMultiplierBasis?: PointsMultiplierBasis | null;
  isTieIn: boolean;
  sortOrder: number;
}

export interface PromotionTier {
  id: number;
  promotionId: number;
  minStays: number;
  maxStays: number | null;
  benefits: PromotionBenefit[];
}

export interface PromotionTierFormData {
  minStays: number;
  maxStays: number | null;
  benefits: PromotionBenefitFormData[];
}

export interface PromotionBenefitFormData {
  rewardType: PromotionRewardType;
  valueType: PromotionBenefitValueType;
  value: number;
  certType: string | null;
  pointsMultiplierBasis?: PointsMultiplierBasis | null;
  isTieIn: boolean;
  sortOrder: number;
}

export interface Promotion {
  id: number;
  name: string;
  type: PromotionType;
  benefits: PromotionBenefit[];
  tiers: PromotionTier[];
  exclusions: PromotionExclusion[];
  hotelChainId: number | null;
  hotelChainSubBrandId: number | null;
  creditCardId: number | null;
  tieInCreditCardIds: number[];
  tieInRequiresPayment: boolean;
  shoppingPortalId: number | null;
  minSpend: string | number | null;
  startDate: string | null;
  endDate: string | null;
  isActive: boolean;
  isSingleUse: boolean;
  maxRedemptionCount: number | null;
  maxRedemptionValue: string | number | null;
  maxTotalBonusPoints: number | null;
  minNightsRequired: number | null;
  nightsStackable: boolean;
  bookByDate: string | null;
  oncePerSubBrand: boolean;
  registrationDeadline: string | null;
  validDaysAfterRegistration: number | null;
  userPromotions: UserPromotion[];
}

export interface UserPromotion {
  id: number;
  promotionId: number;
  registrationDate: string;
}

export interface PromotionFormData {
  name: string;
  type: PromotionType;
  benefits: PromotionBenefitFormData[];
  tiers?: PromotionTierFormData[];
  hotelChainId?: number | null;
  hotelChainSubBrandId?: number | null;
  creditCardId?: number | null;
  tieInCreditCardIds?: number[];
  tieInRequiresPayment?: boolean;
  shoppingPortalId?: number | null;
  minSpend?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  isActive: boolean;
  isSingleUse?: boolean;
  maxRedemptionCount?: number | null;
  maxRedemptionValue?: number | null;
  maxTotalBonusPoints?: number | null;
  minNightsRequired?: number | null;
  nightsStackable?: boolean;
  bookByDate?: string | null;
  oncePerSubBrand?: boolean;
  exclusionSubBrandIds?: number[];
  registrationDeadline?: string | null;
  validDaysAfterRegistration?: number | null;
  registrationDate?: string | null; // For recording registration in the same form if needed
}

// ---------------------------------------------------------------------------
// Booking Related Types
// ---------------------------------------------------------------------------

export type PaymentType =
  | "cash"
  | "points"
  | "cert"
  | "points_cert"
  | "cash_points"
  | "cash_cert"
  | "cash_points_cert";

export interface BookingCertificate {
  id: number;
  certType: string;
}

export interface BookingBenefit {
  id: number;
  benefitType: string;
  label: string | null;
  dollarValue: string | number | null;
}

export interface Booking {
  id: number;
  hotelChainId: number;
  hotelChainSubBrandId: number | null;
  propertyName: string;
  checkIn: string;
  checkOut: string;
  numNights: number;
  pretaxCost: string | number;
  taxAmount: string | number;
  totalCost: string | number;
  currency: string;
  originalAmount: string | number | null;
  creditCardId: number | null;
  shoppingPortalId: number | null;
  portalCashbackRate: string | number | null;
  portalCashbackOnTotal: boolean;
  loyaltyPointsEarned: number | null;
  pointsRedeemed: number | null;
  notes: string | null;
  certificates: BookingCertificate[];
  bookingSource: string | null;
  otaAgencyId: number | null;
  benefits: BookingBenefit[];
}

export interface BookingFormData {
  hotelChainId: number;
  hotelChainSubBrandId: number | null;
  propertyName: string;
  checkIn: string;
  checkOut: string;
  numNights: number;
  pretaxCost: number;
  taxAmount: number;
  totalCost: number;
  currency: string;
  originalAmount: number | null;
  pointsRedeemed: number | null;
  certificates: string[];
  creditCardId: number | null;
  shoppingPortalId: number | null;
  portalCashbackRate: number | null;
  portalCashbackOnTotal: boolean;
  loyaltyPointsEarned: number | null;
  bookingSource: string | null;
  otaAgencyId: number | null;
  benefits: {
    benefitType: string;
    label: string | null;
    dollarValue: number | null;
  }[];
  notes: string | null;
}
