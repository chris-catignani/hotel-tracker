import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { apiError } from "./api-error";
import { NextResponse } from "next/server";

// Mock NextResponse.json since it's a static method
vi.mock("next/server", () => ({
  NextResponse: {
    json: vi.fn(),
  },
}));

describe("apiError", () => {
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    vi.mocked(NextResponse.json).mockImplementation(
      (body, init) =>
        ({
          json: async () => body,
          status: init?.status ?? 200,
        }) as unknown as Response
    );
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    vi.clearAllMocks();
  });

  it("should return a generic error in production", async () => {
    process.env.NODE_ENV = "production";
    const message = "Something went wrong";
    const error = new Error("Secret details");

    const response = apiError(message, error, 400);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: message });
    expect(body.debug).toBeUndefined();
  });

  it("should include debug info in development with Error object", async () => {
    process.env.NODE_ENV = "development";
    const message = "Validation failed";
    const error = new Error("Detailed error");
    error.name = "ValidationError";

    const response = apiError(message, error, 422);
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.error).toBe(message);
    expect(body.debug).toBeDefined();
    expect(body.debug.message).toBe("Detailed error");
    expect(body.debug.name).toBe("ValidationError");
    expect(body.debug.stack).toBeDefined();
  });

  it("should handle non-Error objects in development", async () => {
    process.env.NODE_ENV = "development";
    const message = "Failed";
    const error = "Just a string error";

    const response = apiError(message, error);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.debug).toEqual({ raw: "Just a string error" });
  });
});
