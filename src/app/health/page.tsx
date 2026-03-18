"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, RefreshCw, CheckCircle2, XCircle, Clock, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { timeAgo, formatDuration, getWorkflowStatus, type WorkflowRun } from "@/lib/health-utils";

interface HealthData {
  githubActions: {
    ci: WorkflowRun | null;
    priceWatchRefresh: WorkflowRun | null;
  };
  exchangeRates: {
    lastUpdatedAt: string | null;
    isStale: boolean;
    currencyCount: number;
  };
  priceWatches: {
    lastCheckedAt: string | null;
    isStale: boolean;
    enabledCount: number;
    disabledCount: number;
    snapshotsLast24h: number;
  };
  sentryUrl: string | null;
}

function WorkflowStatusBadge({ run }: { run: WorkflowRun | null }) {
  const status = getWorkflowStatus(run);
  if (status === "passing")
    return (
      <Badge className="bg-green-100 text-green-800 border-green-200">
        <CheckCircle2 className="size-3" /> Passing
      </Badge>
    );
  if (status === "failing")
    return (
      <Badge variant="destructive">
        <XCircle className="size-3" /> Failing
      </Badge>
    );
  if (status === "running")
    return (
      <Badge variant="warning">
        <Clock className="size-3" /> Running
      </Badge>
    );
  if (status === "cancelled") return <Badge variant="secondary">Cancelled</Badge>;
  return <Badge variant="outline">Unknown</Badge>;
}

function WorkflowRow({ label, run }: { label: string; run: WorkflowRun | null }) {
  return (
    <div className="flex items-center justify-between py-3 border-b last:border-0">
      <div className="flex items-center gap-3 min-w-0">
        <WorkflowStatusBadge run={run} />
        <span className="font-medium text-sm">{label}</span>
      </div>
      {run ? (
        <div className="flex items-center gap-3 text-sm text-muted-foreground shrink-0">
          <span>#{run.runNumber}</span>
          <span>{timeAgo(run.updatedAt)}</span>
          {run.durationMs != null && <span>{formatDuration(run.durationMs)}</span>}
          <Link
            href={run.htmlUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline flex items-center gap-1"
          >
            View <ExternalLink className="size-3" />
          </Link>
        </div>
      ) : (
        <span className="text-sm text-muted-foreground">No data</span>
      )}
    </div>
  );
}

function JobRow({
  label,
  lastAt,
  isStale,
  detail,
}: {
  label: string;
  lastAt: string | null;
  isStale: boolean;
  detail: string;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b last:border-0">
      <div className="flex items-center gap-3 min-w-0">
        {isStale ? (
          <Badge variant="warning">
            <AlertTriangle className="size-3" /> Stale
          </Badge>
        ) : (
          <Badge className="bg-green-100 text-green-800 border-green-200">
            <CheckCircle2 className="size-3" /> Fresh
          </Badge>
        )}
        <span className="font-medium text-sm">{label}</span>
      </div>
      <div className="text-sm text-muted-foreground text-right shrink-0">
        <span>{lastAt ? timeAgo(lastAt) : "Never"}</span>
        <span className="ml-3 text-xs">{detail}</span>
      </div>
    </div>
  );
}

const AUTO_REFRESH_INTERVAL_MS = 60_000;

export default function HealthPage() {
  const [data, setData] = useState<HealthData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/health");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Failed to load health data.");
        return;
      }
      setData(await res.json());
      setLastRefreshed(new Date());
    } catch {
      setError("Failed to load health data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, AUTO_REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  return (
    <div className="flex flex-col flex-1 min-h-0 space-y-6">
      <div className="flex items-center justify-between shrink-0">
        <h1 className="text-2xl font-bold">Health</h1>
        <div className="flex items-center gap-3">
          {lastRefreshed && (
            <span className="text-sm text-muted-foreground">
              Refreshed {timeAgo(lastRefreshed.toISOString())}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={fetchHealth}
            disabled={loading}
            className={cn(loading && "opacity-60")}
          >
            <RefreshCw className={cn("size-4", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="p-4 text-destructive text-sm">{error}</CardContent>
        </Card>
      )}

      {data && (
        <>
          {/* GitHub Actions */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">GitHub Actions</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <WorkflowRow label="CI" run={data.githubActions.ci} />
              <WorkflowRow label="Price Watch Refresh" run={data.githubActions.priceWatchRefresh} />
            </CardContent>
          </Card>

          {/* Background Jobs */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Background Jobs</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <JobRow
                label="Exchange Rates"
                lastAt={data.exchangeRates.lastUpdatedAt}
                isStale={data.exchangeRates.isStale}
                detail={`${data.exchangeRates.currencyCount} currencies`}
              />
              <JobRow
                label="Price Watch Refresh"
                lastAt={data.priceWatches.lastCheckedAt}
                isStale={data.priceWatches.isStale}
                detail={`${data.priceWatches.enabledCount} enabled · ${data.priceWatches.disabledCount} disabled · ${data.priceWatches.snapshotsLast24h} snapshots (24h)`}
              />
            </CardContent>
          </Card>

          {/* External Services */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">External Services</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {data.sentryUrl ? (
                  <Link
                    href={data.sentryUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between rounded-lg border p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div>
                      <p className="font-medium text-sm">Sentry</p>
                      <p className="text-xs text-muted-foreground">Unresolved issues (24h)</p>
                    </div>
                    <ExternalLink className="size-4 text-muted-foreground" />
                  </Link>
                ) : (
                  <div className="flex items-center justify-between rounded-lg border p-4 opacity-50">
                    <div>
                      <p className="font-medium text-sm">Sentry</p>
                      <p className="text-xs text-muted-foreground">
                        Set SENTRY_ORG + SENTRY_PROJECT to enable
                      </p>
                    </div>
                  </div>
                )}
                <Link
                  href="https://vercel.com/dashboard"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between rounded-lg border p-4 hover:bg-muted/50 transition-colors"
                >
                  <div>
                    <p className="font-medium text-sm">Vercel</p>
                    <p className="text-xs text-muted-foreground">Deployments &amp; logs</p>
                  </div>
                  <ExternalLink className="size-4 text-muted-foreground" />
                </Link>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
