import type { ChainGuide } from "../types";

export const hyattGuide: ChainGuide = {
  chainName: "Hyatt",
  senderDomains: ["reservations.hyatt.com", "hyatt.com"],
  terminologyMappings: [
    {
      emailText: "STANDARD ROOM FREE NIGHT",
      bookingType: "points",
    },
    {
      emailText: "FREE NIGHT AWARD",
      bookingType: "cert",
    },
  ],
  promptNotes:
    'Hyatt points redemptions are labelled "STANDARD ROOM FREE NIGHT" or similar — ' +
    'this means bookingType = "points", NOT "cert". ' +
    'Certificate stays are labelled "FREE NIGHT AWARD". ' +
    "For points bookings the pretaxCost/taxAmount/totalCost should be null. " +
    'Points redeemed may appear in a "Rate information" section.',
};
