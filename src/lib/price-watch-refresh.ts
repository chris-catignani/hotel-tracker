/**
 * Core price watch refresh logic — shared between the cron API route
 * and the standalone scripts/refresh-price-watches.ts script.
 */

import prisma from "./prisma";
import { selectFetcher, type PriceFetcher } from "./price-fetcher";
import { sendPriceDropAlert } from "./email";
import { getCurrentRate } from "./exchange-rate";

export interface WatchResult {
  watchId: string;
  property: string;
  snapshots: number;
  alerts: number;
}

export async function runPriceWatchRefresh(fetchers: PriceFetcher[]): Promise<{
  watched: number;
  results: WatchResult[];
}> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const watches = await prisma.priceWatch.findMany({
    where: {
      isEnabled: true,
      bookings: {
        some: { booking: { checkIn: { gte: today } } },
      },
    },
    include: {
      property: true,
      bookings: {
        where: { booking: { checkIn: { gte: today } } },
        include: {
          booking: {
            select: {
              id: true,
              checkIn: true,
              checkOut: true,
              totalCost: true,
              currency: true,
            },
          },
        },
      },
      user: { select: { email: true } },
    },
  });

  const results: WatchResult[] = [];
  const ratesCache = new Map<string, number | null>();

  for (const watch of watches) {
    const fetcher = selectFetcher(watch.property, fetchers);
    let snapshotCount = 0;
    let alertCount = 0;

    for (const pwb of watch.bookings) {
      const checkIn = new Date(pwb.booking.checkIn);
      const checkInStr = checkIn.toISOString().split("T")[0];
      const checkOutStr = new Date(pwb.booking.checkOut).toISOString().split("T")[0];

      let result = null;
      if (fetcher) {
        result = await fetcher.fetchPrice({
          property: watch.property,
          checkIn: checkInStr,
          checkOut: checkOutStr,
        });
      }

      if (result) {
        await prisma.priceSnapshot.create({
          data: {
            priceWatchId: watch.id,
            checkIn: new Date(checkInStr),
            checkOut: new Date(checkOutStr),
            cashPrice: result.cashPrice,
            cashCurrency: result.cashCurrency,
            awardPrice: result.awardPrice,
            source: result.source,
          },
        });
        snapshotCount++;

        // Convert scraped cash price to the booking's currency before comparing,
        // since scrapers return USD but the threshold is stored in booking currency.
        const cashThresholdNum = pwb.cashThreshold !== null ? Number(pwb.cashThreshold) : null;
        let cashPriceInBookingCurrency = result.cashPrice;
        if (result.cashPrice !== null && result.cashCurrency !== pwb.booking.currency) {
          const bookingCurrency = pwb.booking.currency;
          if (!ratesCache.has(bookingCurrency)) {
            ratesCache.set(bookingCurrency, await getCurrentRate(bookingCurrency));
          }
          const rate = ratesCache.get(bookingCurrency);
          if (rate != null && rate > 0) {
            // rate = 1 bookingCurrency in USD, so: bookingCurrencyPrice = usdPrice / rate
            cashPriceInBookingCurrency = result.cashPrice / rate;
          }
        }

        const cashHit =
          cashThresholdNum !== null &&
          cashPriceInBookingCurrency !== null &&
          cashPriceInBookingCurrency <= cashThresholdNum;
        const awardHit =
          pwb.awardThreshold !== null &&
          result.awardPrice !== null &&
          result.awardPrice <= pwb.awardThreshold;

        if ((cashHit || awardHit) && watch.user.email) {
          await sendPriceDropAlert({
            to: watch.user.email,
            propertyName: watch.property.name,
            checkIn: checkInStr,
            checkOut: checkOutStr,
            cashPrice: result.cashPrice,
            cashCurrency: result.cashCurrency,
            cashThreshold: pwb.cashThreshold ? Number(pwb.cashThreshold) : null,
            awardPrice: result.awardPrice,
            awardThreshold: pwb.awardThreshold,
            bookingId: pwb.booking.id,
          });
          alertCount++;
        }
      }
    }

    await prisma.priceWatch.update({
      where: { id: watch.id },
      data: { lastCheckedAt: new Date() },
    });

    results.push({
      watchId: watch.id,
      property: watch.property.name,
      snapshots: snapshotCount,
      alerts: alertCount,
    });
  }

  return { watched: watches.length, results };
}
