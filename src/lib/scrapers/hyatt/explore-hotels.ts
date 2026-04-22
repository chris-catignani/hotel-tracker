import os from "os";
import path from "path";
import { chromium } from "playwright";

const FETCH_URL = "https://www.hyatt.com/explore-hotels";

export async function fetchExploreHotelsHtml(): Promise<string> {
  // Kasada bot protection requires GPU rendering — headless mode is always blocked.
  // Share the same profile as the price watch scraper so Kasada trusts the session.
  const userDataDir =
    process.env.HYATT_BROWSER_PROFILE_DIR ??
    path.join(os.homedir(), ".cache", "hyatt-browser-profile");
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    channel: "chrome",
    args: ["--disable-blink-features=AutomationControlled"],
    viewport: { width: 1280, height: 800 },
  });
  let page: Awaited<ReturnType<typeof context.newPage>> | undefined;
  try {
    page = context.pages()[0] ?? (await context.newPage());
    // domcontentloaded rather than networkidle — Hyatt's page has continuous background
    // requests (analytics, chat widgets) that prevent networkidle from ever being reached.
    await page.goto(FETCH_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
    const storeJson = await page.evaluate(() =>
      JSON.stringify((window as { STORE?: unknown }).STORE)
    );
    if (!storeJson || storeJson === "null") {
      const [url, title] = await Promise.all([page.url(), page.title()]);
      throw new Error(`window.STORE not populated after page load — url=${url}, title=${title}`);
    }
    return `<script>window.STORE = ${storeJson};</script>`;
  } catch (err) {
    try {
      if (page) await page.screenshot({ path: "hyatt-ingest-failure.png", fullPage: true });
    } catch {
      // ignore screenshot errors
    }
    throw err;
  } finally {
    await context.close();
  }
}
