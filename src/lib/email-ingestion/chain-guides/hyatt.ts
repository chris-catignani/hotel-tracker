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
    'Points redeemed may appear in a "Rate information" section. ' +
    'When you see a "Nightly rate per room" section, you MUST populate nightlyRates with one ' +
    "entry per night — never return nightlyRates: null when this section is present. " +
    'A rate entry may span a date range (e.g. "January 15 - January 17 - 142.10 US DOLLARS"); ' +
    "expand it into one nightlyRates entry per night. The end date is the last night (inclusive), " +
    'not the checkout date (e.g. "January 15 - January 17" = 3 nights: Jan 15, Jan 16, and Jan 17, each at 142.10). ' +
    "Cross-check: the total number of nightlyRates entries must equal numNights.",
};
