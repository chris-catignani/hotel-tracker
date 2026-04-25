import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchPropertyProfile } from "./property-fetcher";

describe("fetchPropertyProfile", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("fetches property profile with correct URL and API key header", async () => {
    const profileData = { hotel: { name: "Test Hotel" } };
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => profileData });
    vi.stubGlobal("fetch", mockFetch);

    const result = await fetchPropertyProfile("NHACH");

    expect(result).toEqual(profileData);
    const [url, init] = mockFetch.mock.calls[0] as [
      string,
      RequestInit & { headers: Record<string, string> },
    ];
    expect(url).toContain("NHACH");
    expect(url).toContain("ihg-language=en-us");
    expect(init.headers["x-ihg-api-key"]).toBeDefined();
  });

  it("throws on non-OK response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 403 }));

    await expect(fetchPropertyProfile("BADM")).rejects.toThrow("HTTP 403");
  });
});
