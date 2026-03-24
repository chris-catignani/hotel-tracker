import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useApiQuery } from "./use-api-query";

function okResponse(data: unknown) {
  return Promise.resolve({ ok: true, json: async () => data } as Response);
}

function errorResponse(status: number, error: string) {
  return Promise.resolve({ ok: false, status, json: async () => ({ error }) } as Response);
}

beforeEach(() => {
  global.fetch = vi.fn();
});

describe("useApiQuery", () => {
  it("starts in loading state", () => {
    vi.mocked(global.fetch).mockReturnValue(new Promise(() => {})); // never resolves
    const { result } = renderHook(() => useApiQuery("/api/test"));
    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("sets data and clears loading on success", async () => {
    vi.mocked(global.fetch).mockReturnValue(okResponse([{ id: 1 }]));
    const { result } = renderHook(() => useApiQuery<{ id: number }[]>("/api/test"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual([{ id: 1 }]);
    expect(result.current.error).toBeNull();
  });

  it("sets error and invokes onError on failure", async () => {
    vi.mocked(global.fetch).mockReturnValue(errorResponse(500, "Server error"));
    const onError = vi.fn();
    const { result } = renderHook(() => useApiQuery("/api/test", { onError }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).not.toBeNull();
    expect(result.current.error?.status).toBe(500);
    expect(result.current.error?.error.message).toBe("Server error");
    expect(onError).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledWith({
      status: 500,
      error: expect.any(Error),
    });
  });

  it("clearError resets error state", async () => {
    vi.mocked(global.fetch).mockReturnValue(errorResponse(500, "Server error"));
    const { result } = renderHook(() => useApiQuery("/api/test"));
    await waitFor(() => expect(result.current.error).not.toBeNull());
    act(() => result.current.clearError());
    expect(result.current.error).toBeNull();
  });

  it("refetch re-triggers the fetch", async () => {
    vi.mocked(global.fetch).mockReturnValue(okResponse({ count: 1 }));
    const { result } = renderHook(() => useApiQuery("/api/test"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(global.fetch).toHaveBeenCalledTimes(1);

    vi.mocked(global.fetch).mockReturnValue(okResponse({ count: 2 }));
    act(() => result.current.refetch());
    await waitFor(() => expect(result.current.data).toEqual({ count: 2 }));
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("refetch does not clear existing error — error persists until success", async () => {
    vi.mocked(global.fetch).mockReturnValue(errorResponse(500, "Oops"));
    const { result } = renderHook(() => useApiQuery("/api/test"));
    await waitFor(() => expect(result.current.error).not.toBeNull());

    // refetch also fails
    vi.mocked(global.fetch).mockReturnValue(errorResponse(500, "Still bad"));
    act(() => result.current.refetch());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).not.toBeNull();
  });

  it("a new url triggers a fresh fetch", async () => {
    vi.mocked(global.fetch).mockReturnValue(okResponse({ page: 1 }));
    const { result, rerender } = renderHook(({ url }) => useApiQuery(url), {
      initialProps: { url: "/api/test?page=1" },
    });
    await waitFor(() => expect(result.current.data).toEqual({ page: 1 }));

    vi.mocked(global.fetch).mockReturnValue(okResponse({ page: 2 }));
    rerender({ url: "/api/test?page=2" });
    await waitFor(() => expect(result.current.data).toEqual({ page: 2 }));
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("onError identity change does not trigger a re-fetch", async () => {
    vi.mocked(global.fetch).mockReturnValue(okResponse([]));
    const { result, rerender } = renderHook(({ cb }) => useApiQuery("/api/test", { onError: cb }), {
      initialProps: { cb: vi.fn() },
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(global.fetch).toHaveBeenCalledTimes(1);

    rerender({ cb: vi.fn() }); // new function identity
    expect(global.fetch).toHaveBeenCalledTimes(1); // no extra fetch
  });

  it("discards stale responses when a newer fetch is initiated", async () => {
    let resolveFirst!: (v: Response) => void;
    const firstFetch = new Promise<Response>((r) => (resolveFirst = r));

    vi.mocked(global.fetch)
      .mockReturnValueOnce(firstFetch) // first call — stale, never resolves until after second
      .mockReturnValueOnce(okResponse({ version: 2 })); // second call — fresh

    const { result } = renderHook(() => useApiQuery<{ version: number }>("/api/test"));

    // Trigger a second fetch before the first resolves
    act(() => result.current.refetch());
    await waitFor(() => expect(result.current.data).toEqual({ version: 2 }));

    // Now resolve the first (stale) fetch — data should NOT change
    resolveFirst({ ok: true, json: async () => ({ version: 1 }) } as Response);
    await new Promise((r) => setTimeout(r, 50)); // allow microtasks to flush
    expect(result.current.data).toEqual({ version: 2 }); // stale response discarded
  });
});
