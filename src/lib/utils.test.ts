import { describe, it, expect } from "vitest";
import { cn, formatCurrency, formatDate } from "./utils";

describe("utils", () => {
  describe("cn", () => {
    it("should merge class names correctly", () => {
      expect(cn("class1", "class2")).toBe("class1 class2");
      expect(cn("class1", { class2: true, class3: false })).toBe("class1 class2");
      expect(cn("px-2 py-2", "px-4")).toBe("py-2 px-4"); // tailwind-merge handles this
    });
  });

  describe("formatCurrency", () => {
    it("should format numbers as USD currency", () => {
      expect(formatCurrency(1234.56)).toBe("$1,234.56");
      expect(formatCurrency(0)).toBe("$0.00");
      expect(formatCurrency(10.5)).toBe("$10.50");
    });

    it("should handle large numbers correctly", () => {
      expect(formatCurrency(1000000)).toBe("$1,000,000.00");
    });

    it("should support rounding to zero decimal places", () => {
      expect(
        formatCurrency(1234.56, "USD", { minimumFractionDigits: 0, maximumFractionDigits: 0 })
      ).toBe("$1,235");
      expect(formatCurrency(0, "USD", { minimumFractionDigits: 0, maximumFractionDigits: 0 })).toBe(
        "$0"
      );
    });
  });

  describe("formatDate", () => {
    it("should format dates as MM/DD/YY", () => {
      expect(formatDate("2026-03-09")).toBe("03/09/26");
      expect(formatDate("1999-12-31")).toBe("12/31/99");
      expect(formatDate("2000-01-01")).toBe("01/01/00");
    });
  });
});
