import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    priceWatch: { findFirst: vi.fn() },
  },
}));
vi.mock("./price-watch-refresh", () => ({
  runPriceWatchRefresh: vi.fn(),
}));
vi.mock("@/lib/scrapers/gha/price-watch", () => ({
  createGhaFetcher: vi.fn(() => ({ name: "gha" })),
}));

import prisma from "@/lib/prisma";
import { runPriceWatchRefresh } from "./price-watch-refresh";
import { scrapeSinglePriceWatch } from "./price-watch-one-off";

describe("scrapeSinglePriceWatch", () => {
  beforeEach(() => vi.resetAllMocks());

  it("invokes runPriceWatchRefresh filtered to the one watch", async () => {
    (prisma.priceWatch.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "pw1",
      property: { hotelChainId: "cwizlxi70wnbaq3qehma0fhbz" },
    });
    (runPriceWatchRefresh as ReturnType<typeof vi.fn>).mockResolvedValue({
      watched: 1,
      results: [],
    });
    await scrapeSinglePriceWatch("pw1", "u1");
    expect(runPriceWatchRefresh).toHaveBeenCalledWith(expect.any(Array), "pw1");
  });

  it("throws 404 when the watch is not owned by userId", async () => {
    (prisma.priceWatch.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    await expect(scrapeSinglePriceWatch("pw1", "u1")).rejects.toThrow("Price watch not found");
  });
});
