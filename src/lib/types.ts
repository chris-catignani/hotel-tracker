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
