import dotenv from "dotenv";
// Load .env first, then override with .env.local to mirror Next.js behavior.
dotenv.config();
dotenv.config({ path: ".env.local", override: true });

import * as Sentry from "@sentry/node";
import { log } from "next-axiom";

Sentry.init({ dsn: process.env.SENTRY_DSN, tracesSampleRate: 0 });
Sentry.setTag("runner_type", process.env.RUNNER_TYPE ?? "unknown");

import { PrismaClient } from "@prisma/client";
import { PRICE_FETCHER_FACTORIES } from "@/lib/price-fetchers";
import { runPriceWatchRefresh } from "@/services/price-watch-refresh";

const prisma = new PrismaClient();

function buildFetchers() {
  const filter = process.env.SCRAPERS?.split(",").map((s) => s.trim().toLowerCase());
  const names =
    filter ?? (Object.keys(PRICE_FETCHER_FACTORIES) as (keyof typeof PRICE_FETCHER_FACTORIES)[]);
  return names
    .filter((name): name is keyof typeof PRICE_FETCHER_FACTORIES => name in PRICE_FETCHER_FACTORIES)
    .map((name) => PRICE_FETCHER_FACTORIES[name]());
}

async function main() {
  const fetchers = buildFetchers();
  console.log(
    `[RefreshScript] Starting price watch refresh (scrapers: ${fetchers.map((f) => f.constructor.name).join(", ")})...`
  );
  const runStart = Date.now();
  try {
    const result = await runPriceWatchRefresh(fetchers);
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
      runnerType: process.env.RUNNER_TYPE ?? "unknown",
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
