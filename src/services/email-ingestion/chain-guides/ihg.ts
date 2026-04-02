import type { ChainGuide } from "../types";

export const ihgGuide: ChainGuide = {
  chainName: "IHG",
  senderDomains: ["ihg.com", "email.ihg.com", "ihghotels.com"],
  promptNotes:
    '"Reward Nights" means bookingType = "points". ' +
    "The points redeemed amount appears near the rate section. " +
    "IHG sometimes shows points earned (not redeemed) — " +
    "only populate pointsRedeemed, not points earned.",
};
