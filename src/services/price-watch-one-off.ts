import prisma from "@/lib/prisma";
import { AppError } from "@/lib/app-error";
import { runPriceWatchRefresh } from "./price-watch-refresh";
import type { PriceFetcher } from "@/lib/price-fetcher";
import { createAccorFetcher } from "@/lib/scrapers/accor";
import { createGhaFetcher } from "@/lib/scrapers/gha/price-watch";
import { createHiltonFetcher } from "@/lib/scrapers/hilton";
import { createHyattFetcher } from "@/lib/scrapers/hyatt";
import { createIhgFetcher } from "@/lib/scrapers/ihg";
import { createMarriottFetcher } from "@/lib/scrapers/marriott";

function allFetchers(): PriceFetcher[] {
  return [
    createAccorFetcher(),
    createGhaFetcher(),
    createHiltonFetcher(),
    createHyattFetcher(),
    createIhgFetcher(),
    createMarriottFetcher(),
  ];
}

/** Run the existing refresh logic for exactly one newly-watched alternate price watch. */
export async function scrapeSinglePriceWatch(priceWatchId: string, userId: string): Promise<void> {
  const watch = await prisma.priceWatch.findFirst({
    where: { id: priceWatchId, userId },
    select: { id: true, property: { select: { hotelChainId: true } } },
  });
  if (!watch) throw new AppError("Price watch not found", 404);
  await runPriceWatchRefresh(allFetchers());
}
