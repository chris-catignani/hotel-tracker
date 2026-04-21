import dotenv from "dotenv";
// Load .env first, then override with .env.local to mirror Next.js behavior.
dotenv.config();
dotenv.config({ path: ".env.local", override: true });

import * as Sentry from "@sentry/node";
import { log } from "next-axiom";

Sentry.init({ dsn: process.env.SENTRY_DSN, tracesSampleRate: 0 });
Sentry.setTag("runner_type", process.env.RUNNER_TYPE ?? "unknown");

import { PrismaClient } from "@prisma/client";
import { createAccorFetcher } from "@/lib/scrapers/accor";
import { createGhaFetcher } from "@/lib/scrapers/gha/price-watch";
import { createHiltonFetcher } from "@/lib/scrapers/hilton";
import { createHyattFetcher } from "@/lib/scrapers/hyatt";
import { createIhgFetcher } from "@/lib/scrapers/ihg";
import { createMarriottFetcher } from "@/lib/scrapers/marriott";
import { runPriceWatchRefresh } from "@/services/price-watch-refresh";

const prisma = new PrismaClient();

const allFetchers = {
  accor: createAccorFetcher,
  gha: createGhaFetcher,
  hilton: createHiltonFetcher,
  hyatt: createHyattFetcher,
  ihg: createIhgFetcher,
  marriott: createMarriottFetcher,
};

function buildFetchers() {
  const filter = process.env.SCRAPERS?.split(",").map((s) => s.trim().toLowerCase());
  const names = filter ?? (Object.keys(allFetchers) as (keyof typeof allFetchers)[]);
  return names
    .filter((name): name is keyof typeof allFetchers => name in allFetchers)
    .map((name) => allFetchers[name]());
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
