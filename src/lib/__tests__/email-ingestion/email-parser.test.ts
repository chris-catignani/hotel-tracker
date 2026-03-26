import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { parseConfirmationEmail } from "@/lib/email-ingestion/email-parser";
import { hyattGuide } from "@/lib/email-ingestion/chain-guides/hyatt";

const mockCreate = vi.fn();

// Mock Anthropic SDK
vi.mock("@anthropic-ai/sdk", () => {
  const MockAnthropic = vi.fn(function () {
    return { messages: { create: mockCreate } };
  });
  return { default: MockAnthropic };
});

const fixture = (name: string) =>
  readFileSync(resolve(__dirname, "../../__tests__/fixtures/emails", name), "utf-8");

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
