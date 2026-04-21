import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from "vitest";
import { GET } from "@/app/api/cron/refresh-exchange-rates/route";
import { refreshAllExchangeRates, refreshPointTypeUsdValues } from "@/services/exchange-rate";
import { finalizeCheckedInBookings } from "@/services/booking-enrichment";
import { NextRequest } from "next/server";

vi.mock("@/services/exchange-rate", () => ({
  refreshAllExchangeRates: vi.fn(),
  refreshPointTypeUsdValues: vi.fn(),
}));
vi.mock("@/services/booking-enrichment", () => ({
  finalizeCheckedInBookings: vi.fn(),
}));
vi.mock("@/lib/observability", () => ({
  withObservability: (handler: unknown) => handler,
}));
vi.mock("next-axiom", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  Logger: class {
    log = vi.fn();
  },
}));

const mockLoggerError = vi.hoisted(() => vi.fn());
const mockLoggerWarn = vi.hoisted(() => vi.fn());
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: mockLoggerWarn, error: mockLoggerError },
}));

function makeRequest() {
  return new NextRequest("http://localhost/api/cron/refresh-exchange-rates", {
    headers: { Authorization: `Bearer test-secret` },
  });
}

describe("GET /api/cron/refresh-exchange-rates", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    process.env.CRON_SECRET = "test-secret";
    (refreshAllExchangeRates as Mock).mockResolvedValue(["USD=>OK"]);
    (finalizeCheckedInBookings as Mock).mockResolvedValue(["booking-1"]);
    (refreshPointTypeUsdValues as Mock).mockResolvedValue({
      pointTypesUpdated: ["IHG=>OK"],
      bookingsReevaluated: 2,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    delete process.env.CRON_SECRET;
  });

  it("returns 401 when Authorization header is missing", async () => {
    const req = new NextRequest("http://localhost/api/cron/refresh-exchange-rates");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns 401 when Authorization header is wrong", async () => {
    const req = new NextRequest("http://localhost/api/cron/refresh-exchange-rates", {
      headers: { Authorization: "Bearer wrong-secret" },
    });
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns 200 and aggregated results on success", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.bookingsLocked).toBe(1);
    expect(body.ratesUpdated).toEqual(["USD=>OK"]);
    expect(body.pointTypesRefreshed).toEqual(["IHG=>OK"]);
    expect(body.bookingsReevaluated).toBe(2);
  });

  describe("retry behavior", () => {
    it("retries finalizeCheckedInBookings on transient failure and succeeds", async () => {
      const error = new Error("DB unavailable");
      (finalizeCheckedInBookings as Mock)
        .mockRejectedValueOnce(error)
        .mockResolvedValue(["booking-1"]);

      const promise = GET(makeRequest());
      await vi.runAllTimersAsync();
      const res = await promise;

      expect(res.status).toBe(200);
      expect(finalizeCheckedInBookings).toHaveBeenCalledTimes(2);
      expect(mockLoggerWarn).toHaveBeenCalledWith("Retrying after transient failure", {
        context: "FINALIZE_BOOKINGS",
        attempt: 1,
        maxAttempts: 3,
        error: error.message,
      });
      expect(mockLoggerError).not.toHaveBeenCalled();
    });

    it("retries refreshAllExchangeRates on transient failure and succeeds", async () => {
      (refreshAllExchangeRates as Mock)
        .mockRejectedValueOnce(new Error("DB unavailable"))
        .mockResolvedValue(["USD=>OK"]);

      const promise = GET(makeRequest());
      await vi.runAllTimersAsync();
      const res = await promise;

      expect(res.status).toBe(200);
      expect(refreshAllExchangeRates).toHaveBeenCalledTimes(2);
    });

    it("retries up to 3 times before giving up", async () => {
      const error = new Error("DB unavailable");
      (finalizeCheckedInBookings as Mock).mockRejectedValue(error);

      const promise = GET(makeRequest());
      await vi.runAllTimersAsync();
      const res = await promise;

      expect(res.status).toBe(207); // partial failure — other operations still ran
      expect(finalizeCheckedInBookings).toHaveBeenCalledTimes(3);
      expect(mockLoggerError).toHaveBeenCalledWith(
        "Cron job failed during booking finalization",
        error,
        { context: "FINALIZE_BOOKINGS" }
      );
    });
  });

  describe("partial failure resilience", () => {
    it("returns 207 and success:false when finalizeCheckedInBookings fails after all retries", async () => {
      (finalizeCheckedInBookings as Mock).mockRejectedValue(new Error("DB down"));

      const promise = GET(makeRequest());
      await vi.runAllTimersAsync();
      const res = await promise;

      expect(res.status).toBe(207);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.bookingsLocked).toBe(0);
    });

    it("returns 207 and success:false when refreshAllExchangeRates fails after all retries", async () => {
      (refreshAllExchangeRates as Mock).mockRejectedValue(new Error("API down"));

      const promise = GET(makeRequest());
      await vi.runAllTimersAsync();
      const res = await promise;

      expect(res.status).toBe(207);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.ratesUpdated).toEqual(expect.arrayContaining(["BATCH_FETCH=>ERROR: API down"]));
    });

    it("returns 207 and success:false when refreshPointTypeUsdValues fails after all retries", async () => {
      (refreshPointTypeUsdValues as Mock).mockRejectedValue(new Error("DB down"));

      const promise = GET(makeRequest());
      await vi.runAllTimersAsync();
      const res = await promise;

      expect(res.status).toBe(207);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.pointTypesRefreshed).toEqual(
        expect.arrayContaining(["POINT_TYPE_REFRESH=>ERROR"])
      );
    });
  });
});
