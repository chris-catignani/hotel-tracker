import { describe, it, expect, beforeEach, vi } from "vitest";
import { subBrandNameForCode } from "./brand-codes";

const mockLogger = { warn: vi.fn() };

describe("subBrandNameForCode", () => {
  beforeEach(() => {
    mockLogger.warn.mockClear();
  });
  it("returns human-readable name for known code IBH", () => {
    expect(subBrandNameForCode("IBH", mockLogger)).toBe("Ibis");
  });

  it("returns human-readable name for known code NOV", () => {
    expect(subBrandNameForCode("NOV", mockLogger)).toBe("Novotel");
  });

  it("returns null for SAM (unbranded, managed by Accor)", () => {
    expect(subBrandNameForCode("SAM", mockLogger)).toBeNull();
  });

  it("returns null and logs warning for unknown code", () => {
    const result = subBrandNameForCode("XYZ", mockLogger);
    expect(result).toBeNull();
    expect(mockLogger.warn).toHaveBeenCalledWith("accor_ingest:unknown_brand_code", {
      code: "XYZ",
    });
  });

  it("does not log warning for known code", () => {
    subBrandNameForCode("MER", mockLogger);
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });

  it("does not log warning for SAM", () => {
    subBrandNameForCode("SAM", mockLogger);
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });
});
