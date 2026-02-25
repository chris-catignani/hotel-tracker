// ---------------------------------------------------------------------------
// Core Data Models
// ---------------------------------------------------------------------------

export interface PointType {
  id: string;
  name: string;
  category: "hotel" | "airline" | "transferable";
  centsPerPoint: string | number;
}

export interface HotelChainEliteStatus {
  id: string;
  name: string;
  bonusPercentage: number | null;
  fixedRate: number | null;
  isFixed: boolean;
}

export interface UserStatus {
  id: string;
  hotelChainId: string;
  eliteStatusId: string | null;
  eliteStatus: HotelChainEliteStatus | null;
}

export interface HotelChainSubBrand {
  id: string;
  hotelChainId: string;
  name: string;
  basePointRate: number | null;
}

export interface HotelChain {
  id: string;
  name: string;
  loyaltyProgram: string | null;
  basePointRate: number | null;
  pointTypeId: string | null;
  pointType: PointType | null;
  hotelChainSubBrands: HotelChainSubBrand[];
  eliteStatuses: HotelChainEliteStatus[];
  userStatus: UserStatus | null;
}

export interface CreditCard {
  id: string;
  name: string;
  rewardType: string;
  rewardRate: number;
  pointTypeId: string | null;
  pointType: PointType | null;
  isDeleted: boolean;
}

export interface ShoppingPortal {
  id: string;
  name: string;
  rewardType: string;
  pointTypeId: string | null;
  pointType: PointType | null;
}

export interface OtaAgency {
  id: string;
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
  id: string;
  promotionId: string;
  hotelChainSubBrandId: string;
}

export interface PromotionBenefit {
  id: string;
  promotionId: string | null;
  promotionTierId?: string | null;
  rewardType: PromotionRewardType;
  valueType: PromotionBenefitValueType;
  value: string | number;
  certType: string | null;
  pointsMultiplierBasis?: PointsMultiplierBasis | null;
  isTieIn: boolean;
  sortOrder: number;
}

export interface PromotionTier {
  id: string;
  promotionId: string;
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
  id: string;
  name: string;
  type: PromotionType;
  benefits: PromotionBenefit[];
  tiers: PromotionTier[];
  exclusions: PromotionExclusion[];
  hotelChainId: string | null;
  hotelChainSubBrandId: string | null;
  creditCardId: string | null;
  tieInCreditCardIds: string[];
  tieInRequiresPayment: boolean;
  shoppingPortalId: string | null;
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
  id: string;
  promotionId: string;
  registrationDate: string;
}

export interface PromotionFormData {
  name: string;
  type: PromotionType;
  benefits: PromotionBenefitFormData[];
  tiers?: PromotionTierFormData[];
  hotelChainId?: string | null;
  hotelChainSubBrandId?: string | null;
  creditCardId?: string | null;
  tieInCreditCardIds?: string[];
  tieInRequiresPayment?: boolean;
  shoppingPortalId?: string | null;
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
  exclusionSubBrandIds?: string[];
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
  id: string;
  certType: string;
}

export interface BookingBenefit {
  id: string;
  benefitType: string;
  label: string | null;
  dollarValue: string | number | null;
}

export interface Booking {
  id: string;
  hotelChainId: string;
  hotelChainSubBrandId: string | null;
  propertyName: string;
  checkIn: string;
  checkOut: string;
  numNights: number;
  pretaxCost: string | number;
  taxAmount: string | number;
  totalCost: string | number;
  currency: string;
  originalAmount: string | number | null;
  creditCardId: string | null;
  shoppingPortalId: string | null;
  portalCashbackRate: string | number | null;
  portalCashbackOnTotal: boolean;
  loyaltyPointsEarned: number | null;
  pointsRedeemed: number | null;
  notes: string | null;
  certificates: BookingCertificate[];
  bookingSource: string | null;
  otaAgencyId: string | null;
  benefits: BookingBenefit[];
}

export interface BookingFormData {
  hotelChainId: string;
  hotelChainSubBrandId: string | null;
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
  creditCardId: string | null;
  shoppingPortalId: string | null;
  portalCashbackRate: number | null;
  portalCashbackOnTotal: boolean;
  loyaltyPointsEarned: number | null;
  bookingSource: string | null;
  otaAgencyId: string | null;
  benefits: {
    benefitType: string;
    label: string | null;
    dollarValue: number | null;
  }[];
  notes: string | null;
}
