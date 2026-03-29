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
    "Total cost is the full amount charged including all fees. " +
    "For pretaxCost: sum the nightly/weekly/monthly accommodation line items and subtract any accommodation discounts (e.g. monthly stay discount, weekly discount). " +
    "For taxAmount: add together the explicitly shown taxes AND any platform service fees (e.g. Airbnb service fee net of any service fee savings/discounts). " +
    "These override the general discount rule — always populate pretaxCost and taxAmount for Airbnb bookings.",
};
