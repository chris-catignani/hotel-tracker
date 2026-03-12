import dotenv from "dotenv";
dotenv.config();

import { PrismaClient } from "@prisma/client";
import { createHyattFetcher } from "../src/lib/scrapers/hyatt";
import { runPriceWatchRefresh } from "../src/lib/price-watch-refresh";

const prisma = new PrismaClient();

async function main() {
  console.log("[RefreshScript] Starting daily price watch refresh...");
  try {
    const result = await runPriceWatchRefresh([createHyattFetcher()]);
    console.log(
      `[RefreshScript] Done. ${result.watched} watches checked, results:`,
      result.results
    );
  } catch (error) {
    console.error("[RefreshScript] ERROR during refresh:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
