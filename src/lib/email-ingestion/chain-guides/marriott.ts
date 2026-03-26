import type { ChainGuide } from "../types";

export const marriottGuide: ChainGuide = {
  chainName: "Marriott",
  senderDomains: ["marriott.com", "email.marriott.com", "info.marriott.com"],
  terminologyMappings: [
    {
      emailText: "Marriott Bonvoy Certificate Number",
      bookingType: "cert",
    },
  ],
  promptNotes:
    'If a "Marriott Bonvoy Certificate Number" field is present, bookingType = "cert". ' +
    'If points are redeemed but no certificate number is shown, bookingType = "points". ' +
    'The points redeemed amount appears in a "Summary of Points" or "Total Points Redeemed" section.',
};
