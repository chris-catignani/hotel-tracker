import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { hyattGuide } from "@/lib/email-ingestion/chain-guides/hyatt";

// Store mock function in a way that's accessible before initialization
const mocks = { mockCreate: vi.fn() };

// Mock Anthropic SDK before importing the module that uses it
vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: class MockAnthropic {
      messages = {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        create: (...args: any[]) => mocks.mockCreate(...args),
      };
    },
  };
});

// Import after mocking
import { parseConfirmationEmail, matchSubBrand } from "@/lib/email-ingestion/email-parser";

// Easier accessor
const mockCreate = mocks.mockCreate;

const fixture = (name: string) => readFileSync(resolve(__dirname, "./fixtures", name), "utf-8");

describe("parseConfirmationEmail", () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  it.each([
    ["Terms and Conditions", "Amex-style heading"],
    ["Terms & conditions", "Chase-style heading"],
  ])("strips boilerplate legal section at '%s'", async (heading) => {
    mockCreate.mockResolvedValueOnce({ content: [{ type: "text", text: "{}" }] });
    const email = `Booking confirmed\n\nCheck-in: Jan 1\n\n${heading}\n\nAll products are subject to terms.`;
    await parseConfirmationEmail(email, null);
    const prompt = mockCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain("Booking confirmed");
    expect(prompt).not.toContain("All products are subject to terms");
  });

  it("Hyatt guide prompt instructs Claude to expand date-range nightly rate entries (inclusive end date)", async () => {
    mockCreate.mockResolvedValueOnce({ content: [{ type: "text", text: "{}" }] });
    await parseConfirmationEmail("raw email text", hyattGuide);
    const prompt = mockCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain("The end date is the last night (inclusive)");
    expect(prompt).toContain("never return nightlyRates: null when this section is present");
    expect(prompt).toContain("total number of nightlyRates entries must equal numNights");
  });

  it("calls Claude with decoded email text and chain guide notes", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            propertyName: "Hyatt Regency Salt Lake City",
            checkIn: "2027-01-14",
            checkOut: "2027-01-18",
            numNights: 4,
            bookingType: "cash",
            confirmationNumber: "73829461",
            currency: "USD",
            pretaxCost: 591.04,
            taxLines: [{ label: "Taxes", amount: 98.5 }],
            totalCost: 689.54,
            pointsRedeemed: null,
          }),
        },
      ],
    });

    const result = await parseConfirmationEmail(fixture("hyatt-confirmation-cash"), hyattGuide);

    expect(mockCreate).toHaveBeenCalledOnce();
    const callArg = mockCreate.mock.calls[0][0];
    expect(callArg.model).toBe("claude-haiku-4-5-20251001");
    expect(callArg.messages[0].content).toContain("Hyatt points redemptions are labelled");

    expect(result).toMatchObject({
      propertyName: "Hyatt Regency Salt Lake City",
      checkIn: "2027-01-14",
      checkOut: "2027-01-18",
      numNights: 4,
      bookingType: "cash",
      confirmationNumber: "73829461",
    });
  });

  it("returns null when Claude response is not valid JSON", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: "Sorry, I could not parse this email." }],
    });

    const result = await parseConfirmationEmail(fixture("hyatt-confirmation-cash"), null);
    expect(result).toBeNull();
  });

  it("returns null when required fields are missing from Claude response", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: "text",
          text: JSON.stringify({ propertyName: "Some Hotel", bookingType: "cash" }),
        },
      ],
    });

    const result = await parseConfirmationEmail(fixture("marriott-confirmation-cash"), null);
    expect(result).toBeNull();
  });

  it("strips markdown fences from Claude response", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: "text",
          text:
            "```json\n" +
            JSON.stringify({
              propertyName: "Test Hotel",
              checkIn: "2026-05-01",
              checkOut: "2026-05-03",
              numNights: 2,
              bookingType: "cash",
              confirmationNumber: null,
              currency: "USD",
              pretaxCost: 200,
              taxLines: [{ label: "Taxes", amount: 30 }],
              totalCost: 230,
              pointsRedeemed: null,
            }) +
            "\n```",
        },
      ],
    });

    const result = await parseConfirmationEmail("raw email text", null);
    expect(result).not.toBeNull();
    expect(result?.propertyName).toBe("Test Hotel");
  });

  it("returns null when Claude API throws", async () => {
    mockCreate.mockRejectedValueOnce(new Error("network error"));
    const result = await parseConfirmationEmail("raw email text", null);
    expect(result).toBeNull();
  });

  it("uses generic prompt when no chain guide is provided", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            propertyName: "Some Hotel",
            checkIn: "2026-05-01",
            checkOut: "2026-05-03",
            numNights: 2,
            bookingType: "cash",
            confirmationNumber: null,
            currency: "USD",
            pretaxCost: 200,
            taxLines: [{ label: "Taxes", amount: 30 }],
            totalCost: 230,
            pointsRedeemed: null,
          }),
        },
      ],
    });

    const result = await parseConfirmationEmail("raw email text", null);
    expect(result).not.toBeNull();
    expect(mockCreate.mock.calls[0][0].messages[0].content).not.toContain("Chain-specific notes");
  });

  it("passes through accommodationType from Claude response", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            propertyName: "Some Apartment",
            checkIn: "2026-09-01",
            checkOut: "2026-09-29",
            numNights: 28,
            bookingType: "cash",
            confirmationNumber: "ABC123",
            hotelChain: null,
            subBrand: null,
            accommodationType: "apartment",
            currency: "NZD",
            nightlyRates: null,
            pretaxCost: 240.0,
            taxLines: [{ label: "Taxes", amount: 36.0 }],
            totalCost: 276.0,
            pointsRedeemed: null,
          }),
        },
      ],
    });

    const result = await parseConfirmationEmail("raw email text", null);
    expect(result?.accommodationType).toBe("apartment");
  });

  it("prompt instructs Claude to extract accommodationType", async () => {
    mockCreate.mockResolvedValueOnce({ content: [{ type: "text", text: "{}" }] });
    await parseConfirmationEmail("raw email text", null);
    const prompt = mockCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain("accommodationType");
  });

  it("passes through otaAgencyName from Claude response", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            propertyName: "Kimpton Margot Sydney",
            checkIn: "2026-10-25",
            checkOut: "2026-10-27",
            numNights: 2,
            bookingType: "cash",
            confirmationNumber: "ABC123",
            hotelChain: "Kimpton",
            subBrand: "Kimpton",
            accommodationType: "hotel",
            otaAgencyName: "AMEX THC",
            currency: "USD",
            nightlyRates: null,
            pretaxCost: 520.34,
            taxLines: [{ label: "Taxes", amount: 52.03 }],
            totalCost: 572.37,
            pointsRedeemed: null,
          }),
        },
      ],
    });

    const result = await parseConfirmationEmail("raw email text", null);
    expect(result?.otaAgencyName).toBe("AMEX THC");
  });

  it("prompt instructs Claude to extract otaAgencyName", async () => {
    mockCreate.mockResolvedValueOnce({ content: [{ type: "text", text: "{}" }] });
    await parseConfirmationEmail("raw email text", null);
    const prompt = mockCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain("otaAgencyName");
  });

  it("passes through hotelChain and subBrand from Claude response", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            propertyName: "Hyatt Place Salt Lake City",
            checkIn: "2027-01-19",
            checkOut: "2027-01-22",
            numNights: 3,
            bookingType: "points",
            confirmationNumber: "12345",
            hotelChain: "Hyatt",
            subBrand: "Hyatt Place",
            currency: null,
            nightlyRates: null,
            pretaxCost: null,
            taxLines: null,
            totalCost: null,
            pointsRedeemed: 25000,
          }),
        },
      ],
    });

    const result = await parseConfirmationEmail("raw email text", null);
    expect(result?.hotelChain).toBe("Hyatt");
    expect(result?.subBrand).toBe("Hyatt Place");
  });

  it("passes through nightlyRates from Claude response", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            propertyName: "Hyatt Regency Salt Lake City",
            checkIn: "2027-01-14",
            checkOut: "2027-01-18",
            numNights: 4,
            bookingType: "cash",
            confirmationNumber: "73829461",
            hotelChain: "Hyatt",
            subBrand: "Hyatt Regency",
            currency: "USD",
            nightlyRates: [
              { amount: 160.72 },
              { amount: 142.1 },
              { amount: 142.1 },
              { amount: 142.1 },
            ],
            pretaxCost: null,
            taxLines: null,
            totalCost: 687.02,
            pointsRedeemed: null,
          }),
        },
      ],
    });

    const result = await parseConfirmationEmail("raw email text", null);
    expect(result?.nightlyRates).toEqual([
      { amount: 160.72 },
      { amount: 142.1 },
      { amount: 142.1 },
      { amount: 142.1 },
    ]);
    expect(result?.pretaxCost).toBeNull();
  });

  it("prompt instructs Claude to use nightlyRates instead of computing pretaxCost", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: "{}" }],
    });
    await parseConfirmationEmail("raw email text", null);
    const prompt = mockCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain("nightlyRates");
    expect(prompt).toContain("Never compute sums yourself");
  });

  it("prompt instructs Claude to populate taxLines with individual tax/fee line items", async () => {
    mockCreate.mockResolvedValueOnce({ content: [{ type: "text", text: "{}" }] });
    await parseConfirmationEmail("raw email text", null);
    const prompt = mockCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain("taxLines");
    expect(prompt).toContain("positive");
  });

  it("prompt instructs Claude to extract discounts with label, amount, and type", async () => {
    mockCreate.mockResolvedValueOnce({ content: [{ type: "text", text: "{}" }] });
    await parseConfirmationEmail("raw email text", null);
    const prompt = mockCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain("discounts");
    expect(prompt).toContain("accommodation");
  });

  it("passes through discounts from Claude response", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            propertyName: "Test Apartment",
            checkIn: "2026-05-14",
            checkOut: "2026-06-11",
            numNights: 28,
            bookingType: "cash",
            confirmationNumber: "HMFAKE5678",
            hotelChain: null,
            subBrand: null,
            accommodationType: "apartment",
            otaAgencyName: "Airbnb",
            currency: "USD",
            nightlyRates: [{ amount: 44.56 }],
            pretaxCost: null,
            taxLines: [{ label: "Taxes and fees", amount: 69.17 }],
            discounts: [
              { label: "Special offer", amount: 247.0, type: "accommodation" },
              { label: "Airbnb monthly stay savings", amount: 31.02, type: "fee" },
            ],
            totalCost: 1038.78,
            pointsRedeemed: null,
            certsRedeemed: null,
          }),
        },
      ],
    });

    const result = await parseConfirmationEmail("raw email text", null);
    expect(result?.discounts).toEqual([
      { label: "Special offer", amount: 247.0, type: "accommodation" },
      { label: "Airbnb monthly stay savings", amount: 31.02, type: "fee" },
    ]);
  });

  it("logs a warning when parsed totals do not balance within tolerance", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            propertyName: "Test Apartment",
            checkIn: "2026-05-14",
            checkOut: "2026-06-11",
            numNights: 28,
            bookingType: "cash",
            confirmationNumber: "HMFAKE5678",
            hotelChain: null,
            subBrand: null,
            accommodationType: "apartment",
            otaAgencyName: "Airbnb",
            currency: "USD",
            nightlyRates: [{ amount: 44.56 }],
            pretaxCost: null,
            taxLines: [{ label: "Taxes and fees", amount: 99.99 }], // deliberately wrong — won't balance
            discounts: [
              { label: "Special offer", amount: 247.0, type: "accommodation" },
              { label: "Airbnb monthly stay savings", amount: 31.02, type: "fee" },
            ],
            totalCost: 1038.78,
            pointsRedeemed: null,
            certsRedeemed: null,
          }),
        },
      ],
    });

    await parseConfirmationEmail("raw email text", null);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("balance check failed"));
    warnSpy.mockRestore();
  });
});

