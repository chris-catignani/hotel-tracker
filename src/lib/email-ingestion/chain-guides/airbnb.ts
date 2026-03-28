import type { ChainGuide } from "../types";

export const airbnbGuide: ChainGuide = {
  chainName: "Airbnb",
  senderDomains: ["airbnb.com"],
  terminologyMappings: [],
  promptNotes:
    'Airbnb bookings are short-term rentals — set accommodationType to "apartment". ' +
    "Set hotelChain and subBrand to null. " +
    'bookingType is always "cash". ' +
    'The "Confirmation code" is the confirmationNumber. ' +
    "Total cost is the full amount charged including all fees.",
};
