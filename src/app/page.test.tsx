import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import DashboardPage from "./page";

// recharts doesn't work in jsdom — mock the components that use it
vi.mock("@/components/payment-type-breakdown", () => ({
  PaymentTypeBreakdown: () => null,
}));
vi.mock("@/components/sub-brand-breakdown", () => ({
  SubBrandBreakdown: () => null,
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("DashboardPage", () => {
  it("shows an error banner when the bookings API fails", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: "Internal server error" }),
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByTestId("error-banner")).toBeInTheDocument();
    });
  });
});
