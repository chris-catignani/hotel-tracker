import { describe, it, expect } from "vitest";
import { cn, formatCurrency, formatDate, nightsBetween, pruneHotelName } from "./utils";

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

  describe("nightsBetween", () => {
    it("returns the number of nights between two dates", () => {
      expect(nightsBetween("2026-04-14", "2026-04-17")).toBe(3);
    });

    it("returns 1 for a single-night stay", () => {
      expect(nightsBetween("2026-04-14", "2026-04-15")).toBe(1);
    });

    it("handles month boundaries", () => {
      expect(nightsBetween("2026-03-29", "2026-04-02")).toBe(4);
    });

    it("returns 0 when checkOut is before checkIn", () => {
      expect(nightsBetween("2026-04-17", "2026-04-14")).toBe(0);
    });
  });

  describe("pruneHotelName", () => {
    it("removes chain attribution suffixes when at the end of the name", () => {
      // IHG real-world pattern (Google Places appends "by IHG" to many properties)
      expect(pruneHotelName("Holiday Inn Express Kuala Lumpur City Centre by IHG")).toBe(
        "Holiday Inn Express Kuala Lumpur City Centre"
      );
      expect(pruneHotelName("Crowne Plaza Kuala Lumpur City Centre by IHG")).toBe(
        "Crowne Plaza Kuala Lumpur City Centre"
      );
      expect(pruneHotelName("Hotel Indigo Kuala Lumpur on the Park by IHG")).toBe(
        "Hotel Indigo Kuala Lumpur on the Park"
      );
      // Generic pattern for other chains
      expect(pruneHotelName("Waldorf Astoria Berlin by Hilton")).toBe("Waldorf Astoria Berlin");
      expect(pruneHotelName("Le Méridien Vienna by Marriott")).toBe("Le Méridien Vienna");
      expect(pruneHotelName("Andaz Tokyo by Hyatt")).toBe("Andaz Tokyo");
      expect(pruneHotelName("Sofitel Paris by Accor")).toBe("Sofitel Paris");
    });

    it("does NOT strip 'by [Chain]' when it appears mid-name as part of a brand", () => {
      // "by Hilton" is part of "DoubleTree by Hilton" brand name — should not be stripped
      expect(pruneHotelName("DoubleTree by Hilton Amsterdam")).toBe(
        "DoubleTree by Hilton Amsterdam"
      );
      expect(pruneHotelName("Courtyard by Marriott Chicago")).toBe("Courtyard by Marriott Chicago");
    });

    it("removes 'a/an [Brand] Hotel' soft-brand suffixes", () => {
      expect(
        pruneHotelName("The Serangoon House Little India, Singapore, a Tribute Portfolio Hotel")
      ).toBe("The Serangoon House Little India, Singapore");
      expect(pruneHotelName("The Grand Hotel, an Autograph Collection Hotel")).toBe(
        "The Grand Hotel"
      );
      expect(pruneHotelName("Boutique Hotel Berlin, a Curio Collection Hotel")).toBe(
        "Boutique Hotel Berlin"
      );
    });

    it("removes '[Brand] Collection' soft-brand suffixes", () => {
      expect(pruneHotelName("Duxton Reserve Singapore, Autograph Collection")).toBe(
        "Duxton Reserve Singapore"
      );
      expect(pruneHotelName("Hotel Arts Barcelona, The Luxury Collection")).toBe(
        "Hotel Arts Barcelona"
      );
      expect(pruneHotelName("The Beach Hotel, Curio Collection by Hilton")).toBe("The Beach Hotel");
      expect(pruneHotelName("Hotel Rome, Tapestry Collection by Hilton")).toBe("Hotel Rome");
      expect(pruneHotelName("Kimpton Hotel, Vignette Collection")).toBe("Kimpton Hotel");
    });

    it("removes '[Brand] Portfolio' soft-brand suffixes", () => {
      expect(pruneHotelName("The Nines Portland, Luxury Collection")).toBe("The Nines Portland");
      expect(pruneHotelName("The Blakely New York, Tribute Portfolio")).toBe(
        "The Blakely New York"
      );
    });

    it("removes 'Design Hotels' suffix", () => {
      expect(pruneHotelName("25hours Hotel, Design Hotels")).toBe("25hours Hotel");
    });

    it("does not alter names with no matching suffixes", () => {
      expect(pruneHotelName("Grand Hyatt Kuala Lumpur")).toBe("Grand Hyatt Kuala Lumpur");
      expect(pruneHotelName("Park Hyatt Chicago")).toBe("Park Hyatt Chicago");
      expect(pruneHotelName("Atlanta Marriott Marquis")).toBe("Atlanta Marriott Marquis");
      expect(pruneHotelName("The St. Regis Singapore")).toBe("The St. Regis Singapore");
      expect(pruneHotelName("citizenM Kuala Lumpur")).toBe("citizenM Kuala Lumpur");
      expect(pruneHotelName("PARKROYAL COLLECTION Kuala Lumpur")).toBe(
        "PARKROYAL COLLECTION Kuala Lumpur"
      );
    });

    it("is case-insensitive for suffix matching", () => {
      expect(pruneHotelName("Hotel X BY IHG")).toBe("Hotel X");
      expect(pruneHotelName("Hotel Y, autograph collection")).toBe("Hotel Y");
    });

    it("applies rules in order, allowing multiple matches", () => {
      // "by Hilton" stripped first, then resulting ", Curio Collection" stripped
      expect(pruneHotelName("Hotel Z, Curio Collection by Hilton")).toBe("Hotel Z");
    });
  });
});
