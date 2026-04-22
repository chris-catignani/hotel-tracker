import { logger } from "@/lib/logger";
import { sleep } from "@/lib/retry";
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
const KNOWN_BATCH_SIZE = 5;
const DISCOVERY_BATCH_SIZE = 20;
const BATCH_SLEEP_MS = 500;

const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "application/json, */*",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: "https://www.marriott.com/",
};

// Known codes: non-200/non-404 is a real error worth surfacing
async function defaultFetchBrand(brandCode: string): Promise<unknown> {
  const url = `${PACSYS_BASE}_${brandCode}_en-US.json`;
  const response = await fetch(url, { headers: FETCH_HEADERS });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`HTTP ${response.status} for brand ${brandCode}`);
  return response.json();
}

// Discovery codes: non-200 is expected (Marriott returns 503 for unknown codes)
// Only a 200 response is interesting — it means a new brand was found
async function defaultDiscoveryFetchBrand(brandCode: string): Promise<unknown> {
  const url = `${PACSYS_BASE}_${brandCode}_en-US.json`;
  try {
    const response = await fetch(url, { headers: FETCH_HEADERS });
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

function generateDiscoveryCodes(): string[] {
  const known = new Set(Object.keys(BRAND_CODE_MAP));
  const codes: string[] = [];
  for (let i = 65; i <= 90; i++) {
    for (let j = 65; j <= 90; j++) {
      const code = String.fromCharCode(i) + String.fromCharCode(j);
      if (!known.has(code)) codes.push(code);
    }
  }
  return codes;
}

async function sweep(
  codes: string[],
  fetchBrand: FetchBrandFn,
  batchSize: number,
  sleepMs: number,
  responses: BrandResponse[],
  errors: string[]
): Promise<void> {
  for (let i = 0; i < codes.length; i += batchSize) {
    if (i > 0 && sleepMs > 0) await sleep(sleepMs);

    const batch = codes.slice(i, i + batchSize);
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
}

export async function fetchAllBrands(
  knownFetchBrand: FetchBrandFn = defaultFetchBrand,
  discoveryFetchBrand: FetchBrandFn = defaultDiscoveryFetchBrand,
  sleepMs: number = BATCH_SLEEP_MS
): Promise<FetchAllBrandsResult> {
  const knownCodes = Object.keys(BRAND_CODE_MAP);
  const discoveryCodes = generateDiscoveryCodes();
  const responses: BrandResponse[] = [];
  const errors: string[] = [];

  await sweep(knownCodes, knownFetchBrand, KNOWN_BATCH_SIZE, sleepMs, responses, errors);
  await sweep(
    discoveryCodes,
    discoveryFetchBrand,
    DISCOVERY_BATCH_SIZE,
    sleepMs,
    responses,
    errors
  );

  return { responses, sweptCount: knownCodes.length + discoveryCodes.length, errors };
}
