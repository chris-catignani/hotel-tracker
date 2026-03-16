import { describe, it, expect, vi, beforeEach } from "vitest";
import * as SentryNext from "@sentry/nextjs";
import * as SentryNode from "@sentry/node";
import { logger } from "./logger";

// Mock Sentry SDKs
vi.mock("@sentry/nextjs", () => ({
  captureMessage: vi.fn(),
  captureException: vi.fn(),
}));

vi.mock("@sentry/node", () => ({
  captureMessage: vi.fn(),
  captureException: vi.fn(),
}));

describe("logger", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("info() should log to console and NOT to Sentry", () => {
    logger.info("test info", { foo: "bar" });
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('[INFO] test info {"foo":"bar"}')
    );
    expect(SentryNext.captureMessage).not.toHaveBeenCalled();
    expect(SentryNode.captureMessage).not.toHaveBeenCalled();
  });

  it("warn() should log to console and Sentry message", () => {
    logger.warn("test warn", { foo: "bar" });
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('[WARN] test warn {"foo":"bar"}')
    );

    // In vitest environment, it might pick either Next or Node depending on implementation
    const sentry =
      (SentryNext.captureMessage as vi.Mock).mock.calls.length > 0 ? SentryNext : SentryNode;
    expect(sentry.captureMessage).toHaveBeenCalledWith("test warn", {
      level: "warning",
      extra: { foo: "bar" },
    });
  });

  it("error() should log to console and Sentry exception", () => {
    const err = new Error("boom");
    logger.error("test error", err, { foo: "bar" });
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('[ERROR] test error {"foo":"bar"}'),
      err
    );

    const sentry =
      (SentryNext.captureException as vi.Mock).mock.calls.length > 0 ? SentryNext : SentryNode;
    expect(sentry.captureException).toHaveBeenCalledWith(err, {
      extra: {
        foo: "bar",
        originalMessage: "test error",
      },
    });
  });

  it("error() should convert string errors to Error objects for Sentry", () => {
    logger.error("test error string", "not an error object");

    const sentry =
      (SentryNext.captureException as vi.Mock).mock.calls.length > 0 ? SentryNext : SentryNode;
    expect(sentry.captureException).toHaveBeenCalledWith(expect.any(Error), expect.anything());
    const captured = (sentry.captureException as vi.Mock).mock.calls[0][0];
    expect(captured.message).toBe("not an error object");
  });
});
