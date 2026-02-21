const IS_DEBUG = process.env.NEXT_PUBLIC_DEBUG === "true";

/**
 * Extracts a user-facing error message from an API response.
 * In debug mode (NEXT_PUBLIC_DEBUG=true), includes detailed server error info.
 */
export async function extractApiError(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json();
    const base = body.error || fallback;

    if (IS_DEBUG && body.debug) {
      const debug = body.debug;
      const detail = debug.message || debug.raw || "";
      const stack = debug.stack || "";
      return `${base}\n\n[Debug] ${detail}${stack ? `\n\nStack trace:\n${stack}` : ""}`;
    }

    return base;
  } catch {
    return fallback;
  }
}
