import dotenv from "dotenv";
dotenv.config();

import { PrismaClient } from "@prisma/client";
import { createHyattFetcher } from "../src/lib/scrapers/hyatt";
import { selectFetcher, type PriceFetcher } from "../src/lib/price-fetcher";
import { sendPriceDropAlert } from "../src/lib/email";
import { getCurrentRate } from "../src/lib/exchange-rate";

const prisma = new PrismaClient();

async function refreshAllWatches() {
  console.log(`[RefreshScript] Starting daily price watch refresh...`);

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Build fetchers
    const fetchers: PriceFetcher[] = [createHyattFetcher()];

    // Find all enabled watches that have at least one upcoming booking
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

    console.log(`[RefreshScript] Found ${watches.length} active watches.`);

    const ratesCache = new Map<string, number | null>();

    for (const watch of watches) {
      console.log(`[RefreshScript] Refreshing property: ${watch.property.name}...`);
      const fetcher = selectFetcher(watch.property, fetchers);

      if (!fetcher) {
        console.warn(`[RefreshScript] No fetcher available for ${watch.property.name}. skipping.`);
        continue;
      }

      for (const pwb of watch.bookings) {
        const checkIn = new Date(pwb.booking.checkIn);
        const checkInStr = checkIn.toISOString().split("T")[0];
        const checkOutStr = new Date(pwb.booking.checkOut).toISOString().split("T")[0];

        console.log(`[RefreshScript]   Checking dates: ${checkInStr} to ${checkOutStr}...`);

        const result = await fetcher.fetchPrice({
          property: watch.property,
          checkIn: checkInStr,
          checkOut: checkOutStr,
        });

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

          // Check thresholds and send alert if met.
          const cashThresholdNum = pwb.cashThreshold !== null ? Number(pwb.cashThreshold) : null;
          let cashPriceInBookingCurrency = result.cashPrice;

          if (result.cashPrice !== null && result.cashCurrency !== pwb.booking.currency) {
            const bookingCurrency = pwb.booking.currency;
            if (!ratesCache.has(bookingCurrency)) {
              ratesCache.set(bookingCurrency, await getCurrentRate(bookingCurrency));
            }
            const rate = ratesCache.get(bookingCurrency);
            if (rate != null && rate > 0) {
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
            console.log(
              `[RefreshScript]   !!! ALERT MET for ${watch.property.name}. Sending email...`
            );
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
          }
        }
      }

      await prisma.priceWatch.update({
        where: { id: watch.id },
        data: { lastCheckedAt: new Date() },
      });
    }

    console.log(`[RefreshScript] Refresh complete.`);
  } catch (error) {
    console.error(`[RefreshScript] ERROR during refresh:`, error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

refreshAllWatches();
