// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export type UserRole = "USER" | "ADMIN";

export type AccommodationType = "hotel" | "apartment";

// ---------------------------------------------------------------------------
// Core Data Models
// ---------------------------------------------------------------------------

export interface PointType {
  id: string;
  name: string;
  category: "hotel" | "airline" | "transferable";
  usdCentsPerPoint: string | number;
  programCurrency: string | null;
  programCentsPerPoint: string | number | null;
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
  calculationCurrency: string;
  calcCurrencyToUsdRate?: number | null; // enriched from API; 1 calcCurrency = X USD
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
  cardBenefits?: CardBenefit[];
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

export type BenefitPeriod = "monthly" | "quarterly" | "semi_annual" | "annual";

export interface CardBenefit {
  id: string;
  creditCardId: string;
  description: string;
  value: string | number;
  maxValuePerBooking: string | number | null;
  period: BenefitPeriod;
  hotelChainId: string | null;
  hotelChain?: HotelChain | null;
  otaAgencies: { otaAgencyId: string; otaAgency: { id: string; name: string } }[];
  isActive: boolean;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
}

export interface CardBenefitFormData {
  id?: string;
  description: string;
  value: number | string;
  maxValuePerBooking: number | string | null;
  period: BenefitPeriod;
  hotelChainId: string | null;
  otaAgencyIds: string[];
  isActive: boolean;
  startDate: string | null;
  endDate: string | null;
}

export interface BookingCardBenefit {
  id: string;
  bookingId: string;
  cardBenefitId: string;
  cardBenefit: { description: string };
  appliedValue: string | number;
  periodKey: string;
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
  allowedBookingSources: string[];
  allowedCountryCodes: string[];
  allowedAccommodationTypes: AccommodationType[];
  hotelChainId: string | null;
  prerequisiteStayCount: number | null;
  prerequisiteNightCount: number | null;
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
  allowedBookingSources: string[];
  allowedCountryCodes: string[];
  allowedAccommodationTypes: AccommodationType[];
  hotelChainId: string;
  prerequisiteStayCount: string;
  prerequisiteNightCount: string;
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
  allowedBookingSources: [],
  allowedCountryCodes: [],
  allowedAccommodationTypes: [],
  hotelChainId: "",
  prerequisiteStayCount: "",
  prerequisiteNightCount: "",
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
  minStays: number | null;
  maxStays: number | null;
  minNights: number | null;
  maxNights: number | null;
  benefits: PromotionBenefit[];
}

export interface PromotionTierFormData {
  minStays: number | null;
  maxStays: number | null;
  minNights: number | null;
  maxNights: number | null;
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
  tierRequirementType?: "stays" | "nights";
  hotelChainId?: string | null;
  creditCardId?: string | null;
  shoppingPortalId?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  restrictions: PromotionRestrictionsFormData | null;
}

// ---------------------------------------------------------------------------
// Geo Types
// ---------------------------------------------------------------------------

export interface GeoResult {
  placeId: string | null;
  displayName: string;
  city: string;
  countryCode: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface Property {
  id: string;
  name: string;
  placeId: string | null;
  chainPropertyId: string | null; // spiritCode for Hyatt, Amadeus ID for others
  hotelChainId: string | null;
  countryCode: string | null;
  city: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  starRating: number | null;
  createdAt: string;
}

export interface PriceWatch {
  id: string;
  userId: string;
  propertyId: string;
  property: Property;
  isEnabled: boolean;
  lastCheckedAt: string | null;
  createdAt: string;
  bookings: PriceWatchBooking[];
  snapshots?: PriceSnapshot[];
}

export interface PriceWatchBooking {
  id: string;
  priceWatchId: string;
  bookingId: string;
  dateFlexibilityDays: number;
  cashThreshold: string | number | null;
  awardThreshold: number | null;
  createdAt: string;
}

export interface PriceSnapshotRoom {
  id: string;
  roomId: string;
  roomName: string;
  ratePlanCode: string;
  ratePlanName: string;
  cashPrice: string | number | null;
  cashCurrency: string;
  awardPrice: number | null;
  isRefundable: "REFUNDABLE" | "NON_REFUNDABLE" | "UNKNOWN";
  isCorporate: boolean;
}

export interface PriceSnapshot {
  id: string;
  priceWatchId: string;
  checkIn: string;
  checkOut: string;
  lowestRefundableCashPrice: string | number | null;
  lowestRefundableCashCurrency: string;
  lowestAwardPrice: number | null;
  source: string;
  fetchedAt: string;
  rooms?: PriceSnapshotRoom[];
}

// ---------------------------------------------------------------------------
// Booking Related Types
// ---------------------------------------------------------------------------

export type PaymentTiming = "prepaid" | "postpaid";

export interface UserCreditCard {
  id: string;
  userId: string;
  creditCardId: string;
  creditCard: CreditCard;
  nickname: string | null;
  openedDate: string | null;
  closedDate: string | null;
  createdAt: string;
}

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
  hotelChainId: string | null;
  accommodationType: AccommodationType;
  hotelChainSubBrandId: string | null;
  propertyId: string;
  property: Property;
  checkIn: string;
  checkOut: string;
  numNights: number;
  pretaxCost: string | number;
  taxAmount: string | number;
  totalCost: string | number;
  currency: string;
  exchangeRate: string | number | null;
  isFutureEstimate?: boolean;
  loyaltyPointsEstimated?: boolean;
  userCreditCardId: string | null;
  userCreditCard: UserCreditCard | null;
  bookingDate: string | null;
  paymentTiming: PaymentTiming;
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
  bookingCardBenefits: BookingCardBenefit[];
  priceWatchBooking?: PriceWatchBooking | null;
}

export interface BookingFormData {
  hotelChainId: string | null;
  accommodationType: AccommodationType;
  hotelChainSubBrandId: string | null;
  propertyId?: string;
  propertyName?: string;
  placeId?: string | null;
  countryCode?: string | null;
  city?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  checkIn: string;
  checkOut: string;
  numNights: number;
  pretaxCost: number;
  taxAmount: number;
  totalCost: number;
  currency: string;
  pointsRedeemed: number | null;
  certificates: string[];
  userCreditCardId: string | null;
  bookingDate: string | null;
  paymentTiming: PaymentTiming;
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
  eligibleStayCount?: number | null;
  eligibleNightCount?: number | null;
  isOrphaned?: boolean;
  isPreQualifying?: boolean;
  promotion: Promotion;
  benefitApplications: BookingPromotionBenefit[];
}

export interface BookingPromotionBenefit {
  id: string;
  bookingPromotionId: string;
  promotionBenefitId: string;
  appliedValue: string | number;
  eligibleNightsAtBooking?: number | null; // Cumulative nights including current stay
  eligibleStayCount?: number | null;
  eligibleNightCount?: number | null;
  isOrphaned?: boolean;
  isPreQualifying?: boolean;
  promotionBenefit: PromotionBenefit;
}
