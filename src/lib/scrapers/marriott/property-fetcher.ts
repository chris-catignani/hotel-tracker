import { logger } from "@/lib/logger";
import { BRAND_CODE_MAP } from "./property-parser";

export interface BrandResponse {
  brandCode: string;
  data: unknown;
}

export interface FetchAllBrandsResult {
  responses: BrandResponse[];
  sweptCount: number;
  errors: string[];
}

export type FetchBrandFn = (brandCode: string) => Promise<unknown>;

const PACSYS_BASE = "https://pacsys.marriott.com/data/marriott_properties";
const FETCH_BATCH_SIZE = 5;
const BATCH_SLEEP_MS = 500;

const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "application/json, */*",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: "https://www.marriott.com/",
};

async function defaultFetchBrand(brandCode: string): Promise<unknown> {
  const url = `${PACSYS_BASE}_${brandCode}_en-US.json`;
  const response = await fetch(url, { headers: FETCH_HEADERS });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`HTTP ${response.status} for brand ${brandCode}`);
  return response.json();
}

export async function fetchAllBrands(
  fetchBrand: FetchBrandFn = defaultFetchBrand,
  sleepMs: number = BATCH_SLEEP_MS
): Promise<FetchAllBrandsResult> {
  const allCodes = Object.keys(BRAND_CODE_MAP);
  const responses: BrandResponse[] = [];
  const errors: string[] = [];

  for (let i = 0; i < allCodes.length; i += FETCH_BATCH_SIZE) {
    if (i > 0 && sleepMs > 0) await new Promise((resolve) => setTimeout(resolve, sleepMs));

    const batch = allCodes.slice(i, i + FETCH_BATCH_SIZE);
    const results = await Promise.allSettled(batch.map((code) => fetchBrand(code)));

    for (const [j, r] of results.entries()) {
      const code = batch[j];
      if (r.status === "fulfilled") {
        if (r.value !== null) responses.push({ brandCode: code, data: r.value });
      } else {
        const msg = r.reason instanceof Error ? r.reason.message : String(r.reason);
        errors.push(`${code}: ${msg}`);
        logger.warn("marriott_fetch:brand_error", { brandCode: code, error: msg });
      }
    }
  }

  return { responses, sweptCount: allCodes.length, errors };
}
