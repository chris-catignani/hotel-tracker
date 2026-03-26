export type BookingType = "cash" | "points" | "cert";

export interface TerminologyMapping {
  /** Text found in the email (case-insensitive substring match) */
  emailText: string;
  bookingType: BookingType;
}

export interface ChainGuide {
  /** Human-readable chain name, matching HotelChain.name in the DB */
  chainName: string;
  /** Sender email domains for this chain */
  senderDomains: string[];
  /** Chain-specific terminology that Claude needs to interpret correctly */
  terminologyMappings: TerminologyMapping[];
  /** Any additional notes to include in the Claude prompt for this chain */
  promptNotes?: string;
}

export interface ParsedBookingData {
  propertyName: string;
  checkIn: string; // YYYY-MM-DD
  checkOut: string; // YYYY-MM-DD
  numNights: number;
  bookingType: BookingType;
  confirmationNumber: string | null;
  // Cash bookings
  currency: string | null;
  pretaxCost: number | null;
  taxAmount: number | null;
  totalCost: number | null;
  // Award bookings
  pointsRedeemed: number | null;
}
