import type { ChainGuide } from "../types";

export const ghaGuide: ChainGuide = {
  chainName: "GHA",
  senderDomains: ["email.ghadiscovery.com"],
  terminologyMappings: [],
  promptNotes:
    'Set hotelChain to "GHA Discovery". ' +
    'Set subBrand to the individual hotel brand shown in the email (e.g. "PARKROYAL", "PARKROYAL COLLECTION", "Pan Pacific", "Anantara", "Kempinski"). ' +
    'bookingType is always "cash". accommodationType is always "hotel". ' +
    'The confirmation number appears as "Confirmation #" in the subject and email body.',
};
