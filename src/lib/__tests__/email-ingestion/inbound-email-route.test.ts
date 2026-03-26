import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/inbound-email/route";
import { NextRequest } from "next/server";

vi.mock("@/lib/email-ingestion/email-parser", () => ({
  parseConfirmationEmail: vi.fn(),
}));
vi.mock("@/lib/email-ingestion/ingest-booking", () => ({
  ingestBookingFromEmail: vi.fn(),
}));
vi.mock("@/lib/email", () => ({
  sendIngestionConfirmation: vi.fn(),
  sendIngestionError: vi.fn(),
}));

const mockUserFindFirst = vi.hoisted(() => vi.fn());
vi.mock("@/lib/prisma", () => ({
  default: { user: { findFirst: mockUserFindFirst } },
}));

const SECRET = "test-secret";
process.env.INBOUND_EMAIL_WEBHOOK_SECRET = SECRET;

function makeRequest(body: object, secret = SECRET) {
  return new NextRequest("http://localhost/api/inbound-email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-webhook-secret": secret,
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/inbound-email", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 for invalid webhook secret", async () => {
    const res = await POST(makeRequest({}, "wrong-secret"));
    expect(res.status).toBe(401);
  });

  it("returns 200 and discards if user not found", async () => {
    mockUserFindFirst.mockResolvedValue(null);
    const res = await POST(makeRequest({ from: "unknown@gmail.com", html: "" }));
    expect(res.status).toBe(200);
    const { sendIngestionError } = await import("@/lib/email");
    expect(sendIngestionError).not.toHaveBeenCalled();
  });

  it("sends error email if parsing returns null", async () => {
    mockUserFindFirst.mockResolvedValue({ id: "u1", email: "chris@gmail.com" });
    const { parseConfirmationEmail } = await import("@/lib/email-ingestion/email-parser");
    vi.mocked(parseConfirmationEmail).mockResolvedValue(null);
    const { sendIngestionError } = await import("@/lib/email");

    // sender domain matches Hyatt guide — guide will be found, parse still fails
    const res = await POST(
      makeRequest({
        from: "chris@gmail.com",
        sender: "noreply@reservations.hyatt.com",
        html: "<p>email</p>",
      })
    );
    expect(res.status).toBe(200);
    expect(sendIngestionError).toHaveBeenCalledWith(
      expect.objectContaining({ to: "chris@gmail.com", reason: expect.stringContaining("Hyatt") })
    );
  });

  it("does not send confirmation email for duplicate booking", async () => {
    mockUserFindFirst.mockResolvedValue({ id: "u1", email: "chris@gmail.com" });
    const { parseConfirmationEmail } = await import("@/lib/email-ingestion/email-parser");
    vi.mocked(parseConfirmationEmail).mockResolvedValue({
      propertyName: "Hyatt Regency SLC",
      checkIn: "2027-01-14",
      checkOut: "2027-01-18",
      numNights: 4,
      bookingType: "cash",
      confirmationNumber: "12345",
      currency: "USD",
      pretaxCost: 500,
      taxAmount: 80,
      totalCost: 580,
      pointsRedeemed: null,
    });
    const { ingestBookingFromEmail } = await import("@/lib/email-ingestion/ingest-booking");
    vi.mocked(ingestBookingFromEmail).mockResolvedValue({
      bookingId: "bk-existing",
      duplicate: true,
    });
    const { sendIngestionConfirmation } = await import("@/lib/email");

    const res = await POST(
      makeRequest({
        from: "chris@gmail.com",
        sender: "noreply@reservations.hyatt.com",
        html: "<p>email</p>",
      })
    );
    expect(res.status).toBe(200);
    expect(sendIngestionConfirmation).not.toHaveBeenCalled();
    const { sendIngestionError } = await import("@/lib/email");
    expect(sendIngestionError).not.toHaveBeenCalled();
  });

  it("creates booking and sends confirmation on success", async () => {
    mockUserFindFirst.mockResolvedValue({ id: "u1", email: "chris@gmail.com" });
    const { parseConfirmationEmail } = await import("@/lib/email-ingestion/email-parser");
    vi.mocked(parseConfirmationEmail).mockResolvedValue({
      propertyName: "Hyatt Regency SLC",
      checkIn: "2027-01-14",
      checkOut: "2027-01-18",
      numNights: 4,
      bookingType: "cash",
      confirmationNumber: "12345",
      currency: "USD",
      pretaxCost: 500,
      taxAmount: 80,
      totalCost: 580,
      pointsRedeemed: null,
    });
    const { ingestBookingFromEmail } = await import("@/lib/email-ingestion/ingest-booking");
    vi.mocked(ingestBookingFromEmail).mockResolvedValue({ bookingId: "bk-1", duplicate: false });
    const { sendIngestionConfirmation } = await import("@/lib/email");

    const res = await POST(
      makeRequest({
        from: "chris@gmail.com",
        sender: "noreply@reservations.hyatt.com",
        html: "<p>email</p>",
      })
    );
    expect(res.status).toBe(200);
    expect(sendIngestionConfirmation).toHaveBeenCalledWith(
      expect.objectContaining({ to: "chris@gmail.com", bookingId: "bk-1" })
    );
  });
});
