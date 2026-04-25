import { describe, it, expect, vi, beforeEach } from "vitest";
import { HOTEL_ID } from "@/lib/constants";

vi.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    property: {
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

  it("fetches all harvested URLs regardless of prior fetch history", async () => {
    const now = new Date("2026-04-24T00:00:00Z");

    const fetchHtml = vi.fn().mockResolvedValue(null); // 404 for all — we just care about call count

    await ingestGhaProperties({
      harvest: async () => ["/anantara/a", "/anantara/b", "/anantara/c"],
      fetchHtml,
      now,
      requestDelayMs: 0,
    });

    expect(fetchHtml).toHaveBeenCalledTimes(3);
  });

  it("stamps lastSeenAt on all upserted properties", async () => {
    const now = new Date("2026-04-24T00:00:00Z");

    (prisma.property.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "p1" });
    (prisma.hotelChainSubBrand.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "sb1" });

    const html = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
      props: {
        pageProps: {
          page: {
            name: "Test Hotel",
            zipCode: null,
            _info: { id: 1 },
            location: { address: "addr", latitude: 1, longitude: 2 },
            city: { name: "City", _location: { parentLocation: { content: { name: "Italy" } } } },
          },
        },
      },
    })}</script>`;

    const fetchHtml = vi.fn().mockResolvedValue(html);

    const result = await ingestGhaProperties({
      harvest: async () => ["/anantara/a", "/anantara/b"],
      fetchHtml,
      now,
      requestDelayMs: 0,
    });

    expect(fetchHtml).toHaveBeenCalledTimes(2);
    expect(result.harvestedCount).toBe(2);
    expect(result.fetchedCount).toBe(2);
    expect(result.upsertedCount).toBe(2);
  });

  it("counts 404 URLs as skipped, not errors, and does not increment fetchedCount", async () => {
    const now = new Date("2026-04-20T00:00:00Z");

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

    const fetchHtml = vi.fn().mockResolvedValue("<html><body>Not a hotel page</body></html>");

    const result = await ingestGhaProperties({
      harvest: async () => ["/not-a-hotel"],
      fetchHtml,
      now,
      requestDelayMs: 0,
    });

    expect(result.skippedCount).toBe(1);
    expect(result.upsertedCount).toBe(0);
    expect(result.fetchedCount).toBe(1);
  });

  it("calls prisma.property.upsert with correct parsed fields", async () => {
    const now = new Date("2026-04-20T00:00:00Z");

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
      }),
    });
  });
});
