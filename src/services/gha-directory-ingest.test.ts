import { describe, it, expect, vi, beforeEach } from "vitest";
import { decideUrlsToFetch, STALE_AFTER_DAYS } from "./gha-directory-ingest";

describe("decideUrlsToFetch", () => {
  const now = new Date("2026-04-20T00:00:00Z");
  const freshDate = new Date(now.getTime() - 10 * 24 * 3600_000); // 10 days ago
  const staleDate = new Date(now.getTime() - (STALE_AFTER_DAYS + 1) * 24 * 3600_000);

  it("includes URLs not present in DB", () => {
    const result = decideUrlsToFetch(["/anantara/a", "/kempinski/b"], new Map(), now);
    expect(result.sort()).toEqual(["/anantara/a", "/kempinski/b"].sort());
  });

  it("includes URLs whose detailLastFetchedAt is null", () => {
    const result = decideUrlsToFetch(["/anantara/a"], new Map([["/anantara/a", null]]), now);
    expect(result).toEqual(["/anantara/a"]);
  });

  it("excludes URLs whose detailLastFetchedAt is within the staleness window", () => {
    const result = decideUrlsToFetch(["/anantara/a"], new Map([["/anantara/a", freshDate]]), now);
    expect(result).toEqual([]);
  });

  it("includes URLs whose detailLastFetchedAt is older than the staleness window", () => {
    const result = decideUrlsToFetch(["/anantara/a"], new Map([["/anantara/a", staleDate]]), now);
    expect(result).toEqual(["/anantara/a"]);
  });
});

vi.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    property: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
    },
    hotelChainSubBrand: {
      upsert: vi.fn(),
    },
  },
}));

import prisma from "@/lib/prisma";
import { ingestGhaDirectory } from "./gha-directory-ingest";

describe("ingestGhaDirectory orchestration", () => {
  beforeEach(() => vi.clearAllMocks());

  it("stamps lastSeenAt on every known URL and fetches only new/stale", async () => {
    const now = new Date("2026-04-20T00:00:00Z");
    const stale = new Date(now.getTime() - 200 * 24 * 3600_000);

    (prisma.property.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "p1", chainUrlPath: "/anantara/fresh", detailLastFetchedAt: now },
      { id: "p2", chainUrlPath: "/anantara/stale", detailLastFetchedAt: stale },
    ]);
    (prisma.property.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 2 });
    (prisma.property.update as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "p2" });
    (prisma.property.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "p2" });
    (prisma.hotelChainSubBrand.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "sb1",
    });

    const html = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
      props: {
        pageProps: {
          page: {
            name: "Test Stale",
            zipCode: null,
            _info: { id: 1 },
            location: { address: "addr", latitude: 1, longitude: 2 },
            city: {
              name: "City",
              _location: { parentLocation: { content: { name: "Italy" } } },
            },
            categories: [],
          },
        },
      },
    })}</script>`;

    const fetchHtml = vi.fn().mockResolvedValue(html);

    const result = await ingestGhaDirectory({
      harvest: async () => ["/anantara/fresh", "/anantara/stale", "/anantara/new"],
      fetchHtml,
      now,
    });

    // Only /anantara/stale and /anantara/new should be fetched — /anantara/fresh is fresh.
    expect(fetchHtml).toHaveBeenCalledTimes(2);
    expect(fetchHtml).toHaveBeenCalledWith("/anantara/stale");
    expect(fetchHtml).toHaveBeenCalledWith("/anantara/new");
    expect(result.harvestedCount).toBe(3);
    expect(result.fetchedCount).toBe(2);
  });
});
