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

const mockSvixVerify = vi.hoisted(() => vi.fn());
vi.mock("svix", () => ({
  Webhook: class {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    verify(...args: any[]) {
      return mockSvixVerify(...args);
    }
  },
}));

process.env.RESEND_WEBHOOK_SIGNING_SECRET = "whsec_test";
process.env.RESEND_INBOUND_EMAIL = "bookings@example.com";
process.env.RESEND_API_KEY = "re_test";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function mockEmailBody(html: string) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ html, text: null }),
  });
}

function makePayload(data: Record<string, unknown>, { to = ["bookings@example.com"] } = {}) {
  return { type: "email.received", data: { to, ...data } };
}

function makeRequest(
  data: Record<string, unknown>,
  { validSignature = true, to = ["bookings@example.com"] } = {}
) {
  const payload = makePayload(data, { to });
  if (validSignature) {
    mockSvixVerify.mockReturnValueOnce(payload);
  } else {
    mockSvixVerify.mockImplementationOnce(() => {
      throw new Error("invalid signature");
    });
  }
  return new NextRequest("http://localhost/api/inbound-email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "svix-id": "msg_123",
      "svix-timestamp": "1234567890",
      "svix-signature": "v1,test",
    },
    body: JSON.stringify(payload),
  });
}

describe("POST /api/inbound-email", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 500 when required env vars are missing", async () => {
    const original = process.env.RESEND_WEBHOOK_SIGNING_SECRET;
    delete process.env.RESEND_WEBHOOK_SIGNING_SECRET;
    const req = new NextRequest("http://localhost/api/inbound-email", {
      method: "POST",
      body: "{}",
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
    process.env.RESEND_WEBHOOK_SIGNING_SECRET = original;
  });

  it("silently discards email not addressed to the inbound address", async () => {
    const res = await POST(
      makeRequest({ from: "chris@gmail.com", html: "" }, { to: ["other@example.com"] })
    );
    expect(res.status).toBe(200);
    expect(mockUserFindFirst).not.toHaveBeenCalled();
  });

  it("returns 401 when svix signature verification fails", async () => {
    const res = await POST(makeRequest({}, { validSignature: false }));
    expect(res.status).toBe(401);
  });

  it("fetches full email body from Resend API using email_id", async () => {
    mockUserFindFirst.mockResolvedValue(null);
    mockEmailBody("");
    const res = await POST(makeRequest({ from: "chris@gmail.com", email_id: "msg-abc123" }));
    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.resend.com/emails/receiving/msg-abc123",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer re_test" }),
      })
    );
  });

  it("returns 200 and discards if user not found", async () => {
    mockUserFindFirst.mockResolvedValue(null);
    mockEmailBody("");
    const res = await POST(makeRequest({ from: "unknown@gmail.com", email_id: "msg-1" }));
    expect(res.status).toBe(200);
    const { sendIngestionError } = await import("@/lib/email");
    expect(sendIngestionError).not.toHaveBeenCalled();
  });

  it("sends error email if parsing returns null", async () => {
    mockUserFindFirst.mockResolvedValue({ id: "u1", email: "chris@gmail.com" });
    mockEmailBody("<p>email</p>");
    const { parseConfirmationEmail } = await import("@/lib/email-ingestion/email-parser");
    vi.mocked(parseConfirmationEmail).mockResolvedValue(null);
    const { sendIngestionError } = await import("@/lib/email");

    const res = await POST(makeRequest({ from: "chris@gmail.com", email_id: "msg-1" }));
    expect(res.status).toBe(200);
    expect(sendIngestionError).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "chris@gmail.com",
        reason: expect.stringContaining("couldn't recognise"),
      })
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
      hotelChain: "Hyatt",
      subBrand: "Hyatt Regency",
      currency: "USD",
      nightlyRates: null,
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

    mockEmailBody("<p>email</p>");
    const res = await POST(makeRequest({ from: "chris@gmail.com", email_id: "msg-1" }));
    expect(res.status).toBe(200);
    expect(sendIngestionConfirmation).not.toHaveBeenCalled();
    const { sendIngestionError } = await import("@/lib/email");
    expect(sendIngestionError).not.toHaveBeenCalled();
  });

  it("creates booking and sends confirmation on success", async () => {
    mockUserFindFirst.mockResolvedValue({ id: "u1", email: "chris@gmail.com" });
    mockEmailBody("<p>email</p>");
    const { parseConfirmationEmail } = await import("@/lib/email-ingestion/email-parser");
    vi.mocked(parseConfirmationEmail).mockResolvedValue({
      propertyName: "Hyatt Regency SLC",
      checkIn: "2027-01-14",
      checkOut: "2027-01-18",
      numNights: 4,
      bookingType: "cash",
      confirmationNumber: "12345",
      hotelChain: "Hyatt",
      subBrand: "Hyatt Regency",
      currency: "USD",
      nightlyRates: null,
      pretaxCost: 500,
      taxAmount: 80,
      totalCost: 580,
      pointsRedeemed: null,
    });
    const { ingestBookingFromEmail } = await import("@/lib/email-ingestion/ingest-booking");
    vi.mocked(ingestBookingFromEmail).mockResolvedValue({ bookingId: "bk-1", duplicate: false });
    const { sendIngestionConfirmation } = await import("@/lib/email");

    const res = await POST(makeRequest({ from: "chris@gmail.com", email_id: "msg-1" }));
    expect(res.status).toBe(200);
    expect(sendIngestionConfirmation).toHaveBeenCalledWith(
      expect.objectContaining({ to: "chris@gmail.com", bookingId: "bk-1" })
    );
  });
});
