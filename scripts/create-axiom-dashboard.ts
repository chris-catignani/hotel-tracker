#!/usr/bin/env npx tsx
/**
 * Creates the Hotel Tracker observability dashboard in Axiom.
 *
 * Run (sourcing your local env):
 *   source .env.local && npx tsx scripts/create-axiom-dashboard.ts
 *
 * Re-running will fail with 409 if the dashboard already exists.
 * To recreate, delete the existing "Hotel Tracker" dashboard in Axiom first.
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
        "where isnotnull(request.statusCode)" +
          " | summarize count() by bin(_time, 5m), tostring(request.statusCode)"
      ),
    },
    {
      id: "error-rate",
      type: "TimeSeries",
      name: "Error Rate (4xx / 5xx)",
      query: q(
        "where isnotnull(request.statusCode) and toint(request.statusCode) >= 400" +
          " | summarize count() by bin(_time, 5m)"
      ),
    },
    {
      id: "p95-latency",
      type: "TimeSeries",
      name: "Response Time P95 (ms)",
      query: q(
        "where isnotnull(request.durationMs)" +
          " | summarize percentiles(request.durationMs, 95) by bin(_time, 5m)"
      ),
    },
    {
      id: "top-endpoints",
      type: "TopK",
      name: "Top Endpoints (by Request Count)",
      query: q(
        "where isnotnull(request.path) and isnotnull(request.statusCode)" +
          " | summarize count() by tostring(request.path)" +
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
          " | project _time, fields.currenciesUpdated, fields.bookingsLocked," +
          " fields.pointTypesRefreshed, fields.bookingsReevaluated"
      ),
    },
    {
      id: "cron-errors",
      type: "LogStream",
      name: "Cron / Worker Errors",
      query: q("where level == 'error' | project _time, message, fields.errorMessage, source"),
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
          " | summarize count() by tostring(fields.ingestionMethod)"
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
    // Bookings
    { i: "bookings-over-time", x: 0, y: 29, w: 8, h: 5 },
    { i: "bookings-by-method", x: 8, y: 29, w: 4, h: 5 },
  ];

  const dashboardDoc = {
    name: "Hotel Tracker",
    description: "API health, email ingestion, cron jobs, and booking activity",
    owner: "X-AXIOM-EVERYONE",
    charts,
    layout,
    refreshTime: 60,
    schemaVersion: 2,
    timeWindowStart: "qr-now-7d",
    timeWindowEnd: "qr-now",
  };

  console.log(`Creating dashboard in dataset '${dataset}'...`);

  const res = await fetch(`${AXIOM_API}/dashboards`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ dashboard: dashboardDoc }),
  });

  const body = (await res.json()) as { dashboard?: { uid?: string }; error?: string };

  if (!res.ok) {
    console.error(`Failed (${res.status}):`, JSON.stringify(body, null, 2));
    process.exit(1);
  }

  const baseUrl = process.env.NEXT_PUBLIC_AXIOM_URL ?? "https://app.axiom.co";
  console.log(`Dashboard created: ${baseUrl}/dashboards/${body.dashboard?.uid}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
