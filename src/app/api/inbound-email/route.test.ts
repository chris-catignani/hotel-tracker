import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { POST } from "@/app/api/inbound-email/route";
import { parseConfirmationEmail } from "@/lib/email-ingestion/email-parser";
import { ingestBookingFromEmail } from "@/services/email-ingestion/ingest-booking";
import { NextRequest } from "next/server";

vi.mock("@/lib/email-ingestion/email-parser", () => ({
  parseConfirmationEmail: vi.fn(),
}));
vi.mock("@/services/email-ingestion/ingest-booking", () => ({
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

// Strip wrappers so POST is the bare handler in tests
vi.mock("next-axiom", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  Logger: class {
    log = vi.fn();
  },
}));
vi.mock("@/lib/observability", () => ({
  withObservability: (handler: unknown) => handler,
}));

const mockLoggerInfo = vi.hoisted(() => vi.fn());
const mockLoggerWarn = vi.hoisted(() => vi.fn());
const mockLoggerError = vi.hoisted(() => vi.fn());
vi.mock("@/lib/logger", () => ({
  logger: { info: mockLoggerInfo, warn: mockLoggerWarn, error: mockLoggerError },
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
  return new NextRequest("https://example.com/api/inbound-email", {
    method: "POST",
    body: JSON.stringify(payload),
    headers: {
      "svix-id": "test-id",
      "svix-timestamp": "123456",
      "svix-signature": "v1,test-sig",
    },
  });
}

describe("POST /api/inbound-email", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 for invalid signature", async () => {
    const req = makeRequest(
      { from: "user@example.com", email_id: "e1" },
      { validSignature: false }
    );
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 200 and discards email addressed to wrong recipient", async () => {
    const req = makeRequest(
      { from: "user@example.com", email_id: "e1" },
      { to: ["other@example.com"] }
    );
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockUserFindFirst).not.toHaveBeenCalled();
  });

  it("returns 200 and discards email when user not found, logs outcome: user_not_found", async () => {
    mockSvixVerify.mockReturnValueOnce(
      makePayload({ from: "unknown@example.com", email_id: "e1" })
    );
    mockEmailBody("<html>booking</html>");
    mockUserFindFirst.mockResolvedValueOnce(null);

    const req = makeRequest({ from: "unknown@example.com", email_id: "e1" });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(mockLoggerInfo).toHaveBeenCalledWith(
      "inbound-email:discarded",
      expect.objectContaining({ reason: "user_not_found", resendEmailId: "e1" })
    );
  });

  it("detects chain guide from email body and passes it to parseConfirmationEmail", async () => {
    mockSvixVerify.mockReturnValueOnce(makePayload({ from: "user@example.com", email_id: "e1" }));
    // Email body contains hyatt.com — detectChainGuideFromContent should return the Hyatt guide
    mockEmailBody("<html>Book at https://www.hyatt.com/hotel/example</html>");
    mockUserFindFirst.mockResolvedValueOnce({ id: "u1", email: "user@example.com" });
    (parseConfirmationEmail as Mock).mockResolvedValueOnce(null);

    const req = makeRequest({ from: "user@example.com", email_id: "e1" });
    await POST(req);

    const [, guideArg] = (parseConfirmationEmail as Mock).mock.calls[0];
    expect(guideArg).not.toBeNull();
    expect(guideArg?.chainName).toBe("Hyatt");
  });

  it("returns 200 and sends error email when parse fails, logs outcome: parse_failed", async () => {
    mockSvixVerify.mockReturnValueOnce(makePayload({ from: "user@example.com", email_id: "e1" }));
    mockEmailBody("<html>junk</html>");
    mockUserFindFirst.mockResolvedValueOnce({ id: "u1", email: "user@example.com" });
    (parseConfirmationEmail as Mock).mockResolvedValueOnce(null);

    const req = makeRequest({ from: "user@example.com", email_id: "e1" });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      "inbound-email:parse_failed",
      expect.objectContaining({ userId: "u1", resendEmailId: "e1" })
    );
  });

  it("logs outcome: duplicate when booking already exists", async () => {
    mockSvixVerify.mockReturnValueOnce(makePayload({ from: "user@example.com", email_id: "e1" }));
    mockEmailBody("<html>booking</html>");
    mockUserFindFirst.mockResolvedValueOnce({ id: "u1", email: "user@example.com" });
    (parseConfirmationEmail as Mock).mockResolvedValueOnce({
      propertyName: "Grand Hyatt",
      checkIn: "2026-04-01",
      checkOut: "2026-04-03",
      confirmationNumber: "ABC123",
    });
    (ingestBookingFromEmail as Mock).mockResolvedValueOnce({ bookingId: "b1", duplicate: true });

    const req = makeRequest({ from: "user@example.com", email_id: "e1" });
    await POST(req);

    expect(mockLoggerInfo).toHaveBeenCalledWith(
      "inbound-email:duplicate",
      expect.objectContaining({
        bookingId: "b1",
        confirmationNumber: "ABC123",
        userId: "u1",
        resendEmailId: "e1",
      })
    );
  });

  it("logs outcome: success when booking is created", async () => {
    mockSvixVerify.mockReturnValueOnce(makePayload({ from: "user@example.com", email_id: "e1" }));
    mockEmailBody("<html>booking</html>");
    mockUserFindFirst.mockResolvedValueOnce({ id: "u1", email: "user@example.com" });
    (parseConfirmationEmail as Mock).mockResolvedValueOnce({
      propertyName: "Grand Hyatt",
      checkIn: "2026-04-01",
      checkOut: "2026-04-03",
      confirmationNumber: "ABC123",
    });
    (ingestBookingFromEmail as Mock).mockResolvedValueOnce({ bookingId: "b1", duplicate: false });

    const req = makeRequest({ from: "user@example.com", email_id: "e1" });
    await POST(req);

    expect(mockLoggerInfo).toHaveBeenCalledWith(
      "inbound-email:booking_created",
      expect.objectContaining({
        bookingId: "b1",
        property: "Grand Hyatt",
        checkIn: "2026-04-01",
        userId: "u1",
        resendEmailId: "e1",
      })
    );
  });

  it("returns 500 for transient Resend API errors (allow retry)", async () => {
    mockSvixVerify.mockReturnValueOnce(makePayload({ from: "user@example.com", email_id: "e1" }));
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });

    const req = makeRequest({ from: "user@example.com", email_id: "e1" });
    const res = await POST(req);
    expect(res.status).toBe(500);
  });
});
