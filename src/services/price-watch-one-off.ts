import prisma from "@/lib/prisma";
import { AppError } from "@/lib/app-error";
import { runPriceWatchRefresh } from "./price-watch-refresh";
import { createAllFetchers } from "@/lib/price-fetchers";

/** Run the existing refresh logic for exactly one newly-watched alternate price watch. */
export async function scrapeSinglePriceWatch(priceWatchId: string, userId: string): Promise<void> {
  const watch = await prisma.priceWatch.findFirst({
    where: { id: priceWatchId, userId },
    select: { id: true, property: { select: { hotelChainId: true } } },
  });
  if (!watch) throw new AppError("Price watch not found", 404);
  await runPriceWatchRefresh(createAllFetchers(), watch.id);
}
