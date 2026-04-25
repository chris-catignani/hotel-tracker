// Plain fetch is used here instead of Playwright's page.evaluate(fetch()) because the browser
// page has no IHG session cookies, causing Akamai WAF to return 403. A direct Node.js fetch
// with the API key header is sufficient and not blocked.

const IHG_PROFILE_BASE = "https://apis.ihg.com/hotels/v3/profiles";

// Same static public key used by the IHG price-watch scraper.
const IHG_API_KEY = process.env.IHG_API_KEY ?? "se9ym5iAzaW8pxfBjkmgbuGjJcr3Pj6Y";

export async function fetchPropertyProfile(mnemonic: string): Promise<unknown> {
  const res = await fetch(`${IHG_PROFILE_BASE}/${mnemonic}/details?ihg-language=en-us`, {
    headers: { "x-ihg-api-key": IHG_API_KEY },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for mnemonic ${mnemonic}`);
  }
  return res.json();
}
