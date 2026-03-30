#!/usr/bin/env npx tsx
/**
 * Creates the Hotel Tracker observability dashboard in Axiom.
 *
 * Run (sourcing your local env):
 *   source .env.local && npx tsx scripts/create-axiom-dashboard.ts
 *
 * Idempotent: deletes the existing "Hotel Tracker" dashboard (if any) before creating.
 */

export {};

const AXIOM_API = "https://api.axiom.co/v2";

async function main() {
  const token = process.env.AXIOM_TOKEN;
  const dataset = process.env.NEXT_PUBLIC_AXIOM_DATASET;

  if (!token || !dataset) {
    console.error("Error: AXIOM_TOKEN and NEXT_PUBLIC_AXIOM_DATASET must be set");
    process.exit(1);
  }

  const q = (apl: string) => ({ apl: `['${dataset}'] | ${apl}` });

  interface Chart {
    id: string;
    type: string;
    name?: string;
    query?: { apl: string };
    [key: string]: unknown;
  }

  const charts: Chart[] = [
    // ─── API Health ───────────────────────────────────────────────────────────
    {
      id: "request-rate",
      type: "TimeSeries",
      name: "Request Rate by Status",
      query: q(
        "where isnotnull(['request.statusCode'])" +
          " | summarize count() by bin(_time, 5m), tostring(['request.statusCode'])"
      ),
    },
    {
      id: "error-rate",
      type: "TimeSeries",
      name: "Error Rate (4xx / 5xx)",
      query: q(
        "where isnotnull(['request.statusCode']) and toint(['request.statusCode']) >= 400" +
          " | summarize count() by bin(_time, 5m)"
      ),
    },
    {
      id: "p95-latency",
      type: "TimeSeries",
      name: "Response Time P95 (ms)",
      query: q(
        "where isnotnull(['request.durationMs'])" +
          " | summarize percentile(['request.durationMs'], 95) by bin(_time, 5m)"
      ),
    },
    {
      id: "top-endpoints",
      type: "TopK",
      name: "Top Endpoints (by Request Count)",
      query: q(
        "where isnotnull(['request.path']) and isnotnull(['request.statusCode'])" +
          " | summarize count() by tostring(['request.path'])" +
          " | top 10 by count_"
      ),
    },

    // ─── Email Ingestion ──────────────────────────────────────────────────────
    {
      id: "email-received-stat",
      type: "Statistic",
      name: "Emails Received",
      query: q("where message == 'inbound-email:received' | summarize count()"),
      colorScheme: "Blue",
      showChart: true,
    },
    {
      id: "email-booking-created-stat",
      type: "Statistic",
      name: "Bookings from Email",
      query: q("where message == 'inbound-email:booking_created' | summarize count()"),
      colorScheme: "Green",
      showChart: true,
    },
    {
      id: "email-parse-failed-stat",
      type: "Statistic",
      name: "Email Parse Failures",
      query: q("where message == 'inbound-email:parse_failed' | summarize count()"),
      colorScheme: "Red",
      showChart: true,
      errorThreshold: "Above",
      errorThresholdValue: "0",
    },
    {
      id: "email-outcomes",
      type: "TimeSeries",
      name: "Email Ingestion Outcomes Over Time",
      query: q(
        "where message startswith 'inbound-email:'" +
          " | summarize count() by bin(_time, 1h), message"
      ),
    },

    // ─── Cron Jobs ────────────────────────────────────────────────────────────
    {
      id: "exchange-rate-cron",
      type: "LogStream",
      name: "Exchange Rate Cron Runs",
      query: q(
        "where message == 'exchange_rates:refreshed'" +
          " | project _time, ['fields.currenciesUpdated'], ['fields.bookingsLocked']," +
          " ['fields.pointTypesRefreshed'], ['fields.bookingsReevaluated']"
      ),
    },
    {
      id: "cron-errors",
      type: "LogStream",
      name: "Cron / Worker Errors",
      query: q("where level == 'error' | project _time, message, ['fields.errorMessage'], source"),
    },

    // ─── Price Watch ──────────────────────────────────────────────────────────
    {
      id: "price-watch-run-log",
      type: "LogStream",
      name: "Price Watch Runs",
      query: q(
        "where message == 'price_watch:run_completed'" +
          " | project _time, ['fields.watchesChecked'], ['fields.snapshotsCreated']," +
          " ['fields.alertsSent'], ['fields.fetchErrors'], ['fields.durationMs']"
      ),
    },
    {
      id: "price-watch-snapshots",
      type: "TimeSeries",
      name: "Snapshots Created Over Time",
      query: q(
        "where message == 'price_watch:watch_completed'" +
          " | summarize sum(toint(['fields.snapshots'])) by bin(_time, 1d)"
      ),
    },
    {
      id: "price-watch-alerts-stat",
      type: "Statistic",
      name: "Price Drop Alerts Sent",
      query: q(
        "where message == 'price_watch:run_completed' | summarize sum(toint(['fields.alertsSent']))"
      ),
      colorScheme: "Green",
      showChart: true,
    },
    {
      id: "price-watch-errors-stat",
      type: "Statistic",
      name: "Price Watch Fetch Errors",
      query: q(
        "where message == 'price_watch:run_completed' | summarize sum(toint(['fields.fetchErrors']))"
      ),
      colorScheme: "Red",
      showChart: true,
      errorThreshold: "Above",
      errorThresholdValue: "0",
    },

    // ─── Bookings ─────────────────────────────────────────────────────────────
    {
      id: "bookings-over-time",
      type: "TimeSeries",
      name: "Bookings Created",
      query: q("where message == 'booking:created' | summarize count() by bin(_time, 1d)"),
    },
    {
      id: "bookings-by-method",
      type: "Pie",
      name: "Bookings by Ingestion Method",
      query: q(
        "where message == 'booking:created'" +
          " | summarize count() by tostring(['fields.ingestionMethod'])"
      ),
    },
  ];

  const layout = [
    // API Health
    { i: "request-rate", x: 0, y: 0, w: 12, h: 5 },
    { i: "error-rate", x: 0, y: 5, w: 6, h: 5 },
    { i: "p95-latency", x: 6, y: 5, w: 6, h: 5 },
    { i: "top-endpoints", x: 0, y: 10, w: 12, h: 5 },
    // Email Ingestion
    { i: "email-received-stat", x: 0, y: 15, w: 4, h: 4 },
    { i: "email-booking-created-stat", x: 4, y: 15, w: 4, h: 4 },
    { i: "email-parse-failed-stat", x: 8, y: 15, w: 4, h: 4 },
    { i: "email-outcomes", x: 0, y: 19, w: 12, h: 5 },
    // Cron Jobs
    { i: "exchange-rate-cron", x: 0, y: 24, w: 6, h: 5 },
    { i: "cron-errors", x: 6, y: 24, w: 6, h: 5 },
    // Price Watch
    { i: "price-watch-run-log", x: 0, y: 29, w: 12, h: 5 },
    { i: "price-watch-snapshots", x: 0, y: 34, w: 8, h: 5 },
    { i: "price-watch-alerts-stat", x: 8, y: 34, w: 2, h: 5 },
    { i: "price-watch-errors-stat", x: 10, y: 34, w: 2, h: 5 },
    // Bookings
    { i: "bookings-over-time", x: 0, y: 39, w: 8, h: 5 },
    { i: "bookings-by-method", x: 8, y: 39, w: 4, h: 5 },
  ];

  const dashboardDoc = {
    name: "Hotel Tracker",
    description: "API health, email ingestion, cron jobs, price watch, and booking activity",
    owner: "X-AXIOM-EVERYONE",
    charts,
    layout,
    refreshTime: 60,
    schemaVersion: 2,
    timeWindowStart: "qr-now-7d",
    timeWindowEnd: "qr-now",
  };

  // Delete existing dashboard with the same name (makes the script idempotent)
  const listRes = await fetch(`${AXIOM_API}/dashboards`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (listRes.ok) {
    const listBody = (await listRes.json()) as { dashboards?: { id?: string; name?: string }[] };
    const existing = listBody.dashboards?.find((d) => d.name === dashboardDoc.name);
    if (existing?.id) {
      console.log(`Deleting existing dashboard '${dashboardDoc.name}' (id: ${existing.id})...`);
      const deleteRes = await fetch(`${AXIOM_API}/dashboards/${existing.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!deleteRes.ok) {
        const bodyText = await deleteRes.text();
        console.error("Failed to delete existing dashboard", {
          dashboardName: dashboardDoc.name,
          status: deleteRes.status,
          body: bodyText,
        });
      }
    }
  }

  console.log(`Creating dashboard in dataset '${dataset}'...`);

  const res = await fetch(`${AXIOM_API}/dashboards`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ dashboard: dashboardDoc }),
  });

  const bodyText = await res.text();
  if (!res.ok) {
    console.error("Failed to create Axiom dashboard", { status: res.status, body: bodyText });
    process.exit(1);
  }
  const body = JSON.parse(bodyText) as {
    dashboard?: { id?: string };
    error?: string;
  };

  const baseUrl = process.env.NEXT_PUBLIC_AXIOM_DASHBOARD_URL ?? "https://app.axiom.co";
  console.log(`Dashboard created: ${baseUrl}/dashboards/${body.dashboard?.id}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
