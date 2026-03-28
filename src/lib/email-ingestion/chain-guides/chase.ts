import type { ChainGuide } from "../types";

export const chaseGuide: ChainGuide = {
  chainName: "Chase Travel",
  senderDomains: ["chasetravel.com"],
  terminologyMappings: [],
  promptNotes:
    "These are hotel bookings made through Chase Travel (The Edit curated hotel program). " +
    'bookingType is always "cash". ' +
    "Extract hotelChain and subBrand from the actual hotel brand shown in the email, not from Chase. " +
    'Use "Hotel confirmation" as the confirmationNumber, not the "Trip ID" from the subject line.',
};
