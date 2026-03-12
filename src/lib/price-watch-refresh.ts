/**
 * Core price watch refresh logic — shared between the cron API route
 * and the standalone src/workers/refresh-price-watches.ts script.
 */

import prisma from "./prisma";
import {
  selectFetcher,
  lowestRefundableCash,
  lowestAward,
  type PriceFetcher,
} from "./price-fetcher";
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
        // Derive summary fields from the per-room rates
        const { price: lowestCash, currency: lowestCashCurrency } = lowestRefundableCash(
          result.rates
        );
        const lowestAwardPrice = lowestAward(result.rates);

        const snapshot = await prisma.priceSnapshot.create({
          data: {
            priceWatchId: watch.id,
            checkIn: new Date(checkInStr),
            checkOut: new Date(checkOutStr),
            lowestRefundableCashPrice: lowestCash,
            lowestRefundableCashCurrency: lowestCashCurrency,
            lowestAwardPrice: lowestAwardPrice,
            source: result.source,
            rooms: {
              create: result.rates.map((r) => ({
                roomId: r.roomId,
                roomName: r.roomName,
                ratePlanCode: r.ratePlanCode,
                ratePlanName: r.ratePlanName,
                cashPrice: r.cashPrice,
                cashCurrency: r.cashCurrency,
                awardPrice: r.awardPrice,
                isRefundable: r.isRefundable,
                isCorporate: r.isCorporate,
              })),
            },
          },
        });
        void snapshot; // snapshot created; id available if needed later
        snapshotCount++;

        // Convert lowest refundable cash price to the booking's currency before comparing,
        // since scrapers return in the property's currency but the threshold is in booking currency.
        const cashThresholdNum = pwb.cashThreshold !== null ? Number(pwb.cashThreshold) : null;
        let cashPriceInBookingCurrency = lowestCash;
        if (lowestCash !== null && lowestCashCurrency !== pwb.booking.currency) {
          const bookingCurrency = pwb.booking.currency;
          if (!ratesCache.has(bookingCurrency)) {
            ratesCache.set(bookingCurrency, await getCurrentRate(bookingCurrency));
          }
          const rate = ratesCache.get(bookingCurrency);
          if (rate != null && rate > 0) {
            // rate = 1 bookingCurrency in USD, so: bookingCurrencyPrice = usdPrice / rate
            cashPriceInBookingCurrency = lowestCash / rate;
          }
        }

        const cashHit =
          cashThresholdNum !== null &&
          cashPriceInBookingCurrency !== null &&
          cashPriceInBookingCurrency <= cashThresholdNum;
        const awardHit =
          pwb.awardThreshold !== null &&
          lowestAwardPrice !== null &&
          lowestAwardPrice <= pwb.awardThreshold;

        if ((cashHit || awardHit) && watch.user.email) {
          await sendPriceDropAlert({
            to: watch.user.email,
            propertyName: watch.property.name,
            checkIn: checkInStr,
            checkOut: checkOutStr,
            cashPrice: lowestCash,
            cashCurrency: lowestCashCurrency,
            cashThreshold: pwb.cashThreshold ? Number(pwb.cashThreshold) : null,
            awardPrice: lowestAwardPrice,
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
