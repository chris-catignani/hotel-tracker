import dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: ".env.local", override: true });

import * as Sentry from "@sentry/node";
import { log } from "next-axiom";

Sentry.init({ dsn: process.env.SENTRY_DSN, tracesSampleRate: 0 });
Sentry.setTag("runner_type", process.env.RUNNER_TYPE ?? "ingest-chain-properties");

import { HOTEL_ID } from "@/lib/constants";
import { ingestGhaProperties } from "@/services/gha-property-ingest";
import { ingestHyattProperties } from "@/services/hyatt-property-ingest";
import { ingestMarriottProperties } from "@/services/marriott-property-ingest";
import { ingestIhgProperties } from "@/services/ihg-property-ingest";
import { writeProperties, type ChainFetchResult } from "@/services/property-ingest-orchestrator";

type ConflictKey = "chainPropertyId" | "chainUrlPath";

interface ChainConfig {
  hotelChainId: string;
  conflictKey: ConflictKey;
  fetch: (limit: number | undefined) => Promise<ChainFetchResult>;
}

function getChainConfig(chain: string): ChainConfig {
  if (chain === "gha") {
    return {
      hotelChainId: HOTEL_ID.GHA_DISCOVERY,
      conflictKey: "chainUrlPath",
      fetch: (l) => ingestGhaProperties({ limit: l }),
    };
  } else if (chain === "hyatt") {
    return {
      hotelChainId: HOTEL_ID.HYATT,
      conflictKey: "chainPropertyId",
      fetch: (l) => ingestHyattProperties({ limit: l }),
    };
  } else if (chain === "marriott") {
    return {
      hotelChainId: HOTEL_ID.MARRIOTT,
      conflictKey: "chainPropertyId",
      fetch: (l) => ingestMarriottProperties({ limit: l }),
    };
  } else if (chain === "ihg") {
    return {
      hotelChainId: HOTEL_ID.IHG,
      conflictKey: "chainPropertyId",
      fetch: (l) => ingestIhgProperties({ limit: l }),
    };
  } else {
    throw new Error(
      `Unsupported chain=${chain}; supported values: 'gha', 'hyatt', 'marriott', 'ihg'`
    );
  }
}

interface ChainSummary {
  chain: string;
  durationMs: number;
  fetchedCount: number;
  skippedCount: number;
  processedCount: number;
  dbOperationCount: number;
  errorCount: number;
  errors: string[];
}

async function main() {
  const chains = (process.env.CHAINS ?? "gha,hyatt,marriott,ihg")
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
  const limit = process.env.LIMIT ? parseInt(process.env.LIMIT, 10) : undefined;
  console.log(`[IngestChainProperties] chains=${chains.join(",")} limit=${limit ?? "none"}`);

  const settled = await Promise.allSettled(
    chains.map(async (chain): Promise<ChainSummary> => {
      const runStart = Date.now();
      const config = getChainConfig(chain);
      const { properties, skippedCount, errors: fetchErrors } = await config.fetch(limit);
      const writeResult = await writeProperties(config.hotelChainId, properties, {
        conflictKey: config.conflictKey,
      });
      const durationMs = Date.now() - runStart;
      const allErrors = [...fetchErrors, ...writeResult.errors];
      return {
        chain,
        durationMs,
        fetchedCount: properties.length,
        skippedCount,
        processedCount: writeResult.processedCount,
        dbOperationCount: writeResult.dbOperationCount,
        errorCount: allErrors.length,
        errors: allErrors,
      };
    })
  );

  let exitCode = 0;
  const summary: Record<string, ChainSummary | { error: string }> = {};
  for (const [i, result] of settled.entries()) {
    if (result.status === "fulfilled") {
      summary[result.value.chain] = result.value;
    } else {
      const error = result.reason instanceof Error ? result.reason.message : String(result.reason);
      summary[chains[i]] = { error };
      Sentry.captureException(result.reason);
      exitCode = 1;
    }
  }

  log.info("chain_property_ingest:summary", summary);
  console.log("[IngestChainProperties] summary", summary);

  await Promise.all([Sentry.flush(2000), log.flush()]);
  if (exitCode) process.exit(exitCode);
}

main();
