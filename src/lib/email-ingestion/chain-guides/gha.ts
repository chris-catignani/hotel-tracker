import type { ChainGuide } from "../types";

export const ghaGuide: ChainGuide = {
  chainName: "GHA",
  senderDomains: ["email.ghadiscovery.com"],
  terminologyMappings: [],
  promptNotes:
    "GHA DISCOVERY is a loyalty program for independent hotels, not a single hotel brand. " +
    'Set hotelChain to the individual hotel brand (e.g. "PARKROYAL", "Pan Pacific", "Anantara", "Kempinski"), not "GHA". ' +
    "These are standard cash hotel bookings. " +
    'The confirmation number appears as "Confirmation #" in the subject and email body.',
};
