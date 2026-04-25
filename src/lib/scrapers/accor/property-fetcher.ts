import { sleep } from "@/lib/retry";

const WOOSMAP_BASE = "https://api.woosmap.com/stores";

interface WoosmapPage {
  features?: unknown[];
  pagination?: { page?: number; pageCount?: number };
}

export interface FetchOptions {
  fetchPage?: (page: number) => Promise<unknown>;
  requestDelayMs?: number;
  limit?: number;
}

async function defaultFetchPage(page: number): Promise<unknown> {
  const key = process.env.ACCOR_WOOSMAP_KEY ?? "accor-prod-woos";
  const url = `${WOOSMAP_BASE}?key=${key}&stores_by_page=300&page=${page}`;
  const res = await fetch(url, {
    headers: { Origin: "https://accor.com" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Woosmap HTTP ${res.status} on page ${page}`);
  return res.json();
}

export async function fetchAccorProperties(opts: FetchOptions = {}): Promise<unknown[]> {
  const fetchPage = opts.fetchPage ?? defaultFetchPage;
  const requestDelayMs = opts.requestDelayMs ?? 200;

  const allFeatures: unknown[] = [];
  let page = 1;
  let pageCount = 1;

  do {
    if (page > 1 && requestDelayMs > 0) await sleep(requestDelayMs);

    const data = (await fetchPage(page)) as WoosmapPage;
    const features = data.features ?? [];
    allFeatures.push(...features);

    pageCount = data.pagination?.pageCount ?? 1;

    if (opts.limit != null && allFeatures.length >= opts.limit) {
      return allFeatures.slice(0, opts.limit);
    }

    page++;
  } while (page <= pageCount);

  return allFeatures;
}
