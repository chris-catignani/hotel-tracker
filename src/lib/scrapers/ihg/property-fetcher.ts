import type { Page } from "playwright";

const IHG_PROFILE_BASE = "https://apis.ihg.com/hotels/v3/profiles";

// Same static public key used by the IHG price-watch scraper.
const IHG_API_KEY = process.env.IHG_API_KEY ?? "se9ym5iAzaW8pxfBjkmgbuGjJcr3Pj6Y";

export async function fetchPropertyProfile(page: Page, mnemonic: string): Promise<unknown> {
  return page.evaluate(
    async (args: { mnemonic: string; apiKey: string; base: string }) => {
      const res = await fetch(`${args.base}/${args.mnemonic}/details?ihg-language=en-us`, {
        headers: { "x-ihg-api-key": args.apiKey },
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} for mnemonic ${args.mnemonic}`);
      }
      return res.json();
    },
    { mnemonic, apiKey: IHG_API_KEY, base: IHG_PROFILE_BASE }
  );
}
