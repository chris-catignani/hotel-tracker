import { logger } from "@/lib/logger";

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function withRetry<T>(
  fn: () => Promise<T>,
  context: string,
  maxAttempts = 3,
  baseDelayMs = 1000
): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxAttempts) throw err;
      const message = err instanceof Error ? err.message : String(err);
      logger.warn(`Retrying after transient failure`, {
        context,
        attempt,
        maxAttempts,
        error: message,
      });
      await sleep(baseDelayMs * attempt);
    }
  }
  throw new Error("unreachable");
}
