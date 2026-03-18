export const STALE_EXCHANGE_RATE_HOURS = 25;
export const STALE_PRICE_WATCH_HOURS = 25;

export function timeAgo(isoString: string): string {
  const ms = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}m ${remaining}s`;
}

export type WorkflowStatus = "passing" | "failing" | "running" | "cancelled" | "unknown";

export interface WorkflowRun {
  status: string;
  conclusion: string | null;
  createdAt: string;
  updatedAt: string;
  htmlUrl: string;
  runNumber: number;
  durationMs: number | null;
}

export function getWorkflowStatus(run: WorkflowRun | null): WorkflowStatus {
  if (!run) return "unknown";
  if (run.status === "in_progress" || run.status === "queued") return "running";
  if (run.conclusion === "success") return "passing";
  if (run.conclusion === "failure") return "failing";
  if (run.conclusion === "cancelled") return "cancelled";
  return "unknown";
}

export function isExchangeRateStale(lastUpdatedAt: string | null): boolean {
  if (!lastUpdatedAt) return true;
  return (
    Date.now() - new Date(lastUpdatedAt).getTime() > STALE_EXCHANGE_RATE_HOURS * 60 * 60 * 1000
  );
}

export function isPriceWatchStale(lastCheckedAt: string | null, enabledCount: number): boolean {
  if (enabledCount === 0) return false;
  if (!lastCheckedAt) return true;
  return Date.now() - new Date(lastCheckedAt).getTime() > STALE_PRICE_WATCH_HOURS * 60 * 60 * 1000;
}
