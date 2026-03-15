import dotenv from "dotenv";
// Load .env first, then override with .env.local to mirror Next.js behavior.
dotenv.config();
dotenv.config({ path: ".env.local", override: true });

import * as Sentry from "@sentry/node";

Sentry.init({ dsn: process.env.SENTRY_DSN, tracesSampleRate: 0 });

import { PrismaClient } from "@prisma/client";
import { createAccorFetcher } from "@/lib/scrapers/accor";
import { createGhaFetcher } from "@/lib/scrapers/gha";
import { createHyattFetcher } from "@/lib/scrapers/hyatt";
import { createIhgFetcher } from "@/lib/scrapers/ihg";
import { createMarriottFetcher } from "@/lib/scrapers/marriott";
import { runPriceWatchRefresh } from "@/lib/price-watch-refresh";

const prisma = new PrismaClient();

async function main() {
  console.log("[RefreshScript] Starting daily price watch refresh...");
  try {
    const result = await runPriceWatchRefresh([
      createAccorFetcher(),
      createGhaFetcher(),
      createHyattFetcher(),
      createIhgFetcher(),
      createMarriottFetcher(),
    ]);
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
