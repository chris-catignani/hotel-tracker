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

vi.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    property: { upsert: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    hotelChainSubBrand: { upsert: vi.fn() },
  },
}));

import { chromium } from "playwright";
import { harvestMnemonicsFromSitemap } from "@/lib/scrapers/ihg/sitemap-harvest";
import { fetchPropertyProfile } from "@/lib/scrapers/ihg/property-fetcher";
import { parseIhgProfile } from "@/lib/scrapers/ihg/property-parser";
import prisma from "@/lib/prisma";
import { ingestIhgProperties } from "./ihg-property-ingest";

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

  it("harvests mnemonics from sitemap, fetches profiles, and upserts properties", async () => {
    const mockBrowser = makeMockBrowser();
    (chromium.launch as ReturnType<typeof vi.fn>).mockResolvedValue(mockBrowser);
    (harvestMnemonicsFromSitemap as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Set(["HERCT", "NYCPC"])
    );
    (fetchPropertyProfile as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (parseIhgProfile as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(makeParsedProperty("HERCT"))
      .mockReturnValueOnce(makeParsedProperty("NYCPC"));
    (prisma.hotelChainSubBrand.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "sb1" });
    (prisma.property.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "p1" });

    const result = await ingestIhgProperties({ batchSleepMs: 0 });

    expect(result.discoveredCount).toBe(2);
    expect(result.fetchedCount).toBe(2);
    expect(result.skippedCount).toBe(0);
    expect(result.upsertedCount).toBe(2);
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

    const result = await ingestIhgProperties({ batchSleepMs: 0 });

    expect(result.skippedCount).toBe(1);
    expect(result.fetchedCount).toBe(0);
    expect(result.upsertedCount).toBe(0);
    expect(prisma.property.upsert).not.toHaveBeenCalled();
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
    (prisma.hotelChainSubBrand.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (prisma.property.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "p1" });

    const result = await ingestIhgProperties({ batchSleepMs: 0 });

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("ERR01");
    expect(result.upsertedCount).toBe(1);
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
    (prisma.hotelChainSubBrand.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (prisma.property.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "p1" });

    const result = await ingestIhgProperties({ limit: 1, batchSleepMs: 0 });

    expect(fetchPropertyProfile).toHaveBeenCalledTimes(1);
    expect(result.discoveredCount).toBe(1);
  });
});
