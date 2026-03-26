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
import { parseConfirmationEmail, decodeEmailToText } from "@/lib/email-ingestion/email-parser";

// Easier accessor
const mockCreate = mocks.mockCreate;

const fixture = (name: string) => readFileSync(resolve(__dirname, "./fixtures", name), "utf-8");

describe("decodeEmailToText", () => {
  it("removes QP soft line breaks with CRLF (=\\r\\n)", () => {
    const input = "Hello=\r\nWorld";
    expect(decodeEmailToText(input)).toBe("HelloWorld");
  });

  it("removes QP soft line breaks with LF only (=\\n)", () => {
    const input = "Hello=\nWorld";
    expect(decodeEmailToText(input)).toBe("HelloWorld");
  });

  it("decodes QP hex-encoded bytes (=20 → space, =41 → A)", () => {
    expect(decodeEmailToText("Hello=20World")).toBe("Hello World");
    expect(decodeEmailToText("=41=42=43")).toBe("ABC");
    expect(decodeEmailToText("=48=65=6C=6C=6F")).toBe("Hello"); // 48=H, 65=e, 6C=l, 6C=l, 6F=o
  });

  it("strips <style> blocks including their contents", () => {
    const input = 'before<style type="text/css">body { color: red; }</style>after';
    expect(decodeEmailToText(input)).toBe("beforeafter");
  });

  it("strips <script> blocks including their contents", () => {
    const input = "before<script>alert('xss')</script>after";
    expect(decodeEmailToText(input)).toBe("beforeafter");
  });

  it("replaces HTML tags with a space", () => {
    const input = "<p>Hello</p><br/><span>World</span>";
    expect(decodeEmailToText(input)).toBe("Hello World");
    expect(decodeEmailToText("Hello<br>World")).toBe("Hello World");
  });

  it("decodes &nbsp; to space", () => {
    expect(decodeEmailToText("Hello&nbsp;World")).toBe("Hello World");
  });

  it("decodes &amp; to &", () => {
    expect(decodeEmailToText("Cats&amp;Dogs")).toBe("Cats&Dogs");
  });

  it("decodes &lt; to <", () => {
    expect(decodeEmailToText("1&lt;2")).toBe("1<2");
  });

  it("decodes &gt; to >", () => {
    expect(decodeEmailToText("2&gt;1")).toBe("2>1");
  });

  it("replaces &zwnj; with empty string", () => {
    expect(decodeEmailToText("Hello&zwnj;World")).toBe("HelloWorld");
  });

  it("collapses multiple consecutive whitespace to a single space", () => {
    expect(decodeEmailToText("Hello   World")).toBe("Hello World");
  });

  it("trims leading and trailing whitespace", () => {
    expect(decodeEmailToText("  Hello World  ")).toBe("Hello World");
  });
});

describe("parseConfirmationEmail", () => {
  beforeEach(() => {
    mockCreate.mockReset();
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
            confirmationNumber: "64167883",
            currency: "USD",
            pretaxCost: 591.04,
            taxAmount: 98.5,
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
      confirmationNumber: "64167883",
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
              taxAmount: 30,
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
            taxAmount: 30,
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
});
