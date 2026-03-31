import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from "vitest";
import * as SentryNext from "@sentry/nextjs";
import * as SentryNode from "@sentry/node";
import { log as axiomLog } from "next-axiom";
import { logger } from "./logger";

vi.mock("@sentry/nextjs", () => ({
  captureMessage: vi.fn(),
  captureException: vi.fn(),
}));

vi.mock("@sentry/node", () => ({
  captureMessage: vi.fn(),
  captureException: vi.fn(),
}));

vi.mock("next-axiom", () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("logger", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.clearAllMocks();
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
    const sentry =
      (SentryNext.captureMessage as Mock).mock.calls.length > 0 ? SentryNext : SentryNode;
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
      (SentryNext.captureException as Mock).mock.calls.length > 0 ? SentryNext : SentryNode;
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
      (SentryNext.captureException as Mock).mock.calls.length > 0 ? SentryNext : SentryNode;
    expect(sentry.captureException).toHaveBeenCalledWith(expect.any(Error), expect.anything());
    const captured = (sentry.captureException as Mock).mock.calls[0][0];
    expect(captured.message).toBe("not an error object");
  });

  describe("Axiom forwarding (AXIOM_TOKEN set)", () => {
    beforeEach(() => {
      process.env.AXIOM_TOKEN = "test-token";
    });
    afterEach(() => {
      delete process.env.AXIOM_TOKEN;
    });

    it("info() should send structured fields to Axiom", () => {
      logger.info("test info", { foo: "bar" });
      expect(axiomLog.info).toHaveBeenCalledWith("test info", { foo: "bar" });
    });

    it("warn() should send structured fields to Axiom", () => {
      logger.warn("test warn", { foo: "bar" });
      expect(axiomLog.warn).toHaveBeenCalledWith("test warn", { foo: "bar" });
    });

    it("error() should send structured fields to Axiom with error details", () => {
      const err = new Error("boom");
      logger.error("test error", err, { foo: "bar" });
      expect(axiomLog.error).toHaveBeenCalledWith("test error", {
        foo: "bar",
        errorMessage: "boom",
        errorStack: expect.any(String),
      });
    });

    it("error() with string error should include errorMessage in Axiom fields", () => {
      logger.error("test error string", "not an error object");
      expect(axiomLog.error).toHaveBeenCalledWith("test error string", {
        errorMessage: "not an error object",
        errorStack: undefined,
      });
    });

    it("error() with null error should not produce 'null' as errorMessage in Axiom fields", () => {
      logger.error("test error null", null);
      expect(axiomLog.error).toHaveBeenCalledWith("test error null", {
        errorMessage: undefined,
        errorStack: undefined,
      });
    });
  });

  describe("log level suppression (NEXT_PUBLIC_AXIOM_LOG_LEVEL=warn)", () => {
    it("info() should NOT log to console when log level is warn", async () => {
      const original = process.env.NEXT_PUBLIC_AXIOM_LOG_LEVEL;
      process.env.NEXT_PUBLIC_AXIOM_LOG_LEVEL = "warn";
      vi.resetModules();
      const { logger: suppressedLogger } = await import("./logger");
      suppressedLogger.info("should be suppressed");
      expect(console.log).not.toHaveBeenCalled();
      process.env.NEXT_PUBLIC_AXIOM_LOG_LEVEL = original;
      vi.resetModules();
    });

    it("warn() and error() should still log to console when log level is warn", async () => {
      const original = process.env.NEXT_PUBLIC_AXIOM_LOG_LEVEL;
      process.env.NEXT_PUBLIC_AXIOM_LOG_LEVEL = "warn";
      vi.resetModules();
      const { logger: suppressedLogger } = await import("./logger");
      suppressedLogger.warn("still visible");
      suppressedLogger.error("still visible", new Error("boom"));
      expect(console.warn).toHaveBeenCalled();
      expect(console.error).toHaveBeenCalled();
      process.env.NEXT_PUBLIC_AXIOM_LOG_LEVEL = original;
      vi.resetModules();
    });
  });

  describe("Axiom forwarding (AXIOM_TOKEN not set)", () => {
    it("info() should NOT call axiomLog when AXIOM_TOKEN is absent", () => {
      logger.info("test info", { foo: "bar" });
      expect(axiomLog.info).not.toHaveBeenCalled();
    });

    it("warn() should NOT call axiomLog when AXIOM_TOKEN is absent", () => {
      logger.warn("test warn", { foo: "bar" });
      expect(axiomLog.warn).not.toHaveBeenCalled();
    });

    it("error() should NOT call axiomLog when AXIOM_TOKEN is absent", () => {
      logger.error("test error", new Error("boom"));
      expect(axiomLog.error).not.toHaveBeenCalled();
    });
  });
});