describe("matchSubBrand", () => {
  beforeEach(() => mockCreate.mockReset());

  it("returns the exact candidate when Claude picks a match", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: "Hyatt Place" }],
    });
    const result = await matchSubBrand("Hyatt Place Hotels and Resorts", [
      "Park Hyatt",
      "Hyatt Place",
      "Hyatt Regency",
    ]);
    expect(result).toBe("Hyatt Place");
  });

  it("returns the exact candidate when Claude returns a quoted string", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: '"Hyatt Place"' }],
    });
    const result = await matchSubBrand("Hyatt Place Hotels and Resorts", [
      "Park Hyatt",
      "Hyatt Place",
    ]);
    expect(result).toBe("Hyatt Place");
  });

  it("returns null when Claude returns a value not in the candidate list", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: "Unknown Brand" }],
    });
    const result = await matchSubBrand("some hotel", ["Park Hyatt", "Hyatt Place"]);
    expect(result).toBeNull();
  });

  it("returns null when Claude returns null", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: "null" }],
    });
    const result = await matchSubBrand("Best Western", ["Park Hyatt", "Hyatt Place"]);
    expect(result).toBeNull();
  });

  it("returns null when candidates list is empty", async () => {
    const result = await matchSubBrand("Hyatt Place", []);
    expect(mockCreate).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it("returns null when Claude API throws", async () => {
    mockCreate.mockRejectedValueOnce(new Error("network error"));
    const result = await matchSubBrand("Hyatt Place", ["Park Hyatt", "Hyatt Place"]);
    expect(result).toBeNull();
  });
});
