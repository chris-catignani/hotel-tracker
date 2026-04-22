import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import { fetchAllBrands } from "./property-fetcher";
import { logger } from "@/lib/logger";

describe("fetchAllBrands", () => {
  it("generates all 676 two-letter codes from AA to ZZ", async () => {
    const called: string[] = [];
    const fetchBrand = vi.fn().mockImplementation(async (code: string) => {
      called.push(code);
      return null;
    });

    await fetchAllBrands(fetchBrand);

    expect(called).toHaveLength(676);
    expect(called[0]).toBe("AA");
    expect(called[called.length - 1]).toBe("ZZ");
    expect(called).toContain("RZ");
    expect(called).toContain("MC");
    expect(new Set(called).size).toBe(676);
  });

  it("includes successful responses and silently drops null (404) responses", async () => {
    const fetchBrand = vi.fn().mockImplementation(async (code: string) => {
      if (code === "RZ") return { regions: [] };
      if (code === "MC") return { regions: [] };
      return null;
    });

    const result = await fetchAllBrands(fetchBrand);

    expect(result.responses).toHaveLength(2);
    expect(result.responses.map((r) => r.brandCode)).toEqual(expect.arrayContaining(["RZ", "MC"]));
    expect(result.sweptCount).toBe(676);
    expect(result.errors).toHaveLength(0);
  });

  it("adds to errors and continues sweep when fetchBrand throws", async () => {
    const fetchBrand = vi.fn().mockImplementation(async (code: string) => {
      if (code === "RZ") throw new Error("HTTP 503");
      return null;
    });

    const result = await fetchAllBrands(fetchBrand);

    expect(result.responses).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("RZ");
    expect(result.errors[0]).toContain("HTTP 503");
    expect(logger.warn).toHaveBeenCalledWith(
      "marriott_fetch:brand_error",
      expect.objectContaining({ brandCode: "RZ" })
    );
  });

  it("reports sweptCount as 676 regardless of success/failure mix", async () => {
    const fetchBrand = vi.fn().mockImplementation(async (code: string) => {
      if (code === "AA") return { regions: [] };
      if (code === "AB") throw new Error("oops");
      return null;
    });

    const result = await fetchAllBrands(fetchBrand);

    expect(result.sweptCount).toBe(676);
    expect(result.responses).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
  });
});
