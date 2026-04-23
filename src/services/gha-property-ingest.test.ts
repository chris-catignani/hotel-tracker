import { describe, it, expect, vi, beforeEach } from "vitest";
import { decideUrlsToFetch, STALE_AFTER_DAYS } from "./gha-property-ingest";
import { HOTEL_ID } from "@/lib/constants";

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
      upsert: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    hotelChainSubBrand: {
      upsert: vi.fn(),
    },
  },
}));

import prisma from "@/lib/prisma";
import { ingestGhaProperties } from "./gha-property-ingest";

describe("ingestGhaProperties orchestration", () => {
  beforeEach(() => vi.clearAllMocks());

  it("stamps lastSeenAt on every known URL and fetches only new/stale", async () => {
    const now = new Date("2026-04-20T00:00:00Z");
    const stale = new Date(now.getTime() - 200 * 24 * 3600_000);

    (prisma.property.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "p1", chainUrlPath: "/anantara/fresh", detailLastFetchedAt: now },
      { id: "p2", chainUrlPath: "/anantara/stale", detailLastFetchedAt: stale },
    ]);
    (prisma.property.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 2 });
    (prisma.property.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "p2" });
    (prisma.hotelChainSubBrand.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "sb1" });

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

    const result = await ingestGhaProperties({
      harvest: async () => ["/anantara/fresh", "/anantara/stale", "/anantara/new"],
      fetchHtml,
      now,
      requestDelayMs: 0,
    });

    expect(fetchHtml).toHaveBeenCalledTimes(2);
    expect(fetchHtml).toHaveBeenCalledWith("/anantara/stale");
    expect(fetchHtml).toHaveBeenCalledWith("/anantara/new");
    expect(result.harvestedCount).toBe(3);
    expect(result.fetchedCount).toBe(2);
  });

  it("counts 404 URLs as skipped, not errors, and does not increment fetchedCount", async () => {
    const now = new Date("2026-04-20T00:00:00Z");

    (prisma.property.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (prisma.property.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 0 });

    const fetchHtml = vi.fn().mockResolvedValue(null);

    const result = await ingestGhaProperties({
      harvest: async () => ["/anantara/gone"],
      fetchHtml,
      now,
      requestDelayMs: 0,
    });

    expect(result.fetchedCount).toBe(0);
    expect(result.skippedCount).toBe(1);
    expect(result.errors).toHaveLength(0);
  });

  it("upserts by chainUrlPath key and includes name in update arm", async () => {
    const now = new Date("2026-04-20T00:00:00Z");

    (prisma.property.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (prisma.property.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 0 });
    (prisma.property.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "p1" });
    (prisma.hotelChainSubBrand.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "sb1" });

    const html = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
      props: {
        pageProps: {
          page: {
            name: "Canonical Hotel Name",
            zipCode: null,
            _info: { id: 999 },
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

    await ingestGhaProperties({
      harvest: async () => ["/sub-brand/canonical-hotel"],
      fetchHtml: vi.fn().mockResolvedValue(html),
      now,
      requestDelayMs: 0,
    });

    expect(prisma.property.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          hotelChainId_chainUrlPath: expect.objectContaining({
            chainUrlPath: "/sub-brand/canonical-hotel",
          }),
        },
        update: expect.objectContaining({ name: "Canonical Hotel Name" }),
      })
    );
  });

  it("falls back to name-lookup when upsert hits P2002 (user row with canonical name)", async () => {
    const now = new Date("2026-04-20T00:00:00Z");
    const { Prisma } = await import("@prisma/client");
    const p2002 = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
      code: "P2002",
      clientVersion: "6.0.0",
      meta: { target: ["hotel_chain_id", "chain_url_path"] },
    });

    (prisma.property.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (prisma.property.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 0 });
    (prisma.property.upsert as ReturnType<typeof vi.fn>).mockRejectedValue(p2002);
    (prisma.property.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "existing-1" });
    (prisma.property.update as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "existing-1" });
    (prisma.hotelChainSubBrand.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "sb1" });

    const html = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
      props: {
        pageProps: {
          page: {
            name: "Canonical Hotel Name",
            zipCode: null,
            _info: { id: 999 },
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

    const result = await ingestGhaProperties({
      harvest: async () => ["/sub-brand/canonical-hotel"],
      fetchHtml: vi.fn().mockResolvedValue(html),
      now,
      requestDelayMs: 0,
    });

    expect(prisma.property.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ name: "Canonical Hotel Name" }) })
    );
    expect(prisma.property.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "existing-1" },
        data: expect.objectContaining({ chainUrlPath: "/sub-brand/canonical-hotel" }),
      })
    );
    expect(result.errors).toHaveLength(0);
    expect(result.upsertedCount).toBe(1);
  });

  it("continues loop on fetch error and records in errors array", async () => {
    const now = new Date("2026-04-20T00:00:00Z");

    (prisma.property.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (prisma.property.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 0 });
    (prisma.property.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "p1" });
    (prisma.hotelChainSubBrand.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "sb1" });

    const fetchHtml = vi
      .fn()
      .mockRejectedValueOnce(new Error("Network Failure"))
      .mockResolvedValueOnce(
        `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
          props: {
            pageProps: {
              page: {
                name: "Success",
                _info: { id: 1 },
                location: { address: "addr", latitude: 1, longitude: 2 },
                city: { name: "City", _location: {} },
              },
            },
          },
        })}</script>`
      );

    const result = await ingestGhaProperties({
      harvest: async () => ["/fail", "/success"],
      fetchHtml,
      now,
      requestDelayMs: 0,
    });

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("Network Failure");
    expect(result.upsertedCount).toBe(1);
    expect(result.fetchedCount).toBe(1);
  });

  it("increments skippedCount when parser returns null (non-hotel page)", async () => {
    const now = new Date("2026-04-20T00:00:00Z");

    (prisma.property.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (prisma.property.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 0 });

    const fetchHtml = vi.fn().mockResolvedValue("<html><body>Not a hotel page</body></html>");

    const result = await ingestGhaProperties({
      harvest: async () => ["/not-a-hotel"],
      fetchHtml,
      now,
      requestDelayMs: 0,
    });

    expect(result.skippedCount).toBe(1);
    expect(result.upsertedCount).toBe(0);
    expect(result.fetchedCount).toBe(1); // It was fetched, but then skipped by parser
  });

  it("calls prisma.property.upsert with correct parsed fields", async () => {
    const now = new Date("2026-04-20T00:00:00Z");

    (prisma.property.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (prisma.property.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 0 });
    (prisma.hotelChainSubBrand.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "sb1" });

    const html = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
      props: {
        pageProps: {
          page: {
            name: "Grand Hotel",
            zipCode: "12345",
            _info: { id: "GHA123" },
            location: { address: "123 Main St", latitude: 45.0, longitude: 9.0 },
            city: {
              name: "Milan",
              _location: { parentLocation: { content: { name: "Italy" } } },
            },
            categories: [{ name: "Luxury" }, { name: "Business" }],
          },
        },
      },
    })}</script>`;

    await ingestGhaProperties({
      harvest: async () => ["/anantara/grand-hotel"],
      fetchHtml: vi.fn().mockResolvedValue(html),
      now,
      requestDelayMs: 0,
    });

    expect(prisma.property.upsert).toHaveBeenCalledWith({
      where: {
        hotelChainId_chainUrlPath: {
          hotelChainId: HOTEL_ID.GHA_DISCOVERY,
          chainUrlPath: "/anantara/grand-hotel",
        },
      },
      update: expect.objectContaining({
        name: "Grand Hotel",
        countryCode: "IT",
        city: "Milan",
        address: "123 Main St",
        latitude: 45.0,
        longitude: 9.0,
        chainPropertyId: "GHA123",
        chainCategories: ["Luxury", "Business"],
        detailLastFetchedAt: now,
      }),
      create: expect.objectContaining({
        name: "Grand Hotel",
        hotelChainId: HOTEL_ID.GHA_DISCOVERY,
        chainUrlPath: "/anantara/grand-hotel",
        countryCode: "IT",
        city: "Milan",
        address: "123 Main St",
        latitude: 45.0,
        longitude: 9.0,
        chainPropertyId: "GHA123",
        chainCategories: ["Luxury", "Business"],
        detailLastFetchedAt: now,
      }),
    });
  });
});
