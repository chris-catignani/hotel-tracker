import fs from "fs";
import { chromium } from "playwright";
import type { HiltonRawHotel } from "./property-parser";

const LOCATIONS_URL = "https://www.hilton.com/en/locations/hilton-hotels/";
const TOKEN_URL =
  "https://www.hilton.com/dx-customer/auth/applications/token?appName=dx_shop_search_app";
const GRAPHQL_BASE = "https://www.hilton.com/graphql/customer?appName=dx_shop_search_app&bl=en";

// Passed into page.evaluate() — must be serializable (no imports, no closures).
const SUMMARY_QUERY = `
  query hotelSummaryOptions_geocodePage($language: String!, $input: HotelSummaryOptionsInput) {
    hotelSummaryOptions(language: $language, input: $input) {
      hotels {
        ctyhocn brandCode name
        address { addressLine1 city country state }
        localization { coordinate { latitude longitude } }
      }
    }
  }
`;

export interface FetchOptions {
  limit?: number;
  requestDelayMs?: number;
}

export async function fetchHiltonProperties(opts: FetchOptions = {}): Promise<HiltonRawHotel[]> {
  const requestDelayMs = opts.requestDelayMs ?? 500;
  const userDataDir = `/tmp/hilton-props-${Math.random().toString(36).substring(7)}`;

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: ["--disable-blink-features=AutomationControlled", "--no-sandbox", "--use-gl=desktop"],
    viewport: { width: 1280, height: 800 },
  });

  try {
    const page = await context.newPage();
    await page.goto(LOCATIONS_URL, { waitUntil: "domcontentloaded" });

    const appId = await page.evaluate((): string | null => {
      const scripts = Array.from(document.querySelectorAll("script"));
      for (const s of scripts) {
        if (s.textContent?.includes("DX_AUTH_API_CUSTOMER_APP_ID")) {
          const match = s.textContent.match(/DX_AUTH_API_CUSTOMER_APP_ID['":\s]+['"]([^'"]+)['"]/);
          if (match) return match[1];
        }
      }
      return null;
    });

    if (!appId) {
      throw new Error("[HiltonPropertyFetcher] Could not extract DX_AUTH_API_CUSTOMER_APP_ID");
    }

    const token = await page.evaluate(
      async (args: { tokenUrl: string; appId: string }): Promise<string> => {
        const resp = await fetch(args.tokenUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-dtpc": "ignore" },
          body: JSON.stringify({ app_id: args.appId }),
        });
        if (!resp.ok) throw new Error(`Token request failed: HTTP ${resp.status}`);
        const data = (await resp.json()) as { access_token?: string };
        if (!data.access_token) throw new Error("No access_token in token response");
        return data.access_token;
      },
      { tokenUrl: TOKEN_URL, appId }
    );

    const quadrantIds = await page.evaluate(
      async (args: { graphqlBase: string; token: string }): Promise<string[]> => {
        const resp = await fetch(
          `${args.graphqlBase}&operationName=hotelQuadrants&originalOpName=hotelQuadrants`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${args.token}`,
            },
            body: JSON.stringify({
              operationName: "hotelQuadrants",
              query: "query hotelQuadrants { hotelQuadrants { id } }",
              variables: {},
            }),
          }
        );
        const data = (await resp.json()) as {
          data?: { hotelQuadrants?: Array<{ id: string }> };
        };
        return (data.data?.hotelQuadrants ?? []).map((q) => q.id);
      },
      { graphqlBase: GRAPHQL_BASE, token }
    );

    console.log(`[HiltonPropertyFetcher] ${quadrantIds.length} quadrants`);

    const allHotels: HiltonRawHotel[] = [];

    for (let i = 0; i < quadrantIds.length; i++) {
      if (opts.limit != null && allHotels.length >= opts.limit) break;

      if (i > 0 && requestDelayMs > 0) {
        await new Promise<void>((r) => setTimeout(r, requestDelayMs));
      }

      const quadrantId = quadrantIds[i];
      try {
        const hotels = await page.evaluate(
          async (args: {
            graphqlBase: string;
            token: string;
            quadrantId: string;
            query: string;
          }): Promise<unknown[]> => {
            const resp = await fetch(
              `${args.graphqlBase}&operationName=hotelSummaryOptions_geocodePage&originalOpName=hotelSummaryOptions_geocodePage`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${args.token}`,
                },
                body: JSON.stringify({
                  operationName: "hotelSummaryOptions_geocodePage",
                  query: args.query,
                  variables: {
                    input: { guestLocationCountry: "HU", quadrantId: args.quadrantId },
                    language: "en",
                  },
                }),
              }
            );
            const data = (await resp.json()) as {
              data?: { hotelSummaryOptions?: { hotels?: unknown[] } };
            };
            return data.data?.hotelSummaryOptions?.hotels ?? [];
          },
          { graphqlBase: GRAPHQL_BASE, token, quadrantId, query: SUMMARY_QUERY }
        );

        allHotels.push(...(hotels as HiltonRawHotel[]));
        console.log(
          `[HiltonPropertyFetcher] Quadrant ${i + 1}/${quadrantIds.length} (${quadrantId}): ${hotels.length} hotels (total: ${allHotels.length})`
        );
      } catch (err) {
        console.warn(
          `[HiltonPropertyFetcher] Failed quadrant ${quadrantId}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    if (opts.limit != null) return allHotels.slice(0, opts.limit);
    return allHotels;
  } finally {
    await context.close();
    try {
      if (fs.existsSync(userDataDir)) fs.rmSync(userDataDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
}
