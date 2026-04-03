"use client";

import { useState } from "react";
import { EarningsTrackerGrid } from "@/components/earnings-tracker/earnings-tracker-grid";
import { PageSpinner } from "@/components/ui/page-spinner";
import { useApiQuery } from "@/hooks/use-api-query";
import { ErrorBanner } from "@/components/ui/error-banner";
import type { EarningsTrackerBooking } from "@/app/api/earnings-tracker/route";

export default function EarningsTrackerPage() {
  const [filter, setFilter] = useState<"needs-attention" | "all">("needs-attention");

  const {
    data: bookings,
    loading,
    error,
    clearError,
  } = useApiQuery<EarningsTrackerBooking[]>(`/api/earnings-tracker?filter=${filter}`);

  return (
    <div className="flex flex-col flex-1 min-h-0 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Earnings Tracker</h1>
        <div className="flex shrink-0 rounded-lg border p-0.5 gap-0.5">
          <button
            onClick={() => setFilter("needs-attention")}
            data-testid="earnings-filter-needs-attention"
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${filter === "needs-attention" ? "bg-background shadow-sm font-medium" : "text-muted-foreground hover:text-foreground"}`}
          >
            Needs Attention
          </button>
          <button
            onClick={() => setFilter("all")}
            data-testid="earnings-filter-all"
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${filter === "all" ? "bg-background shadow-sm font-medium" : "text-muted-foreground hover:text-foreground"}`}
          >
            All Bookings
          </button>
        </div>
      </div>

      <ErrorBanner
        error={error ? "Failed to load earnings tracker data. Please try again." : null}
        onDismiss={clearError}
      />

      {loading ? <PageSpinner /> : <EarningsTrackerGrid initialBookings={bookings ?? []} />}
    </div>
  );
}
