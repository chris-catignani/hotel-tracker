import type { ChainGuide } from "../types";

export const accorGuide: ChainGuide = {
  chainName: "Accor",
  senderDomains: ["confirmation.all.com"],
  terminologyMappings: [],
  promptNotes:
    "Accor emails come from the ALL – Accor Live Limitless program. " +
    "These are standard cash hotel bookings. " +
    "The property may be any Accor sub-brand (Novotel, Sofitel, Pullman, Mercure, ibis, etc.) — extract subBrand from the brand name. " +
    "Prices are in the local hotel currency, which may not be USD.",
};
