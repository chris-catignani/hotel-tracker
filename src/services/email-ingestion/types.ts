export type BookingType = "cash" | "points" | "cert";

export interface ChainGuide {
  /** Human-readable chain name, matching HotelChain.name in the DB */
  chainName: string;
  /** Sender email domains for this chain */
  senderDomains: string[];
  /** Any additional notes to include in the Claude prompt for this chain */
  promptNotes?: string;
}

export interface ParsedBookingData {
  propertyName: string;
  propertyAddress: string | null; // full street address, used for geocoding apartments
  checkIn: string; // YYYY-MM-DD
  checkOut: string; // YYYY-MM-DD
  numNights: number;
  bookingType: BookingType;
  confirmationNumber: string | null;
  hotelChain: string | null; // e.g. "Hyatt", "Marriott"
  subBrand: string | null; // e.g. "Hyatt Place", "Courtyard"
  accommodationType?: "hotel" | "apartment";
  otaAgencyName?: string | null; // e.g. "AMEX FHR", "AMEX THC", "Chase The Edit", "Airbnb", "Booking.com"
  // Cash bookings
  currency: string | null;
  nightlyRates: { amount: number }[] | null; // per-night breakdown when pretax total isn't shown
  pretaxCost: number | null; // direct pretax total; derived from nightlyRates when null
  taxLines: { label: string; amount: number }[] | null; // individual tax/fee line items (positive only; discounts go in discounts[])
  discounts: { label: string; amount: number; type: "accommodation" | "fee" }[] | null;
  totalCost: number | null;
  // Award bookings
  pointsRedeemed: number | null;
  certsRedeemed: { certType: string; count: number }[] | null;
}
