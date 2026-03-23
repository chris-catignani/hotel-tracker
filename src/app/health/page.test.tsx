import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import HealthPage from "./page";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function makeHealthResponse(overrides: Record<string, unknown> = {}) {
  return {
    githubActions: {
      ci: {
        status: "completed",
        conclusion: "success",
        createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
        htmlUrl: "https://github.com/example/runs/1",
        runNumber: 42,
        durationMs: 2 * 60 * 1000 + 34 * 1000,
      },
      priceWatchRefresh: {
        status: "completed",
        conclusion: "failure",
        createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
        htmlUrl: "https://github.com/example/runs/2",
        runNumber: 10,
        durationMs: 8 * 60 * 1000,
      },
    },
    exchangeRates: {
      lastUpdatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      isStale: false,
      currencyCount: 45,
    },
    priceWatches: {
      lastCheckedAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
      isStale: false,
      enabledCount: 12,
      disabledCount: 3,
      snapshotsLast24h: 47,
    },
    sentryUrl: "https://sentry.io/organizations/myorg/issues/",
    ...overrides,
  };
}

function mockSuccess(data = makeHealthResponse()) {
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => data,
  });
}

function mockError() {
  mockFetch.mockResolvedValue({
    ok: false,
    json: async () => ({ error: "Forbidden" }),
  });
}

describe("HealthPage", () => {
  it("renders GitHub Actions statuses", async () => {
    mockSuccess();
    render(<HealthPage />);

    await waitFor(() => expect(screen.getByText("CI")).toBeInTheDocument());

    expect(screen.getByText("CI")).toBeInTheDocument();
    expect(screen.getAllByText("Price Watch Refresh")).toHaveLength(2); // appears in both sections
    expect(screen.getByText("Passing")).toBeInTheDocument();
    expect(screen.getByText("Failing")).toBeInTheDocument();
  });

  it("renders run numbers and view links", async () => {
    mockSuccess();
    render(<HealthPage />);

    await waitFor(() => expect(screen.getByText("#42")).toBeInTheDocument());

    expect(screen.getByText("#10")).toBeInTheDocument();
    const viewLinks = screen.getAllByText("View");
    expect(viewLinks).toHaveLength(2);
    expect(viewLinks[0].closest("a")).toHaveAttribute("href", "https://github.com/example/runs/1");
  });

  it("renders background job health with fresh status", async () => {
    mockSuccess();
    render(<HealthPage />);

    await waitFor(() => expect(screen.getAllByText("Fresh")).toHaveLength(2));

    expect(screen.getByText("Exchange Rates")).toBeInTheDocument();
    expect(screen.getByText("45 currencies")).toBeInTheDocument();
    expect(screen.getByText(/12 enabled/)).toBeInTheDocument();
  });

  it("renders stale badge when exchange rates are stale", async () => {
    mockSuccess(
      makeHealthResponse({
        exchangeRates: {
          lastUpdatedAt: new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString(),
          isStale: true,
          currencyCount: 45,
        },
      })
    );
    render(<HealthPage />);

    await waitFor(() => expect(screen.getByText("Stale")).toBeInTheDocument());
  });

  it("renders Sentry link when sentryUrl is provided", async () => {
    mockSuccess();
    render(<HealthPage />);

    await waitFor(() => expect(screen.getByText("Sentry")).toBeInTheDocument());

    expect(screen.getByText("Sentry").closest("a")).toHaveAttribute(
      "href",
      "https://sentry.io/organizations/myorg/issues/"
    );
  });

  it("renders Sentry as disabled when sentryUrl is null", async () => {
    mockSuccess(makeHealthResponse({ sentryUrl: null }));
    render(<HealthPage />);

    await waitFor(() => expect(screen.getByText("Sentry")).toBeInTheDocument());

    // Should not be a link when sentryUrl is null
    expect(screen.getByText("Sentry").closest("a")).toBeNull();
  });

  it("renders Vercel link", async () => {
    mockSuccess();
    render(<HealthPage />);

    await waitFor(() => expect(screen.getByText("Vercel")).toBeInTheDocument());

    expect(screen.getByText("Vercel").closest("a")).toHaveAttribute(
      "href",
      "https://vercel.com/dashboard"
    );
  });

  it("shows error message on API failure", async () => {
    mockError();
    render(<HealthPage />);

    await waitFor(() => expect(screen.getByText("Forbidden")).toBeInTheDocument());
  });

  it("re-fetches on Refresh button click", async () => {
    mockSuccess();
    const user = userEvent.setup();
    render(<HealthPage />);

    await waitFor(() => expect(screen.getByText("CI")).toBeInTheDocument());
    expect(mockFetch).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: /refresh/i }));
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
  });
});
