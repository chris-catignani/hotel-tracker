import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import { fetchAllBrands } from "./property-fetcher";
import { BRAND_CODE_MAP } from "./property-parser";
import { logger } from "@/lib/logger";

const KNOWN_COUNT = Object.keys(BRAND_CODE_MAP).length; // 33
const DISCOVERY_COUNT = 676 - KNOWN_COUNT; // 643

describe("fetchAllBrands", () => {
  it("calls knownFetchBrand for all known brand codes and discoveryFetchBrand for all others", async () => {
    const knownCalled: string[] = [];
    const discoveryCalled: string[] = [];

    const knownFetchBrand = vi.fn().mockImplementation(async (code: string) => {
      knownCalled.push(code);
      return null;
    });
    const discoveryFetchBrand = vi.fn().mockImplementation(async (code: string) => {
      discoveryCalled.push(code);
      return null;
    });

    await fetchAllBrands(knownFetchBrand, discoveryFetchBrand, 0);

    expect(knownCalled).toHaveLength(KNOWN_COUNT);
    expect(discoveryCalled).toHaveLength(DISCOVERY_COUNT);
    expect(knownCalled).toContain("RZ");
    expect(knownCalled).toContain("MC");
    expect(discoveryCalled).not.toContain("RZ");
    expect(new Set([...knownCalled, ...discoveryCalled]).size).toBe(676);
  });

  it("collects successful responses from both phases", async () => {
    const knownFetchBrand = vi.fn().mockImplementation(async (code: string) => {
      if (code === "RZ") return { regions: [] };
      return null;
    });
    const discoveryFetchBrand = vi.fn().mockImplementation(async (code: string) => {
      if (code === "AA") return { regions: [] }; // simulates a newly discovered brand
      return null;
    });

    const result = await fetchAllBrands(knownFetchBrand, discoveryFetchBrand, 0);

    expect(result.responses).toHaveLength(2);
    expect(result.responses.map((r) => r.brandCode)).toEqual(expect.arrayContaining(["RZ", "AA"]));
    expect(result.sweptCount).toBe(676);
    expect(result.errors).toHaveLength(0);
  });

  it("captures errors from the known phase", async () => {
    const knownFetchBrand = vi.fn().mockImplementation(async (code: string) => {
      if (code === "RZ") throw new Error("HTTP 503");
      return null;
    });
    const discoveryFetchBrand = vi.fn().mockResolvedValue(null);

    const result = await fetchAllBrands(knownFetchBrand, discoveryFetchBrand, 0);

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("RZ");
    expect(result.errors[0]).toContain("HTTP 503");
    expect(logger.warn).toHaveBeenCalledWith(
      "marriott_fetch:brand_error",
      expect.objectContaining({ brandCode: "RZ" })
    );
  });

  it("sweptCount is 676 regardless of success/failure mix", async () => {
    const knownFetchBrand = vi.fn().mockImplementation(async (code: string) => {
      if (code === "FI") return { regions: [] };
      if (code === "CY") throw new Error("oops");
      return null;
    });
    const discoveryFetchBrand = vi.fn().mockResolvedValue(null);

    const result = await fetchAllBrands(knownFetchBrand, discoveryFetchBrand, 0);

    expect(result.sweptCount).toBe(676);
    expect(result.responses).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
  });
});
