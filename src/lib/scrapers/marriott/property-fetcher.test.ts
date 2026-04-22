import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import { fetchAllBrands } from "./property-fetcher";
import { BRAND_CODE_MAP } from "./property-parser";
import { logger } from "@/lib/logger";

const KNOWN_CODE_COUNT = Object.keys(BRAND_CODE_MAP).length;

describe("fetchAllBrands", () => {
  it("fetches exactly the known brand codes from BRAND_CODE_MAP", async () => {
    const called: string[] = [];
    const fetchBrand = vi.fn().mockImplementation(async (code: string) => {
      called.push(code);
      return null;
    });

    await fetchAllBrands(fetchBrand, 0);

    expect(called).toHaveLength(KNOWN_CODE_COUNT);
    expect(called).toContain("RZ");
    expect(called).toContain("MC");
    expect(called).toContain("FI");
    expect(new Set(called).size).toBe(KNOWN_CODE_COUNT);
  });

  it("includes successful responses and silently drops null (404) responses", async () => {
    const fetchBrand = vi.fn().mockImplementation(async (code: string) => {
      if (code === "RZ") return { regions: [] };
      if (code === "MC") return { regions: [] };
      return null;
    });

    const result = await fetchAllBrands(fetchBrand, 0);

    expect(result.responses).toHaveLength(2);
    expect(result.responses.map((r) => r.brandCode)).toEqual(expect.arrayContaining(["RZ", "MC"]));
    expect(result.sweptCount).toBe(KNOWN_CODE_COUNT);
    expect(result.errors).toHaveLength(0);
  });

  it("adds to errors and continues sweep when fetchBrand throws", async () => {
    const fetchBrand = vi.fn().mockImplementation(async (code: string) => {
      if (code === "RZ") throw new Error("HTTP 503");
      return null;
    });

    const result = await fetchAllBrands(fetchBrand, 0);

    expect(result.responses).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("RZ");
    expect(result.errors[0]).toContain("HTTP 503");
    expect(logger.warn).toHaveBeenCalledWith(
      "marriott_fetch:brand_error",
      expect.objectContaining({ brandCode: "RZ" })
    );
  });

  it("reports sweptCount equal to known brand code count regardless of success/failure mix", async () => {
    const fetchBrand = vi.fn().mockImplementation(async (code: string) => {
      if (code === "FI") return { regions: [] };
      if (code === "CY") throw new Error("oops");
      return null;
    });

    const result = await fetchAllBrands(fetchBrand, 0);

    expect(result.sweptCount).toBe(KNOWN_CODE_COUNT);
    expect(result.responses).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
  });
});
