import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { apiError } from "@/lib/api-error";
import { requireAdmin } from "@/lib/auth-utils";
import { isExchangeRateStale, isPriceWatchStale } from "@/lib/health-utils";

const GITHUB_REPO = "chris-catignani/hotel-tracker";

interface GitHubApiRun {
  status: string;
  conclusion: string | null;
  created_at: string;
  updated_at: string;
  run_started_at: string | null;
  html_url: string;
  run_number: number;
}

async function fetchLatestWorkflowRun(workflow: string) {
  try {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    };
    if (process.env.GITHUB_TOKEN) {
      headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    }

    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/actions/workflows/${workflow}/runs?per_page=1`,
      { headers, next: { revalidate: 60 } }
    );
    if (!res.ok) return null;

    const data = await res.json();
    const run: GitHubApiRun | undefined = data.workflow_runs?.[0];
    if (!run) return null;

    const startedAt = run.run_started_at ? new Date(run.run_started_at).getTime() : null;
    const updatedAt = new Date(run.updated_at).getTime();
    const durationMs = run.status === "completed" && startedAt ? updatedAt - startedAt : null;

    return {
      status: run.status,
      conclusion: run.conclusion,
      createdAt: run.created_at,
      updatedAt: run.updated_at,
      htmlUrl: run.html_url,
      runNumber: run.run_number,
      durationMs,
    };
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const adminCheck = await requireAdmin();
  if (adminCheck) return adminCheck;

  try {
    const [
      ciRun,
      priceWatchRun,
      exchangeRateStats,
      priceWatchStats,
      enabledCount,
      disabledCount,
      snapshotsLast24h,
    ] = await Promise.all([
      fetchLatestWorkflowRun("ci.yml"),
      fetchLatestWorkflowRun("refresh-price-watches.yml"),
      prisma.exchangeRate.aggregate({
        _max: { updatedAt: true },
        _count: { id: true },
      }),
      prisma.priceWatch.aggregate({
        _max: { lastCheckedAt: true },
      }),
      prisma.priceWatch.count({ where: { isEnabled: true } }),
      prisma.priceWatch.count({ where: { isEnabled: false } }),
      prisma.priceSnapshot.count({
        where: { fetchedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      }),
    ]);

    const lastExchangeRateUpdate = exchangeRateStats._max.updatedAt;
    const lastPriceWatchCheck = priceWatchStats._max.lastCheckedAt;

    const sentryOrg = process.env.SENTRY_ORG;
    const sentryProject = process.env.SENTRY_PROJECT;
    const sentryUrl =
      sentryOrg && sentryProject
        ? `https://sentry.io/organizations/${sentryOrg}/issues/?project=${sentryProject}&query=is%3Aunresolved&statsPeriod=24h`
        : null;

    return NextResponse.json({
      githubActions: {
        ci: ciRun,
        priceWatchRefresh: priceWatchRun,
      },
      exchangeRates: {
        lastUpdatedAt: lastExchangeRateUpdate?.toISOString() ?? null,
        isStale: isExchangeRateStale(lastExchangeRateUpdate?.toISOString() ?? null),
        currencyCount: exchangeRateStats._count.id,
      },
      priceWatches: {
        lastCheckedAt: lastPriceWatchCheck?.toISOString() ?? null,
        isStale: isPriceWatchStale(lastPriceWatchCheck?.toISOString() ?? null, enabledCount),
        enabledCount,
        disabledCount,
        snapshotsLast24h,
      },
      sentryUrl,
    });
  } catch (error) {
    return apiError("Failed to fetch health data", error, 500, request);
  }
}
