import { describe, it, expect, vi } from "vitest";
import { ingestGhaProperties } from "./gha-property-ingest";
import type { ChainFetchResult } from "./property-ingest-orchestrator";

describe("ingestGhaProperties", () => {
  it("fetches all harvested URLs and returns parsed properties", async () => {
    const html = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
      props: {
        pageProps: {
          page: {
            name: "Test Hotel",
            zipCode: null,
            _info: { id: 1 },
            location: { address: "Via Roma 1", latitude: 40.0, longitude: 14.0 },
            city: { name: "Naples", _location: { parentLocation: { content: { name: "Italy" } } } },
          },
        },
      },
    })}</script>`;

    const fetchHtml = vi.fn().mockResolvedValue(html);

    const result: ChainFetchResult = await ingestGhaProperties({
      harvest: async () => ["/anantara/a", "/anantara/b"],
      fetchHtml,
      requestDelayMs: 0,
    });

    expect(fetchHtml).toHaveBeenCalledTimes(2);
    expect(result.properties).toHaveLength(2);
    expect(result.skippedCount).toBe(0);
    expect(result.errors).toHaveLength(0);
  });

  it("counts 404 URLs as skipped", async () => {
    const fetchHtml = vi.fn().mockResolvedValue(null);

    const result: ChainFetchResult = await ingestGhaProperties({
      harvest: async () => ["/anantara/gone"],
      fetchHtml,
      requestDelayMs: 0,
    });

    expect(result.properties).toHaveLength(0);
    expect(result.skippedCount).toBe(1);
    expect(result.errors).toHaveLength(0);
  });

  it("counts unparseable pages as skipped", async () => {
    const fetchHtml = vi.fn().mockResolvedValue("<html>not a hotel</html>");

    const result: ChainFetchResult = await ingestGhaProperties({
      harvest: async () => ["/not-a-hotel"],
      fetchHtml,
      requestDelayMs: 0,
    });

    expect(result.properties).toHaveLength(0);
    expect(result.skippedCount).toBe(1);
  });

  it("records fetch errors without aborting the run", async () => {
    const html = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
      props: {
        pageProps: {
          page: {
            name: "OK Hotel",
            _info: { id: 2 },
            location: { address: "a", latitude: 1, longitude: 2 },
            city: { name: "City", _location: {} },
          },
        },
      },
    })}</script>`;

    const fetchHtml = vi
      .fn()
      .mockRejectedValueOnce(new Error("Network Failure"))
      .mockResolvedValueOnce(html);

    const result: ChainFetchResult = await ingestGhaProperties({
      harvest: async () => ["/fail", "/anantara/ok"],
      fetchHtml,
      requestDelayMs: 0,
    });

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("Network Failure");
    expect(result.properties).toHaveLength(1);
  });

  it("respects the limit option", async () => {
    const fetchHtml = vi.fn().mockResolvedValue(null);

    await ingestGhaProperties({
      harvest: async () => ["/a", "/b", "/c"],
      fetchHtml,
      requestDelayMs: 0,
      limit: 2,
    });

    expect(fetchHtml).toHaveBeenCalledTimes(2);
  });

  it("maps ParsedProperty fields correctly", async () => {
    const html = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
      props: {
        pageProps: {
          page: {
            name: "Grand Hotel",
            zipCode: "12345",
            _info: { id: "GHA123" },
            location: { address: "123 Main St", latitude: 45.0, longitude: 9.0 },
            city: { name: "Milan", _location: { parentLocation: { content: { name: "Italy" } } } },
          },
        },
      },
    })}</script>`;

    const result: ChainFetchResult = await ingestGhaProperties({
      harvest: async () => ["/anantara/grand-hotel"],
      fetchHtml: vi.fn().mockResolvedValue(html),
      requestDelayMs: 0,
    });

    expect(result.properties[0]).toMatchObject({
      name: "Grand Hotel",
      chainPropertyId: "GHA123",
      chainUrlPath: "/anantara/grand-hotel",
      countryCode: "IT",
      city: "Milan",
      address: "123 Main St",
      latitude: 45.0,
      longitude: 9.0,
      subBrandName: expect.any(String),
    });
  });
});
