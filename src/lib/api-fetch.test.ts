import { describe, it, expect, vi, beforeEach } from "vitest";
import { apiFetch } from "./api-fetch";

beforeEach(() => {
  global.fetch = vi.fn();
});

describe("apiFetch", () => {
  it("returns ok:true with parsed data on success", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ id: 1, name: "Test" }),
    } as Response);

    const result = await apiFetch<{ id: number; name: string }>("/api/test");
    expect(result).toEqual({ ok: true, data: { id: 1, name: "Test" } });
  });

  it("returns ok:false with error message from .error field on non-2xx", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: "Not found" }),
    } as Response);

    const result = await apiFetch("/api/test");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(404);
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error.message).toBe("Not found");
    }
  });

  it("returns ok:false with fallback message when response body has no .error field", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    } as Response);

    const result = await apiFetch("/api/test");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(500);
      expect(result.error.message).toBe("An unexpected error occurred.");
    }
  });

  it("returns ok:true with undefined data on 204 No Content", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      status: 204,
      json: async () => {
        throw new SyntaxError("Unexpected end of JSON input");
      },
    } as Response);

    const result = await apiFetch<void>("/api/test");
    expect(result).toEqual({ ok: true, data: undefined });
  });

  it("returns ok:false with status 0 and cause chain on network error", async () => {
    const networkErr = new Error("Connection refused");
    vi.mocked(global.fetch).mockRejectedValue(networkErr);

    const result = await apiFetch("/api/test");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(0);
      expect(result.error.message).toBe("Network error");
      expect((result.error as Error & { cause: unknown }).cause).toBe(networkErr);
    }
  });

  it("forwards method and JSON-serialized body", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as Response);

    await apiFetch("/api/test", { method: "POST", body: { name: "hello" } });
    expect(global.fetch).toHaveBeenCalledWith("/api/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "hello" }),
    });
  });

  it("accepts PATCH method", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as Response);

    await apiFetch("/api/test", { method: "PATCH", body: { verified: true } });
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/test",
      expect.objectContaining({ method: "PATCH" })
    );
  });

  it("defaults to GET and no body when opts omitted", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as Response);

    await apiFetch("/api/test");
    expect(global.fetch).toHaveBeenCalledWith("/api/test", {
      method: "GET",
      headers: {},
      body: undefined,
    });
  });
});
