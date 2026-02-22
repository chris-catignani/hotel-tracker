import { describe, it, expect } from "vitest";
import { HOTEL_ID, CURRENCIES, PAYMENT_TYPES } from "./constants";

describe("constants", () => {
  it("should have correct HOTEL_ID values", () => {
    expect(HOTEL_ID.HILTON).toBe(1);
    expect(HOTEL_ID.MARRIOTT).toBe(2);
    expect(HOTEL_ID.HYATT).toBe(3);
    expect(HOTEL_ID.IHG).toBe(4);
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
