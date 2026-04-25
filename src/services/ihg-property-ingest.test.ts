import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("playwright", () => ({
  chromium: { launch: vi.fn() },
}));

vi.mock("@/lib/scrapers/ihg/sitemap-harvest", () => ({
  harvestMnemonicsFromSitemap: vi.fn(),
}));

vi.mock("@/lib/scrapers/ihg/property-fetcher", () => ({
  fetchPropertyProfile: vi.fn(),
}));

vi.mock("@/lib/scrapers/ihg/property-parser", () => ({
  parseIhgProfile: vi.fn(),
}));

import { chromium } from "playwright";
import { harvestMnemonicsFromSitemap } from "@/lib/scrapers/ihg/sitemap-harvest";
import { fetchPropertyProfile } from "@/lib/scrapers/ihg/property-fetcher";
import { parseIhgProfile } from "@/lib/scrapers/ihg/property-parser";
import { ingestIhgProperties } from "./ihg-property-ingest";
import type { ChainFetchResult } from "./property-ingest-orchestrator";

function makeMockBrowser() {
  const mockPage = {};
  const mockContext = { newPage: vi.fn().mockResolvedValue(mockPage) };
  return {
    newContext: vi.fn().mockResolvedValue(mockContext),
    close: vi.fn().mockResolvedValue(undefined),
  };
}

function makeParsedProperty(chainPropertyId: string) {
  return {
    chainPropertyId,
    name: `Hotel ${chainPropertyId}`,
    subBrandName: "InterContinental",
    address: "1 Main St",
    city: "City",
    countryCode: "US",
    latitude: 40.0,
    longitude: -75.0,
  };
}

describe("ingestIhgProperties", () => {
  beforeEach(() => vi.clearAllMocks());

  it("harvests mnemonics, fetches profiles, and returns parsed properties", async () => {
    const mockBrowser = makeMockBrowser();
    (chromium.launch as ReturnType<typeof vi.fn>).mockResolvedValue(mockBrowser);
    (harvestMnemonicsFromSitemap as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Set(["HERCT", "NYCPC"])
    );
    (fetchPropertyProfile as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (parseIhgProfile as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(makeParsedProperty("HERCT"))
      .mockReturnValueOnce(makeParsedProperty("NYCPC"));

    const result: ChainFetchResult = await ingestIhgProperties({ batchSleepMs: 0 });

    expect(result.properties).toHaveLength(2);
    expect(result.skippedCount).toBe(0);
    expect(result.errors).toHaveLength(0);
    expect(mockBrowser.close).toHaveBeenCalledOnce();
  });

  it("counts non-OPEN hotels as skipped (parseIhgProfile returns null)", async () => {
    const mockBrowser = makeMockBrowser();
    (chromium.launch as ReturnType<typeof vi.fn>).mockResolvedValue(mockBrowser);
    (harvestMnemonicsFromSitemap as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Set(["CLOSED1"])
    );
    (fetchPropertyProfile as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (parseIhgProfile as ReturnType<typeof vi.fn>).mockReturnValue(null);

    const result: ChainFetchResult = await ingestIhgProperties({ batchSleepMs: 0 });

    expect(result.skippedCount).toBe(1);
    expect(result.properties).toHaveLength(0);
  });

  it("records error when fetchPropertyProfile throws, does not abort batch", async () => {
    const mockBrowser = makeMockBrowser();
    (chromium.launch as ReturnType<typeof vi.fn>).mockResolvedValue(mockBrowser);
    (harvestMnemonicsFromSitemap as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Set(["ERR01", "GOOD1"])
    );
    (fetchPropertyProfile as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new Error("HTTP 403"))
      .mockResolvedValueOnce({});
    (parseIhgProfile as ReturnType<typeof vi.fn>).mockReturnValue(makeParsedProperty("GOOD1"));

    const result: ChainFetchResult = await ingestIhgProperties({ batchSleepMs: 0 });

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("ERR01");
    expect(result.properties).toHaveLength(1);
  });

  it("does not close an injected browser", async () => {
    const mockBrowser = makeMockBrowser() as ReturnType<typeof makeMockBrowser>;
    (harvestMnemonicsFromSitemap as ReturnType<typeof vi.fn>).mockResolvedValue(new Set());

    await ingestIhgProperties({
      browser: mockBrowser as unknown as import("playwright").Browser,
      batchSleepMs: 0,
    });

    expect(mockBrowser.close).not.toHaveBeenCalled();
  });

  it("respects limit: fetches only the first N mnemonics", async () => {
    const mockBrowser = makeMockBrowser();
    (chromium.launch as ReturnType<typeof vi.fn>).mockResolvedValue(mockBrowser);
    (harvestMnemonicsFromSitemap as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Set(["A1", "B2", "C3"])
    );
    (fetchPropertyProfile as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (parseIhgProfile as ReturnType<typeof vi.fn>).mockReturnValue(makeParsedProperty("A1"));

    const result: ChainFetchResult = await ingestIhgProperties({ limit: 1, batchSleepMs: 0 });

    expect(fetchPropertyProfile).toHaveBeenCalledTimes(1);
    expect(result.properties).toHaveLength(1);
  });

  it("maps all ParsedProperty fields correctly", async () => {
    const mockBrowser = makeMockBrowser();
    (chromium.launch as ReturnType<typeof vi.fn>).mockResolvedValue(mockBrowser);
    (harvestMnemonicsFromSitemap as ReturnType<typeof vi.fn>).mockResolvedValue(new Set(["HERCT"]));
    (fetchPropertyProfile as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (parseIhgProfile as ReturnType<typeof vi.fn>).mockReturnValue(makeParsedProperty("HERCT"));

    const result: ChainFetchResult = await ingestIhgProperties({ batchSleepMs: 0 });

    expect(result.properties[0]).toMatchObject({
      name: "Hotel HERCT",
      chainPropertyId: "HERCT",
      chainUrlPath: null,
      subBrandName: "InterContinental",
      countryCode: "US",
      city: "City",
    });
  });
});
