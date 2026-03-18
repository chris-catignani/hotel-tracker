import { describe, it, expect, vi, afterEach } from "vitest";
import {
  timeAgo,
  formatDuration,
  getWorkflowStatus,
  isExchangeRateStale,
  isPriceWatchStale,
  STALE_EXCHANGE_RATE_HOURS,
  STALE_PRICE_WATCH_HOURS,
  type WorkflowRun,
} from "./health-utils";

const NOW = new Date("2026-01-15T12:00:00Z").getTime();

function makeRun(overrides: Partial<WorkflowRun> = {}): WorkflowRun {
  return {
    status: "completed",
    conclusion: "success",
    createdAt: new Date(NOW - 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(NOW - 55 * 60 * 1000).toISOString(),
    htmlUrl: "https://github.com/example/runs/1",
    runNumber: 1,
    durationMs: 5 * 60 * 1000,
    ...overrides,
  };
}

describe("timeAgo", () => {
  afterEach(() => vi.useRealTimers());

  it("returns 'just now' for less than 1 minute", () => {
    vi.setSystemTime(NOW);
    const iso = new Date(NOW - 30 * 1000).toISOString();
    expect(timeAgo(iso)).toBe("just now");
  });

  it("returns minutes for less than 1 hour", () => {
    vi.setSystemTime(NOW);
    const iso = new Date(NOW - 45 * 60 * 1000).toISOString();
    expect(timeAgo(iso)).toBe("45m ago");
  });

  it("returns hours for less than 1 day", () => {
    vi.setSystemTime(NOW);
    const iso = new Date(NOW - 3 * 60 * 60 * 1000).toISOString();
    expect(timeAgo(iso)).toBe("3h ago");
  });

  it("returns days for 1 day or more", () => {
    vi.setSystemTime(NOW);
    const iso = new Date(NOW - 2 * 24 * 60 * 60 * 1000).toISOString();
    expect(timeAgo(iso)).toBe("2d ago");
  });
});

describe("formatDuration", () => {
  it("formats sub-minute durations in seconds", () => {
    expect(formatDuration(45 * 1000)).toBe("45s");
  });

  it("formats durations of exactly 1 minute", () => {
    expect(formatDuration(60 * 1000)).toBe("1m 0s");
  });

  it("formats durations with minutes and seconds", () => {
    expect(formatDuration((2 * 60 + 34) * 1000)).toBe("2m 34s");
  });
});

describe("getWorkflowStatus", () => {
  it("returns 'unknown' for null", () => {
    expect(getWorkflowStatus(null)).toBe("unknown");
  });

  it("returns 'passing' for completed success", () => {
    expect(getWorkflowStatus(makeRun({ status: "completed", conclusion: "success" }))).toBe(
      "passing"
    );
  });

  it("returns 'failing' for completed failure", () => {
    expect(getWorkflowStatus(makeRun({ status: "completed", conclusion: "failure" }))).toBe(
      "failing"
    );
  });

  it("returns 'running' for in_progress", () => {
    expect(getWorkflowStatus(makeRun({ status: "in_progress", conclusion: null }))).toBe("running");
  });

  it("returns 'running' for queued", () => {
    expect(getWorkflowStatus(makeRun({ status: "queued", conclusion: null }))).toBe("running");
  });

  it("returns 'cancelled' for cancelled conclusion", () => {
    expect(getWorkflowStatus(makeRun({ status: "completed", conclusion: "cancelled" }))).toBe(
      "cancelled"
    );
  });

  it("returns 'unknown' for unrecognised conclusion", () => {
    expect(getWorkflowStatus(makeRun({ status: "completed", conclusion: "skipped" }))).toBe(
      "unknown"
    );
  });
});

describe("isExchangeRateStale", () => {
  afterEach(() => vi.useRealTimers());

  it("returns true when lastUpdatedAt is null", () => {
    expect(isExchangeRateStale(null)).toBe(true);
  });

  it("returns false when updated less than stale threshold ago", () => {
    vi.setSystemTime(NOW);
    const recent = new Date(NOW - (STALE_EXCHANGE_RATE_HOURS - 1) * 60 * 60 * 1000).toISOString();
    expect(isExchangeRateStale(recent)).toBe(false);
  });

  it("returns true when updated more than stale threshold ago", () => {
    vi.setSystemTime(NOW);
    const old = new Date(NOW - (STALE_EXCHANGE_RATE_HOURS + 1) * 60 * 60 * 1000).toISOString();
    expect(isExchangeRateStale(old)).toBe(true);
  });
});

describe("isPriceWatchStale", () => {
  afterEach(() => vi.useRealTimers());

  it("returns false when no price watches are enabled", () => {
    expect(isPriceWatchStale(null, 0)).toBe(false);
  });

  it("returns true when enabled watches exist but lastCheckedAt is null", () => {
    expect(isPriceWatchStale(null, 1)).toBe(true);
  });

  it("returns false when checked less than stale threshold ago", () => {
    vi.setSystemTime(NOW);
    const recent = new Date(NOW - (STALE_PRICE_WATCH_HOURS - 1) * 60 * 60 * 1000).toISOString();
    expect(isPriceWatchStale(recent, 3)).toBe(false);
  });

  it("returns true when checked more than stale threshold ago", () => {
    vi.setSystemTime(NOW);
    const old = new Date(NOW - (STALE_PRICE_WATCH_HOURS + 1) * 60 * 60 * 1000).toISOString();
    expect(isPriceWatchStale(old, 3)).toBe(true);
  });
});
