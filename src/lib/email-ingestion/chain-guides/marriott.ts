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
    "To determine bookingType, look at the redemption type label inside the award summary section — NOT the section heading itself (which Marriott labels 'Redemption certificate' for all award types). " +
    'If the label says "Standard Redemption Rate" or similar points-rate language, bookingType = "points" and certsRedeemed = null. ' +
    'If the label says "FREE NIGHT AWARD", "Free Night Certificate", "FNA", or similar certificate language, bookingType = "cert". ' +
    'A booking that mixes a free night certificate with a points top-off (e.g. "FNA Top-Off Award") is still bookingType = "cert". ' +
    'The points redeemed amount appears in the "Summary of Points" section as a grand total — use that number, NOT the per-night FNA Top-Off amounts listed per night. For cert-only bookings with no points top-off, pointsRedeemed = null (not 0). ' +
    "For cert bookings, populate certsRedeemed using these certType values based on the award label: " +
    '"UP TO 35K PTS" → marriott_35k, "UP TO 40K PTS" → marriott_40k, "UP TO 50K PTS" → marriott_50k, "UP TO 85K PTS" → marriott_85k. ' +
    "Count the number of each cert type used across all nights and group them — e.g. 3 × 50k certs = [{ certType: 'marriott_50k', count: 3 }]. " +
    "Points used as a top-off (FNA Top-Off Award) go into pointsRedeemed, not certsRedeemed.",
};
