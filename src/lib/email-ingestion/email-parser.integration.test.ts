// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { parseConfirmationEmail } from "@/lib/email-ingestion/email-parser";
import { hyattGuide } from "@/lib/email-ingestion/chain-guides/hyatt";
import { marriottGuide } from "@/lib/email-ingestion/chain-guides/marriott";
import { ihgGuide } from "@/lib/email-ingestion/chain-guides/ihg";
import { accorGuide } from "@/lib/email-ingestion/chain-guides/accor";
import { ghaGuide } from "@/lib/email-ingestion/chain-guides/gha";
import { airbnbGuide } from "@/lib/email-ingestion/chain-guides/airbnb";
import { amexGuide } from "@/lib/email-ingestion/chain-guides/amex";
import { bookingcomGuide } from "@/lib/email-ingestion/chain-guides/bookingcom";
import { chaseGuide } from "@/lib/email-ingestion/chain-guides/chase";

vi.setConfig({ testTimeout: 30_000 });

const fixture = (name: string) => readFileSync(resolve(__dirname, "./fixtures", name), "utf-8");

const skipIf = describe.skipIf(!process.env.RUN_INTEGRATION_TESTS);

skipIf("Email parsing integration", () => {
  describe("Hyatt", () => {
    it("expands date-range nightly rates into per-night entries (cash fixture 1)", async () => {
      const result = await parseConfirmationEmail(fixture("hyatt-confirmation-cash"), hyattGuide);
      expect(result).not.toBeNull();
      expect(result?.bookingType).toBe("cash");
      expect(result?.propertyName).toBe("Hyatt Regency Salt Lake City");
      expect(result?.checkIn).toBe("2027-01-14");
      expect(result?.checkOut).toBe("2027-01-18");
      expect(result?.numNights).toBe(4);
      expect(result?.confirmationNumber).toBe("73829461");
      expect(result?.hotelChain).toBe("Hyatt");
      expect(result?.currency).toBe("USD");
      // Jan 14 at 160.72, then Jan 15–17 range expanded to 3 × 142.10 (inclusive end date)
      expect(result?.nightlyRates).toHaveLength(4);
      expect(result?.nightlyRates?.[0].amount).toBe(160.72);
      expect(result?.nightlyRates?.[1].amount).toBe(142.1);
      expect(result?.nightlyRates?.[2].amount).toBe(142.1);
      expect(result?.nightlyRates?.[3].amount).toBe(142.1);
      expect(result?.pretaxCost).toBeNull();
      expect(result?.totalCost).toBeNull();
    });

    it("expands date-range nightly rates into per-night entries (cash fixture 2)", async () => {
      const result = await parseConfirmationEmail(fixture("hyatt-confirmation-cash-2"), hyattGuide);
      expect(result).not.toBeNull();
      expect(result?.bookingType).toBe("cash");
      expect(result?.propertyName).toBe("Hyatt Regency Salt Lake City");
      expect(result?.checkIn).toBe("2027-01-14");
      expect(result?.checkOut).toBe("2027-01-18");
      expect(result?.numNights).toBe(4);
      expect(result?.confirmationNumber).toBe("12345678");
      expect(result?.hotelChain).toBe("Hyatt");
      expect(result?.currency).toBe("USD");
      // Jan 14 at 160.72, then Jan 15–17 range expanded to 3 × 142.10 (inclusive end date)
      expect(result?.nightlyRates).toHaveLength(4);
      expect(result?.nightlyRates?.[0].amount).toBe(160.72);
      expect(result?.nightlyRates?.[1].amount).toBe(142.1);
      expect(result?.nightlyRates?.[2].amount).toBe(142.1);
      expect(result?.nightlyRates?.[3].amount).toBe(142.1);
      expect(result?.pretaxCost).toBeNull();
      expect(result?.totalCost).toBeNull();
    });

    it("parses points booking with null costs", async () => {
      const result = await parseConfirmationEmail(fixture("hyatt-confirmation-points"), hyattGuide);
      expect(result).not.toBeNull();
      expect(result?.bookingType).toBe("points");
      expect(result?.propertyName).toBe("Hyatt Place Salt Lake City/Cottonwood");
      expect(result?.checkIn).toBe("2027-01-19");
      expect(result?.checkOut).toBe("2027-01-26");
      expect(result?.numNights).toBe(7);
      expect(result?.confirmationNumber).toBe("58134720");
      expect(result?.hotelChain).toBe("Hyatt");
      expect(result?.pretaxCost).toBeNull();
      expect(result?.taxLines).toBeNull();
      expect(result?.totalCost).toBeNull();
    });
  });

  describe("Marriott", () => {
    it("parses cash booking with SGD costs", async () => {
      const result = await parseConfirmationEmail(
        fixture("marriott-confirmation-cash"),
        marriottGuide
      );
      expect(result).not.toBeNull();
      expect(result?.bookingType).toBe("cash");
      expect(result?.propertyName).toBe(
        "The Serangoon House Little India, Singapore, a Tribute Portfolio Hotel"
      );
      expect(result?.checkIn).toBe("2026-04-14");
      expect(result?.checkOut).toBe("2026-04-15");
      expect(result?.numNights).toBe(1);
      expect(result?.confirmationNumber).toBe("48293615");
      expect(result?.hotelChain).toBe("Marriott");
      expect(result?.subBrand).toBe("Tribute Portfolio");
      expect(result?.currency).toBe("SGD");
      // Email presents cost as "per night per room" — Claude returns nightlyRates, not pretaxCost
      expect(result?.nightlyRates?.[0].amount).toBe(235.0);
      expect(result?.pretaxCost).toBeNull();
      expect(result?.taxLines?.reduce((s, l) => s + l.amount, 0)).toBeCloseTo(46.77, 1);
      expect(result?.totalCost).toBe(281.77);
    });

    it("parses points booking with null costs", async () => {
      const result = await parseConfirmationEmail(
        fixture("marriott-confirmation-points"),
        marriottGuide
      );
      expect(result).not.toBeNull();
      expect(result?.bookingType).toBe("points");
      expect(result?.propertyName).toBe("Moxy Munich Ostbahnhof");
      expect(result?.checkIn).toBe("2025-09-11");
      expect(result?.checkOut).toBe("2025-09-16");
      expect(result?.numNights).toBe(5);
      expect(result?.confirmationNumber).toBe("61748392");
      expect(result?.hotelChain).toBe("Marriott");
      expect(result?.subBrand).toBe("Moxy");
      expect(result?.pointsRedeemed).toBe(100000);
      expect(result?.pretaxCost).toBeNull();
      expect(result?.totalCost).toBeNull();
    });

    it("parses cert-only booking with null costs", async () => {
      const result = await parseConfirmationEmail(
        fixture("marriott-confirmation-cert"),
        marriottGuide
      );
      expect(result).not.toBeNull();
      expect(result?.bookingType).toBe("cert");
      expect(result?.propertyName).toBe("Duxton Reserve Singapore, Autograph Collection");
      expect(result?.checkIn).toBe("2026-03-02");
      expect(result?.checkOut).toBe("2026-03-05");
      expect(result?.numNights).toBe(3);
      expect(result?.confirmationNumber).toBe("10000001");
      expect(result?.hotelChain).toBe("Marriott");
      expect(result?.subBrand).toBe("Autograph Collection");
      expect(result?.pointsRedeemed).toBeNull();
      expect(result?.certsRedeemed).toEqual([{ certType: "marriott_50k", count: 3 }]);
      expect(result?.pretaxCost).toBeNull();
      expect(result?.totalCost).toBeNull();
    });

    it("parses cert+points top-off booking with null costs", async () => {
      const result = await parseConfirmationEmail(
        fixture("marriott-confirmation-cert-and-points"),
        marriottGuide
      );
      expect(result).not.toBeNull();
      expect(result?.bookingType).toBe("cert");
      expect(result?.propertyName).toBe("Duxton Reserve Singapore, Autograph Collection");
      expect(result?.checkIn).toBe("2026-03-02");
      expect(result?.checkOut).toBe("2026-03-05");
      expect(result?.numNights).toBe(3);
      expect(result?.confirmationNumber).toBe("20000002");
      expect(result?.hotelChain).toBe("Marriott");
      expect(result?.subBrand).toBe("Autograph Collection");
      expect(result?.pointsRedeemed).toBe(25000);
      expect(result?.certsRedeemed).toEqual([{ certType: "marriott_50k", count: 3 }]);
      expect(result?.pretaxCost).toBeNull();
      expect(result?.totalCost).toBeNull();
    });
  });

  describe("IHG", () => {
    it("parses cash booking with MYR costs", async () => {
      const result = await parseConfirmationEmail(fixture("ihg-confirmation-cash"), ihgGuide);
      expect(result).not.toBeNull();
      expect(result?.bookingType).toBe("cash");
      expect(result?.propertyName).toBe("Holiday Inn Express Kuala Lumpur City Centre");
      expect(result?.checkIn).toBe("2026-03-06");
      expect(result?.checkOut).toBe("2026-03-07");
      expect(result?.numNights).toBe(1);
      expect(result?.confirmationNumber).toBe("92047183");
      expect(result?.hotelChain).toBe("IHG");
      expect(result?.subBrand).toBe("Holiday Inn Express");
      expect(result?.currency).toBe("MYR");
      // Email presents cost as "1 night stay" rate — Claude returns nightlyRates, not pretaxCost
      expect(result?.nightlyRates?.[0].amount).toBe(221.45);
      expect(result?.pretaxCost).toBeNull();
      expect(result?.taxLines?.reduce((s, l) => s + l.amount, 0)).toBeCloseTo(41.63, 1);
      expect(result?.totalCost).toBe(263.08);
    });

    it("parses points booking with null costs", async () => {
      const result = await parseConfirmationEmail(fixture("ihg-confirmation-points"), ihgGuide);
      expect(result).not.toBeNull();
      expect(result?.bookingType).toBe("points");
      expect(result?.propertyName).toBe("Crowne Plaza Changi Airport");
      expect(result?.checkIn).toBe("2026-06-17");
      expect(result?.checkOut).toBe("2026-06-18");
      expect(result?.numNights).toBe(1);
      expect(result?.confirmationNumber).toBe("37615824");
      expect(result?.hotelChain).toBe("IHG");
      expect(result?.subBrand).toBe("Crowne Plaza");
      expect(result?.pretaxCost).toBeNull();
      expect(result?.totalCost).toBeNull();
    });
  });

  describe("Accor", () => {
    it("parses cash booking with THB rates and free-night benefit", async () => {
      const result = await parseConfirmationEmail(fixture("accor-confirmation-cash"), accorGuide);
      expect(result).not.toBeNull();
      expect(result?.bookingType).toBe("cash");
      expect(result?.propertyName).toBe("Novotel Bangkok Sukhumvit 20");
      expect(result?.checkIn).toBe("2025-10-19");
      expect(result?.checkOut).toBe("2025-10-26");
      expect(result?.numNights).toBe(7);
      expect(result?.confirmationNumber).toBe("NVKM3821");
      expect(result?.hotelChain).toBe("Accor");
      expect(result?.subBrand).toBe("Novotel");
      expect(result?.currency).toBe("THB");
      // Free-night benefit present → pretaxCost must be null (discount rule)
      expect(result?.pretaxCost).toBeNull();
      // 5 × 2689.60 (Oct 19–23), 1 × 0.00 free night (Oct 24), 1 × 2890.50 (Oct 25)
      expect(result?.nightlyRates).toHaveLength(7);
      expect(result?.nightlyRates?.[0].amount).toBe(2689.6);
      expect(result?.nightlyRates?.[1].amount).toBe(2689.6);
      expect(result?.nightlyRates?.[2].amount).toBe(2689.6);
      expect(result?.nightlyRates?.[3].amount).toBe(2689.6);
      expect(result?.nightlyRates?.[4].amount).toBe(2689.6);
      expect(result?.nightlyRates?.[5].amount).toBe(0);
      expect(result?.nightlyRates?.[6].amount).toBe(2890.5);
    });
  });

  describe("GHA", () => {
    it("parses cash booking with GHA Discovery chain and MYR costs", async () => {
      const result = await parseConfirmationEmail(fixture("gha-confirmation-cash"), ghaGuide);
      expect(result).not.toBeNull();
      expect(result?.bookingType).toBe("cash");
      expect(result?.propertyName).toBe("PARKROYAL COLLECTION Kuala Lumpur");
      expect(result?.checkIn).toBe("2026-03-24");
      expect(result?.checkOut).toBe("2026-03-26");
      expect(result?.numNights).toBe(2);
      expect(result?.confirmationNumber).toBe("8294SG047183");
      expect(result?.hotelChain).toBe("GHA Discovery");
      expect(result?.subBrand).toBe("PARKROYAL COLLECTION");
      expect(result?.currency).toBe("MYR");
      expect(result?.pretaxCost).toBe(1170.0);
      expect(result?.taxLines?.reduce((s, l) => s + l.amount, 0)).toBeCloseTo(93.6, 1);
      expect(result?.totalCost).toBe(1263.6);
    });
  });

  describe("Airbnb", () => {
    it("parses apartment booking with USD costs and Airbnb OTA", async () => {
      const result = await parseConfirmationEmail(fixture("airbnb-confirmation-cash"), airbnbGuide);
      expect(result).not.toBeNull();
      expect(result?.bookingType).toBe("cash");
      expect(result?.checkIn).toBe("2026-02-02");
      expect(result?.checkOut).toBe("2026-03-02");
      expect(result?.numNights).toBe(28);
      expect(result?.confirmationNumber).toBe("HMTX4KBR29");
      expect(result?.accommodationType).toBe("apartment");
      expect(result?.otaAgencyName).toBe("Airbnb");
      expect(result?.currency).toBe("USD");
      expect(result?.nightlyRates).toHaveLength(28);
      expect(result?.nightlyRates?.[0].amount).toBe(42.58);
      // taxLines = separate line items: Airbnb service fee + Taxes
      expect(result?.taxLines).not.toBeNull();
      expect(result?.taxLines!.length).toBeGreaterThanOrEqual(2); // service fee + taxes as separate lines
      expect(result?.taxLines!.reduce((s, l) => s + l.amount, 0)).toBeCloseTo(233.15, 1); // 165.84 + 67.31
      expect(result?.discounts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: "accommodation" }), // monthly stay discount
          expect.objectContaining({ type: "fee" }), // service fee savings
        ])
      );
      expect(result?.pretaxCost).toBeNull();
      expect(result?.totalCost).toBe(1213.1);
    });

    it("parses apartment booking with special offer and monthly stay savings discounts", async () => {
      const result = await parseConfirmationEmail(
        fixture("airbnb-confirmation-cash-2"),
        airbnbGuide
      );
      expect(result).not.toBeNull();
      expect(result?.bookingType).toBe("cash");
      expect(result?.checkIn).toBe("2026-05-14");
      expect(result?.checkOut).toBe("2026-06-11");
      expect(result?.numNights).toBe(28);
      expect(result?.confirmationNumber).toBe("HMFAKE5678");
      expect(result?.accommodationType).toBe("apartment");
      expect(result?.otaAgencyName).toBe("Airbnb");
      expect(result?.currency).toBe("USD");
      expect(result?.nightlyRates).toHaveLength(28);
      expect(result?.nightlyRates?.[0].amount).toBe(44.56);
      // taxLines = individual tax/fee line items before discounts
      expect(result?.taxLines?.reduce((s, l) => s + l.amount, 0)).toBeCloseTo(69.17, 1);
      expect(result?.discounts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            label: expect.stringMatching(/special offer/i),
            amount: 247.0,
            type: "accommodation",
          }),
          expect.objectContaining({
            label: expect.stringMatching(/monthly stay savings/i),
            amount: 31.02,
            type: "fee",
          }),
        ])
      );
      expect(result?.pretaxCost).toBeNull();
      expect(result?.totalCost).toBe(1038.78);
    });
  });

  describe("Booking.com", () => {
    it("parses apartment booking in NZD with Booking.com OTA", async () => {
      const result = await parseConfirmationEmail(
        fixture("bookingcom-confirmation-cash"),
        bookingcomGuide
      );
      expect(result).not.toBeNull();
      expect(result?.bookingType).toBe("cash");
      expect(result?.propertyName).toBe(
        "135 Hallenstein Street 26A, Queenstown, 9300, New Zealand"
      );
      expect(result?.checkIn).toBe("2026-09-01");
      expect(result?.checkOut).toBe("2026-09-29");
      expect(result?.numNights).toBe(28);
      expect(result?.confirmationNumber).toMatch(/^612384759/);
      expect(result?.accommodationType).toBe("apartment");
      expect(result?.otaAgencyName).toBe("Booking.com");
      expect(result?.currency).toBe("NZD");
      expect(result?.pretaxCost).toBe(5842.09);
      expect(result?.taxLines?.reduce((s, l) => s + l.amount, 0)).toBeCloseTo(876.31, 1);
      expect(result?.totalCost).toBe(6718.4);
    });
  });

  describe("Amex", () => {
    it("parses FHR booking with USD costs and AMEX FHR OTA", async () => {
      const result = await parseConfirmationEmail(fixture("amex-fhr-confirmation-cash"), amexGuide);
      expect(result).not.toBeNull();
      expect(result?.bookingType).toBe("cash");
      expect(result?.propertyName).toBe("Mandarin Oriental, Kuala Lumpur");
      expect(result?.checkIn).toBe("2025-04-08");
      expect(result?.checkOut).toBe("2025-04-09");
      expect(result?.numNights).toBe(1);
      expect(result?.confirmationNumber).toBe("1234567890123");
      expect(result?.otaAgencyName).toBe("AMEX FHR");
      expect(result?.currency).toBe("USD");
      expect(result?.pretaxCost).toBe(286.83);
      expect(result?.taxLines?.reduce((s, l) => s + l.amount, 0)).toBeCloseTo(25.19, 1);
      expect(result?.totalCost).toBe(312.02);
    });

    it("parses THC booking with USD costs and AMEX THC OTA", async () => {
      const result = await parseConfirmationEmail(fixture("amex-thc-confirmation-cash"), amexGuide);
      expect(result).not.toBeNull();
      expect(result?.bookingType).toBe("cash");
      expect(result?.propertyName).toMatch(/Mondrian Hong Kong/i);
      expect(result?.checkIn).toBe("2026-01-24");
      expect(result?.checkOut).toBe("2026-01-26");
      expect(result?.numNights).toBe(2);
      expect(result?.confirmationNumber).toBe("9876543219087");
      expect(result?.otaAgencyName).toBe("AMEX THC");
      expect(result?.currency).toBe("USD");
      expect(result?.pretaxCost).toBe(520.92);
      expect(result?.taxLines?.reduce((s, l) => s + l.amount, 0)).toBeCloseTo(67.72, 1);
      expect(result?.totalCost).toBe(588.64);
    });
  });

  describe("Chase", () => {
    it("parses The Edit booking with USD total and Chase The Edit OTA", async () => {
      const result = await parseConfirmationEmail(
        fixture("chase-the-edit-confirmation-cash"),
        chaseGuide
      );
      expect(result).not.toBeNull();
      expect(result?.bookingType).toBe("cash");
      expect(result?.propertyName).toBe("Mondrian Seoul Itaewon");
      expect(result?.checkIn).toBe("2026-01-12");
      expect(result?.checkOut).toBe("2026-01-14");
      expect(result?.numNights).toBe(2);
      expect(result?.confirmationNumber).toBe("A842BCB9317");
      expect(result?.otaAgencyName).toBe("Chase The Edit");
      expect(result?.currency).toBe("USD");
      // No pretax breakdown shown — only trip total
      expect(result?.pretaxCost).toBeNull();
      expect(result?.totalCost).toBe(318.77);
    });
  });
});
