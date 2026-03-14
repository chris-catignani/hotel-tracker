import dotenv from "dotenv";
dotenv.config();

import * as Sentry from "@sentry/node";

Sentry.init({ dsn: process.env.SENTRY_DSN, tracesSampleRate: 0 });

import { PrismaClient } from "@prisma/client";
import { createHyattFetcher } from "@/lib/scrapers/hyatt";
import { createIhgFetcher } from "@/lib/scrapers/ihg";
import { runPriceWatchRefresh } from "@/lib/price-watch-refresh";

const prisma = new PrismaClient();

async function main() {
  console.log("[RefreshScript] Starting daily price watch refresh...");
  try {
    const result = await runPriceWatchRefresh([createHyattFetcher(), createIhgFetcher()]);
    console.log(
      `[RefreshScript] Done. ${result.watched} watches checked, results:`,
      result.results
    );
  } catch (error) {
    console.error("[RefreshScript] ERROR during refresh:", error);
    Sentry.captureException(error);
    await Sentry.flush(2000);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
