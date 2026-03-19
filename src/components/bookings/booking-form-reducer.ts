import { format, parseISO } from "date-fns";
import { PaymentType, AccommodationType, Booking, ShoppingPortal, GeoResult } from "@/lib/types";
import { CERT_TYPE_OPTIONS } from "@/lib/cert-types";

// ── Types ────────────────────────────────────────────────────────────────────

export type BenefitItem = {
  type: string;
  label: string;
  dollarValue: string;
  _id: string;
};

export interface BookingFormState {
  accommodationType: AccommodationType;
  hotelChainId: string;
  hotelChainSubBrandId: string;
  // Property display + geo fields (sent to API for upsert when propertyId is unknown)
  propertyId: string | null; // set when editing an existing booking
  propertyName: string;
  placeId: string | null;
  geoConfirmed: boolean;
  countryCode: string | null;
  city: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  checkIn: string;
  checkOut: string;
  paymentType: PaymentType;
  pretaxCost: string;
  totalCost: string;
  currency: string;
  pointsRedeemed: string;
  certificates: string[];
  creditCardId: string;
  shoppingPortalId: string;
  portalCashbackRate: string;
  portalCashbackOnTotal: boolean;
  bookingSource: string;
  otaAgencyId: string;
  benefits: BenefitItem[];
  notes: string;
  showErrors: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function makeBenefitItem(b: Omit<BenefitItem, "_id">): BenefitItem {
  return { ...b, _id: crypto.randomUUID() };
}

function toDateInputValue(dateStr: string): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function toPaymentType(
  totalCost: string | number,
  pointsRedeemed: number | null,
  certificates: { certType: string }[]
): PaymentType {
  const hasCash = Number(totalCost) > 0;
  const hasPoints = pointsRedeemed != null && Number(pointsRedeemed) > 0;
  const hasCert = certificates.length > 0;
  if (hasCash && hasPoints && hasCert) return "cash_points_cert";
  if (hasCash && hasPoints) return "cash_points";
  if (hasCash && hasCert) return "cash_cert";
  if (hasPoints && hasCert) return "points_cert";
  if (hasPoints) return "points";
  if (hasCert) return "cert";
  return "cash";
}

// ── Initial state ─────────────────────────────────────────────────────────────

export const INITIAL_STATE: BookingFormState = {
  accommodationType: "hotel",
  hotelChainId: "",
  hotelChainSubBrandId: "none",
  propertyId: null,
  propertyName: "",
  placeId: null,
  geoConfirmed: false,
  countryCode: null,
  city: null,
  address: null,
  latitude: null,
  longitude: null,
  checkIn: "",
  checkOut: "",
  paymentType: "cash",
  pretaxCost: "",
  totalCost: "",
  currency: "USD",
  pointsRedeemed: "",
  certificates: [],
  creditCardId: "none",
  shoppingPortalId: "none",
  portalCashbackRate: "",
  portalCashbackOnTotal: false,
  bookingSource: "",
  otaAgencyId: "none",
  benefits: [],
  notes: "",
  showErrors: false,
};

export function buildInitialState(
  initialData: Booking,
  portals: ShoppingPortal[]
): BookingFormState {
  const portalForBooking = initialData.shoppingPortalId
    ? portals.find((p) => p.id === initialData.shoppingPortalId)
    : null;

  return {
    accommodationType: initialData.accommodationType ?? "hotel",
    hotelChainId: initialData.hotelChainId ?? "",
    hotelChainSubBrandId: initialData.hotelChainSubBrandId ?? "none",
    propertyId: initialData.propertyId,
    propertyName: initialData.property.name,
    placeId: initialData.property.placeId,
    geoConfirmed: true, // existing bookings always have a confirmed property
    countryCode: initialData.property.countryCode ?? null,
    city: initialData.property.city ?? null,
    address: initialData.property.address ?? null,
    latitude: initialData.property.latitude ?? null,
    longitude: initialData.property.longitude ?? null,
    checkIn: toDateInputValue(initialData.checkIn),
    checkOut: toDateInputValue(initialData.checkOut),
    paymentType: toPaymentType(
      initialData.totalCost,
      initialData.pointsRedeemed,
      initialData.certificates
    ),
    pretaxCost: String(Number(initialData.pretaxCost)),
    totalCost: String(Number(initialData.totalCost)),
    currency: initialData.currency || "USD",
    pointsRedeemed: initialData.pointsRedeemed != null ? String(initialData.pointsRedeemed) : "",
    certificates: initialData.certificates.map((c) => c.certType),
    creditCardId: initialData.creditCardId ?? "none",
    shoppingPortalId: initialData.shoppingPortalId ?? "none",
    portalCashbackRate: initialData.portalCashbackRate
      ? portalForBooking?.rewardType === "points"
        ? String(Number(initialData.portalCashbackRate))
        : String(Number(initialData.portalCashbackRate) * 100)
      : "",
    portalCashbackOnTotal: initialData.portalCashbackOnTotal ?? false,
    bookingSource: initialData.bookingSource || "",
    otaAgencyId: initialData.otaAgencyId ?? "none",
    benefits: initialData.benefits.map((b) =>
      makeBenefitItem({
        type: b.benefitType,
        label: b.label || "",
        dollarValue: b.dollarValue != null ? String(Number(b.dollarValue)) : "",
      })
    ),
    notes: initialData.notes || "",
    showErrors: false,
  };
}

// ── Actions ───────────────────────────────────────────────────────────────────

type ScalarFields = {
  hotelChainSubBrandId: string;
  propertyName: string;
  checkOut: string;
  pretaxCost: string;
  totalCost: string;
  currency: string;
  pointsRedeemed: string;
  creditCardId: string;
  shoppingPortalId: string;
  portalCashbackRate: string;
  portalCashbackOnTotal: boolean;
  otaAgencyId: string;
  notes: string;
  showErrors: boolean;
};

type SetFieldAction = {
  [K in keyof ScalarFields]: { type: "SET_FIELD"; field: K; value: ScalarFields[K] };
}[keyof ScalarFields];

export type Action =
  | SetFieldAction
  | { type: "LOAD_INITIAL_DATA"; initialData: Booking; portals: ShoppingPortal[] }
  | { type: "SET_CHECK_IN"; date: Date | undefined }
  | { type: "SET_PAYMENT_TYPE"; paymentType: PaymentType }
  | { type: "SET_ACCOMMODATION_TYPE"; accommodationType: AccommodationType }
  | { type: "SET_HOTEL_CHAIN_ID"; hotelChainId: string }
  | { type: "SET_BOOKING_SOURCE"; bookingSource: string }
  | { type: "SET_PROPERTY_GEO"; result: GeoResult }
  | { type: "CLEAR_GEO" }
  | { type: "RESET_PROPERTY" }
  | { type: "ADD_CERTIFICATE" }
  | { type: "UPDATE_CERTIFICATE"; index: number; value: string }
  | { type: "REMOVE_CERTIFICATE"; index: number }
  | { type: "ADD_BENEFIT" }
  | { type: "UPDATE_BENEFIT"; index: number; field: string; value: string }
  | { type: "REMOVE_BENEFIT"; index: number };

// ── Reducer ───────────────────────────────────────────────────────────────────

export function bookingFormReducer(state: BookingFormState, action: Action): BookingFormState {
  switch (action.type) {
    case "SET_FIELD":
      return { ...state, [action.field]: action.value };

    case "LOAD_INITIAL_DATA":
      return buildInitialState(action.initialData, action.portals);

    case "SET_CHECK_IN": {
      const newCheckIn = action.date ? format(action.date, "yyyy-MM-dd") : "";
      if (!action.date) return { ...state, checkIn: newCheckIn };

      const currentCheckOut = state.checkOut ? parseISO(state.checkOut) : null;
      const minCheckOut = new Date(action.date);
      minCheckOut.setDate(minCheckOut.getDate() + 1);

      const newCheckOut =
        !currentCheckOut || currentCheckOut <= action.date
          ? format(minCheckOut, "yyyy-MM-dd")
          : state.checkOut;

      return { ...state, checkIn: newCheckIn, checkOut: newCheckOut };
    }

    case "SET_PAYMENT_TYPE":
      return {
        ...state,
        paymentType: action.paymentType,
        pointsRedeemed: action.paymentType.includes("points") ? state.pointsRedeemed : "",
        certificates: action.paymentType.includes("cert") ? state.certificates : [],
      };

    case "SET_ACCOMMODATION_TYPE":
      return {
        ...state,
        accommodationType: action.accommodationType,
        // Switching to apartment clears hotel-specific fields
        ...(action.accommodationType === "apartment"
          ? {
              hotelChainId: "",
              hotelChainSubBrandId: "none",
              // Filter out cert-based payments (certs are hotel loyalty program specific)
              certificates: [],
            }
          : {}),
      };

    case "SET_HOTEL_CHAIN_ID":
      return {
        ...state,
        hotelChainId: action.hotelChainId,
        hotelChainSubBrandId: "none",
        certificates: state.certificates.filter((cert) => {
          if (!cert) return true;
          const opt = CERT_TYPE_OPTIONS.find((o) => o.value === cert);
          return opt && opt.hotelChainId === action.hotelChainId;
        }),
      };

    case "SET_BOOKING_SOURCE":
      return {
        ...state,
        bookingSource: action.bookingSource === "none" ? "" : action.bookingSource,
        otaAgencyId: action.bookingSource !== "ota" ? "none" : state.otaAgencyId,
      };

    case "SET_PROPERTY_GEO":
      return {
        ...state,
        propertyId: null, // will be resolved by API on submit
        propertyName: action.result.displayName,
        placeId: action.result.placeId ?? null,
        geoConfirmed: true,
        countryCode: action.result.countryCode || null,
        city: action.result.city || null,
        address: action.result.address ?? null,
        latitude: action.result.latitude ?? null,
        longitude: action.result.longitude ?? null,
      };

    case "CLEAR_GEO":
      return {
        ...state,
        geoConfirmed: false,
        placeId: null,
        countryCode: null,
        city: null,
        address: null,
        latitude: null,
        longitude: null,
      };

    case "RESET_PROPERTY":
      return {
        ...state,
        propertyId: null,
        propertyName: "",
        placeId: null,
        geoConfirmed: false,
        countryCode: null,
        city: null,
        address: null,
        latitude: null,
        longitude: null,
      };

    case "ADD_CERTIFICATE":
      return { ...state, certificates: [...state.certificates, ""] };

    case "UPDATE_CERTIFICATE":
      return {
        ...state,
        certificates: state.certificates.map((c, i) => (i === action.index ? action.value : c)),
      };

    case "REMOVE_CERTIFICATE":
      return {
        ...state,
        certificates: state.certificates.filter((_, i) => i !== action.index),
      };

    case "ADD_BENEFIT":
      return {
        ...state,
        benefits: [...state.benefits, makeBenefitItem({ type: "", label: "", dollarValue: "" })],
      };

    case "UPDATE_BENEFIT":
      return {
        ...state,
        benefits: state.benefits.map((b, i) =>
          i === action.index ? { ...b, [action.field]: action.value } : b
        ),
      };

    case "REMOVE_BENEFIT":
      return {
        ...state,
        benefits: state.benefits.filter((_, i) => i !== action.index),
      };

    default:
      return state;
  }
}
