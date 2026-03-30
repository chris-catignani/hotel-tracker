import dotenv from "dotenv";
// Load .env first, then override with .env.local to mirror Next.js behavior.
dotenv.config();
dotenv.config({ path: ".env.local", override: true });

import * as Sentry from "@sentry/node";
import { log } from "next-axiom";

Sentry.init({ dsn: process.env.SENTRY_DSN, tracesSampleRate: 0 });

import { PrismaClient } from "@prisma/client";
import { createAccorFetcher } from "@/lib/scrapers/accor";
import { createGhaFetcher } from "@/lib/scrapers/gha";
import { createHiltonFetcher } from "@/lib/scrapers/hilton";
import { createHyattFetcher } from "@/lib/scrapers/hyatt";
import { createIhgFetcher } from "@/lib/scrapers/ihg";
import { createMarriottFetcher } from "@/lib/scrapers/marriott";
import { runPriceWatchRefresh } from "@/lib/price-watch-refresh";

const prisma = new PrismaClient();

async function main() {
  console.log("[RefreshScript] Starting daily price watch refresh...");
  const runStart = Date.now();
  try {
    const result = await runPriceWatchRefresh([
      createAccorFetcher(),
      createGhaFetcher(),
      createHiltonFetcher(),
      createHyattFetcher(),
      createIhgFetcher(),
      createMarriottFetcher(),
    ]);
    const durationMs = Date.now() - runStart;
    const { totalSnapshots, totalAlerts, totalFetchErrors } = result.results.reduce(
      (totals, r) => {
        totals.totalSnapshots += r.snapshots;
        totals.totalAlerts += r.alerts;
        totals.totalFetchErrors += r.fetchErrors;
        return totals;
      },
      { totalSnapshots: 0, totalAlerts: 0, totalFetchErrors: 0 }
    );
    log.info("price_watch:run_completed", {
      watchesChecked: result.watched,
      snapshotsCreated: totalSnapshots,
      alertsSent: totalAlerts,
      fetchErrors: totalFetchErrors,
      durationMs,
    });
    console.log(
      `[RefreshScript] Done. ${result.watched} watches checked, results:`,
      result.results
    );
    await Promise.all([Sentry.flush(2000), log.flush()]);
  } catch (error) {
    console.error("[RefreshScript] ERROR during refresh:", error);
    Sentry.captureException(error);
    await Promise.all([Sentry.flush(2000), log.flush()]);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
