import { createAccorFetcher } from "@/lib/scrapers/accor";
import { createGhaFetcher } from "@/lib/scrapers/gha/price-watch";
import { createHiltonFetcher } from "@/lib/scrapers/hilton";
import { createHyattFetcher } from "@/lib/scrapers/hyatt/price-watch";
import { createIhgFetcher } from "@/lib/scrapers/ihg";
import { createMarriottFetcher } from "@/lib/scrapers/marriott/price-watch";

export const PRICE_FETCHER_FACTORIES = {
  accor: createAccorFetcher,
  gha: createGhaFetcher,
  hilton: createHiltonFetcher,
  hyatt: createHyattFetcher,
  ihg: createIhgFetcher,
  marriott: createMarriottFetcher,
} as const;

export function createAllFetchers() {
  return Object.values(PRICE_FETCHER_FACTORIES).map((f) => f());
}
