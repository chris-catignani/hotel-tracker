import { logger } from "@/lib/logger";

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
const FETCH_BATCH_SIZE = 20;

function generateBrandCodes(): string[] {
  const codes: string[] = [];
  for (let i = 65; i <= 90; i++) {
    for (let j = 65; j <= 90; j++) {
      codes.push(String.fromCharCode(i) + String.fromCharCode(j));
    }
  }
  return codes;
}

async function defaultFetchBrand(brandCode: string): Promise<unknown> {
  const url = `${PACSYS_BASE}_${brandCode}_en-US.json`;
  const response = await fetch(url);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`HTTP ${response.status} for brand ${brandCode}`);
  return response.json();
}

export async function fetchAllBrands(
  fetchBrand: FetchBrandFn = defaultFetchBrand
): Promise<FetchAllBrandsResult> {
  const allCodes = generateBrandCodes();
  const responses: BrandResponse[] = [];
  const errors: string[] = [];

  for (let i = 0; i < allCodes.length; i += FETCH_BATCH_SIZE) {
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
