/**
 * Cron: refresh all active price watches and send email alerts.
 *
 * Designed to run via GitHub Actions (not Vercel cron) because Playwright
 * for cookie refresh exceeds Vercel's 50MB bundle limit.
 *
 * Auth: Bearer token via CRON_SECRET env var (same pattern as exchange-rates cron).
 *
 * GitHub Actions workflow: .github/workflows/refresh-price-watches.yml
 */

import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { createHyattFetcher } from "@/lib/scrapers/hyatt";
import { runPriceWatchRefresh } from "@/lib/price-watch-refresh";

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("Authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await runPriceWatchRefresh([createHyattFetcher()]);
    return NextResponse.json(result);
  } catch (error) {
    return apiError("Failed to refresh price watches", error, 500, request);
  }
}
