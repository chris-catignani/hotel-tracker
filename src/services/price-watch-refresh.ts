/**
 * Core price watch refresh logic — shared between the cron API route
 * and the standalone src/workers/refresh-price-watches.ts script.
 */

import { logger } from "@/lib/logger";
import prisma from "@/lib/prisma";
import {
  selectFetcher,
  lowestRefundableCash,
  lowestRefundableAward,
  type PriceFetcher,
} from "@/lib/price-fetcher";
import { sendPriceDropAlert } from "@/lib/email";
import { getCurrentRate } from "./exchange-rate";
import { HOTEL_ID } from "@/lib/constants";

/**
 * For chains whose loyalty programme has a fixed point value against a base currency,
 * calculates the award price in points from the cash price.
 *
 * - GHA Discovery: 1 point = $0.01 USD → points = cashPrice_in_USD × 100
 * - Accor ALL:     1 point = €0.01     → points = cashPrice_in_EUR × 100
 *
 * Exchange rates are expressed as "1 unit = X USD" (same convention as ExchangeRate table).
 * Returns null if a required rate is unavailable.
 */
export function fixedRateAwardPoints(
  cashPrice: number | null,
  cashCurrency: string,
  hotelChainId: string,
  /** 1 cashCurrency = X USD. Can be null if currency is unknown. */
  cashCurrencyToUSD: number | null,
  /** 1 EUR = X USD. Only required for Accor; ignored for GHA. */
  eurToUSD: number | null
): number | null {
  if (cashPrice === null) return null;

  const cashInUSD =
    cashCurrency === "USD"
      ? cashPrice
      : (cashCurrencyToUSD ?? 0) > 0
        ? cashPrice * cashCurrencyToUSD!
        : null;
  if (cashInUSD === null) return null;

  if (hotelChainId === HOTEL_ID.GHA_DISCOVERY) {
    return Math.round(cashInUSD * 100);
  }

  if (hotelChainId === HOTEL_ID.ACCOR) {
    if (!eurToUSD || eurToUSD <= 0) return null;
    return Math.round((cashInUSD / eurToUSD) * 100);
  }

  return null;
}

export interface WatchResult {
  watchId: string;
  property: string;
  snapshots: number;
  alerts: number;
  fetchErrors: number;
  durationMs: number;
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
    orderBy: [{ priority: "desc" }, { updatedAt: "asc" }],
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
    const watchStart = Date.now();
    let snapshotCount = 0;
    let alertCount = 0;
    let fetchErrorCount = 0;

    for (const pwb of watch.bookings) {
      const checkIn = new Date(pwb.booking.checkIn);
      const checkInStr = checkIn.toISOString().split("T")[0];
      const checkOutStr = new Date(pwb.booking.checkOut).toISOString().split("T")[0];

      let result = null;
      if (fetcher) {
        try {
          result = await fetcher.fetchPrice({
            property: watch.property,
            checkIn: checkInStr,
            checkOut: checkOutStr,
          });
        } catch (error) {
          fetchErrorCount++;
          logger.error(`Fetch failed for ${watch.property.name}`, error, {
            watchId: watch.id,
            property: watch.property.name,
            checkIn: checkInStr,
            checkOut: checkOutStr,
          });
          // result remains null
        }
        // Small delay between fetch calls to reduce bot-detection risk
        await new Promise((r) => setTimeout(r, 3000));
      }

      if (result) {
        // For chains with fixed point values (GHA, Accor), compute award prices from
        // cash prices via currency conversion: local → USD (→ EUR for Accor).
        const chainId = watch.property.hotelChainId;
        if (chainId === HOTEL_ID.GHA_DISCOVERY || chainId === HOTEL_ID.ACCOR) {
          if (chainId === HOTEL_ID.ACCOR && !ratesCache.has("EUR")) {
            ratesCache.set("EUR", await getCurrentRate("EUR"));
          }
          const eurToUSD = chainId === HOTEL_ID.ACCOR ? (ratesCache.get("EUR") ?? null) : null;

          const currenciesToFetch = [
            ...new Set(result.rates.map((r) => r.cashCurrency).filter((c) => !ratesCache.has(c))),
          ];
          if (currenciesToFetch.length > 0) {
            const fetchedRates = await Promise.all(currenciesToFetch.map((c) => getCurrentRate(c)));
            currenciesToFetch.forEach((c, i) => ratesCache.set(c, fetchedRates[i]));
          }

          result = {
            ...result,
            rates: result.rates.map((r) => ({
              ...r,
              awardPrice:
                r.awardPrice ??
                fixedRateAwardPoints(
                  r.cashPrice,
                  r.cashCurrency,
                  chainId,
                  ratesCache.get(r.cashCurrency) ?? null,
                  eurToUSD
                ),
            })),
          };
        }

        // Derive summary fields from the per-room rates
        const { price: lowestCash, currency: lowestCashCurrency } = lowestRefundableCash(
          result.rates
        );
        const lowestAwardPrice = lowestRefundableAward(result.rates);

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

        // Convert lowest refundable cash price to the booking's currency before comparing.
        // Scrapers may return prices in any currency (e.g. Hyatt → USD, IHG → propertyCurrency).
        // Convert via USD as a bridge: scraper price → USD → booking currency.
        const cashThresholdNum = pwb.cashThreshold !== null ? Number(pwb.cashThreshold) : null;
        let cashPriceInBookingCurrency = lowestCash;
        if (lowestCash !== null && lowestCashCurrency !== pwb.booking.currency) {
          const bookingCurrency = pwb.booking.currency;

          if (!ratesCache.has(lowestCashCurrency)) {
            ratesCache.set(lowestCashCurrency, await getCurrentRate(lowestCashCurrency));
          }
          if (!ratesCache.has(bookingCurrency)) {
            ratesCache.set(bookingCurrency, await getCurrentRate(bookingCurrency));
          }

          const scraperCurrencyToUSD = ratesCache.get(lowestCashCurrency); // 1 scraperCurrency = X USD
          const bookingCurrencyToUSD = ratesCache.get(bookingCurrency); // 1 bookingCurrency = Y USD

          if (
            scraperCurrencyToUSD != null &&
            scraperCurrencyToUSD > 0 &&
            bookingCurrencyToUSD != null &&
            bookingCurrencyToUSD > 0
          ) {
            // lowestCash (in scraperCurrency) → USD → bookingCurrency
            const inUSD = lowestCash * scraperCurrencyToUSD;
            cashPriceInBookingCurrency = inUSD / bookingCurrencyToUSD;
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

    const watchDurationMs = Date.now() - watchStart;
    logger.info("price_watch:watch_completed", {
      watchId: watch.id,
      property: watch.property.name,
      snapshots: snapshotCount,
      alerts: alertCount,
      fetchErrors: fetchErrorCount,
      durationMs: watchDurationMs,
    });

    results.push({
      watchId: watch.id,
      property: watch.property.name,
      snapshots: snapshotCount,
      alerts: alertCount,
      fetchErrors: fetchErrorCount,
      durationMs: watchDurationMs,
    });
  }

  return { watched: watches.length, results };
}
