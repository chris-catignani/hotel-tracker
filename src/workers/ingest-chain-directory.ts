import dotenv from "dotenv";
// Load .env first, then override with .env.local to mirror Next.js behavior.
dotenv.config();
dotenv.config({ path: ".env.local", override: true });

import * as Sentry from "@sentry/node";
import { log } from "next-axiom";

Sentry.init({ dsn: process.env.SENTRY_DSN, tracesSampleRate: 0 });
Sentry.setTag("runner_type", process.env.RUNNER_TYPE ?? "ingest-chain-directory");

import { ingestGhaDirectory } from "@/services/gha-directory-ingest";

async function main() {
  const chain = process.env.CHAIN ?? "gha";
  const forceFullRefetch = process.env.FORCE_FULL === "1";
  console.log(`[IngestChainDirectory] chain=${chain} forceFullRefetch=${forceFullRefetch}`);
  const runStart = Date.now();

  let exitCode = 0;
  try {
    if (chain !== "gha") {
      throw new Error(`Unsupported CHAIN=${chain}; only 'gha' is supported`);
    }
    const result = await ingestGhaDirectory({ forceFullRefetch });
    const durationMs = Date.now() - runStart;
    log.info("chain_directory_ingest:completed", {
      chain,
      durationMs,
      ...result,
    });
    console.log(`[IngestChainDirectory] Done in ${durationMs}ms`, result);
  } catch (error) {
    console.error("[IngestChainDirectory] ERROR:", error);
    Sentry.captureException(error);
    exitCode = 1;
  } finally {
    await Promise.all([Sentry.flush(2000), log.flush()]);
  }
  if (exitCode) process.exit(exitCode);
}

main();
