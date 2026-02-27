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
  rewardRules: CreditCardRewardRule[];
}

export type CreditCardRewardRuleType = "multiplier" | "fixed";

export interface CreditCardRewardRule {
  id: string;
  creditCardId: string;
  hotelChainId: string | null;
  hotelChain?: HotelChain | null;
  otaAgencyId: string | null;
  otaAgency?: OtaAgency | null;
  rewardType: CreditCardRewardRuleType;
  rewardValue: string | number;
  createdAt: string;
}

export interface CreditCardRewardRuleFormData {
  id?: string;
  hotelChainId: string | null;
  otaAgencyId: string | null;
  rewardType: CreditCardRewardRuleType;
  rewardValue: number | string;
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
export type SubBrandRestrictionMode = "include" | "exclude";

export interface SubBrandRestriction {
  id: string;
  hotelChainSubBrandId: string;
  mode: SubBrandRestrictionMode;
}

export interface PromotionRestrictionsData {
  id: string;
  minSpend: string | number | null;
  minNightsRequired: number | null;
  nightsStackable: boolean;
  spanStays: boolean;
  maxStayCount: number | null;
  maxRewardCount: number | null;
  maxRedemptionValue: string | number | null;
  maxTotalBonusPoints: number | null;
  oncePerSubBrand: boolean;
  bookByDate: string | null;
  registrationDeadline: string | null;
  validDaysAfterRegistration: number | null;
  tieInRequiresPayment: boolean;
  allowedPaymentTypes: string[];
  subBrandRestrictions: SubBrandRestriction[];
  tieInCards: { creditCardId: string }[];
}

export interface PromotionRestrictionsFormData {
  minSpend: string;
  minNightsRequired: string;
  nightsStackable: boolean;
  spanStays: boolean;
  maxStayCount: string;
  maxRewardCount: string;
  maxRedemptionValue: string;
  maxTotalBonusPoints: string;
  oncePerSubBrand: boolean;
  bookByDate: string;
  registrationDeadline: string;
  validDaysAfterRegistration: string;
  registrationDate: string; // form convenience; maps to UserPromotion on the promotion
  tieInRequiresPayment: boolean;
  allowedPaymentTypes: string[];
  subBrandIncludeIds: string[];
  subBrandExcludeIds: string[];
  tieInCreditCardIds: string[];
}

export const EMPTY_RESTRICTIONS: PromotionRestrictionsFormData = {
  minSpend: "",
  minNightsRequired: "",
  nightsStackable: false,
  spanStays: false,
  maxStayCount: "",
  maxRewardCount: "",
  maxRedemptionValue: "",
  maxTotalBonusPoints: "",
  oncePerSubBrand: false,
  bookByDate: "",
  registrationDeadline: "",
  validDaysAfterRegistration: "",
  registrationDate: "",
  tieInRequiresPayment: false,
  allowedPaymentTypes: [],
  subBrandIncludeIds: [],
  subBrandExcludeIds: [],
  tieInCreditCardIds: [],
};

export interface PromotionBenefit {
  id: string;
  promotionId: string | null;
  promotionTierId?: string | null;
  rewardType: PromotionRewardType;
  valueType: PromotionBenefitValueType;
  value: string | number;
  certType: string | null;
  pointsMultiplierBasis?: PointsMultiplierBasis | null;
  sortOrder: number;
  restrictions: PromotionRestrictionsData | null;
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
  sortOrder: number;
  restrictions: PromotionRestrictionsFormData | null;
}

export interface Promotion {
  id: string;
  name: string;
  type: PromotionType;
  benefits: PromotionBenefit[];
  tiers: PromotionTier[];
  hotelChainId: string | null;
  creditCardId: string | null;
  shoppingPortalId: string | null;
  startDate: string | null;
  endDate: string | null;
  isActive: boolean;
  restrictions: PromotionRestrictionsData | null;
  userPromotions: UserPromotion[];
  createdAt: string;
  hotelChain?: { id: string; name: string } | null;
  creditCard?: { id: string; name: string } | null;
  shoppingPortal?: { id: string; name: string } | null;
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
  creditCardId?: string | null;
  shoppingPortalId?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  isActive: boolean;
  restrictions: PromotionRestrictionsFormData | null;
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

export interface BookingPromotion {
  id: string;
  bookingId: string;
  promotionId: string;
  appliedValue: string | number;
  bonusPointsApplied: number | null;
  autoApplied: boolean;
  verified: boolean;
  eligibleNightsAtBooking?: number | null; // Cumulative nights including current stay
  promotion: Promotion;
  benefitApplications: BookingPromotionBenefit[];
}

export interface BookingPromotionBenefit {
  id: string;
  bookingPromotionId: string;
  promotionBenefitId: string;
  appliedValue: string | number;
  eligibleNightsAtBooking?: number | null; // Cumulative nights including current stay
  promotionBenefit: PromotionBenefit;
}
