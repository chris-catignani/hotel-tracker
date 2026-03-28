import type { ChainGuide } from "../types";

export const amexGuide: ChainGuide = {
  chainName: "Amex Travel",
  senderDomains: ["welcome.americanexpress.com"],
  terminologyMappings: [],
  promptNotes:
    "These are hotel bookings made through American Express Travel (Fine Hotels + Resorts or The Hotel Collection). " +
    'bookingType is always "cash". ' +
    'Extract hotelChain and subBrand from the actual hotel brand shown in the email (e.g. "Mandarin Oriental", "Four Seasons"), not from Amex. ' +
    'Use "Hotel Confirmation #" as the confirmationNumber. ' +
    '"Hotel Loyalty #" is the guest\'s loyalty number at that hotel — ignore it for booking data.',
};
