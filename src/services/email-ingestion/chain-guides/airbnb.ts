import type { ChainGuide } from "../types";

export const airbnbGuide: ChainGuide = {
  chainName: "Airbnb",
  senderDomains: ["airbnb.com"],
  promptNotes:
    'Airbnb bookings are short-term rentals — set accommodationType to "apartment". ' +
    "Set hotelChain and subBrand to null. " +
    "Always extract the full street address into propertyAddress (e.g. '123 Main St, Auckland 1010, New Zealand'); set to null only if no address is present in the email. " +
    'bookingType is always "cash". ' +
    'The "Confirmation code" is the confirmationNumber. ' +
    "Total cost is the full amount charged including all fees. " +
    "For nightlyRates: when the email shows '$X × N nights', expand it into N individual entries each with amount X (e.g. '$44.56 × 28 nights' → 28 entries of 44.56). " +
    "Always populate taxLines with each individual positive tax/fee line item (e.g. 'Taxes', 'Airbnb service fee'). " +
    "Always populate discounts: classify each discount line as 'accommodation' (reduces the nightly cost, e.g. special offer, monthly stay discount, weekly discount) or 'fee' (reduces taxes/fees, e.g. Airbnb service fee savings, Airbnb monthly stay savings).",
};
