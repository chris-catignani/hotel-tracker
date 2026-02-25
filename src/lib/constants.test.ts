import { describe, it, expect } from "vitest";
import { HOTEL_ID, CURRENCIES, PAYMENT_TYPES } from "./constants";

describe("constants", () => {
  it("should have correct HOTEL_ID values", () => {
    expect(typeof HOTEL_ID.HILTON).toBe("string");
    expect(HOTEL_ID.HILTON).toBe("c1v12til5p1ebxu77368umx5z");
    expect(HOTEL_ID.MARRIOTT).toBe("c9uc76fdp3v95dccffxsa3h31");
    expect(HOTEL_ID.HYATT).toBe("cxjdwg32a8xf7by36md0mdvuu");
    expect(HOTEL_ID.IHG).toBe("co5ll49okbgq0fbceti8p0dpd");
  });

  it("should have all expected currencies", () => {
    expect(CURRENCIES).toContain("USD");
    expect(CURRENCIES).toContain("EUR");
    expect(CURRENCIES.length).toBeGreaterThan(10);
  });

  it("should have all expected payment types", () => {
    const values = PAYMENT_TYPES.map((p) => p.value);
    expect(values).toContain("cash");
    expect(values).toContain("points");
    expect(values).toContain("cert");
    expect(values.length).toBe(7);
  });
});
