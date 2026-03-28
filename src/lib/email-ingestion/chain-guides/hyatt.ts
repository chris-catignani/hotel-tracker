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
    'Nightly rates are listed under a "Nightly rate per room" section. ' +
    'When a rate entry spans a date range (e.g. "January 15 - January 17 - 142.10 US DOLLARS"), ' +
    "expand it into one nightlyRates entry per night — the end date is check-out and is not itself a night " +
    '(e.g. "January 15 - January 17" = 2 nights: Jan 15 and Jan 16, each at 142.10).',
};
