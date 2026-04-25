import dotenv from "dotenv";
// Load .env first, then override with .env.local to mirror Next.js behavior.
dotenv.config();
dotenv.config({ path: ".env.local", override: true });

import * as Sentry from "@sentry/node";
import { log } from "next-axiom";

Sentry.init({ dsn: process.env.SENTRY_DSN, tracesSampleRate: 0 });
Sentry.setTag("runner_type", process.env.RUNNER_TYPE ?? "ingest-chain-properties");

import { ingestGhaProperties } from "@/services/gha-property-ingest";
import { ingestHyattProperties } from "@/services/hyatt-property-ingest";
import { ingestMarriottProperties } from "@/services/marriott-property-ingest";
import { ingestIhgProperties } from "@/services/ihg-property-ingest";

async function runChain(chain: string, limit: number | undefined) {
  if (chain === "gha") {
    return await ingestGhaProperties({ limit });
  } else if (chain === "hyatt") {
    return await ingestHyattProperties({ limit });
  } else if (chain === "marriott") {
    return await ingestMarriottProperties({ limit });
  } else if (chain === "ihg") {
    return await ingestIhgProperties({ limit });
  } else {
    throw new Error(
      `Unsupported chain=${chain}; supported values: 'gha', 'hyatt', 'marriott', 'ihg'`
    );
  }
}

async function main() {
  const chains = (process.env.CHAINS ?? "gha")
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
  const limit = process.env.LIMIT ? parseInt(process.env.LIMIT, 10) : undefined;
  console.log(`[IngestChainProperties] chains=${chains.join(",")} limit=${limit ?? "none"}`);

  let exitCode = 0;
  for (const chain of chains) {
    const runStart = Date.now();
    try {
      const result = await runChain(chain, limit);
      const durationMs = Date.now() - runStart;
      log.info("chain_property_ingest:completed", { chain, durationMs, ...result });
      console.log(`[IngestChainProperties] ${chain} done in ${durationMs}ms`, result);
    } catch (error) {
      console.error(`[IngestChainProperties] ${chain} ERROR:`, error);
      Sentry.captureException(error);
      exitCode = 1;
    }
  }

  await Promise.all([Sentry.flush(2000), log.flush()]);
  if (exitCode) process.exit(exitCode);
}

main();
