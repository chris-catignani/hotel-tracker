import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { withRouteLogging } from "./route-logging";

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));
vi.mock("@/lib/logger", () => ({ logger: mockLogger }));

function makeRequest(method = "POST", url = "https://example.com/api/test") {
  return new NextRequest(url, { method });
}

describe("withRouteLogging", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("logs request entry with method and pathname", async () => {
    const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
    const wrapped = withRouteLogging("my-route", handler);

    await wrapped(makeRequest("POST", "https://example.com/api/my-route"));

    expect(mockLogger.info).toHaveBeenCalledWith("my-route: request", {
      method: "POST",
      pathname: "/api/my-route",
    });
  });

  it("logs completion with status and durationMs", async () => {
    const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }, { status: 200 }));
    const wrapped = withRouteLogging("my-route", handler);

    await wrapped(makeRequest());

    expect(mockLogger.info).toHaveBeenCalledWith(
      "my-route: completed",
      expect.objectContaining({ status: 200, durationMs: expect.any(Number) })
    );
  });

  it("logs error and re-throws on unhandled exception", async () => {
    const err = new Error("handler blew up");
    const handler = vi.fn().mockRejectedValue(err);
    const wrapped = withRouteLogging("my-route", handler);

    await expect(wrapped(makeRequest())).rejects.toThrow("handler blew up");

    expect(mockLogger.error).toHaveBeenCalledWith(
      "my-route: failed",
      err,
      expect.objectContaining({ durationMs: expect.any(Number) })
    );
  });

  it("calls the original handler with all arguments", async () => {
    const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
    const wrapped = withRouteLogging("my-route", handler);
    const req = makeRequest();
    const extra = { params: { id: "123" } };

    await wrapped(req, extra);

    expect(handler).toHaveBeenCalledWith(req, extra);
  });
});
