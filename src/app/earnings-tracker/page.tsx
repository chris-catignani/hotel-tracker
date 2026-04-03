"use client";

import { useState } from "react";
import { EarningsTrackerGrid } from "@/components/earnings-tracker/earnings-tracker-grid";
import { PageSpinner } from "@/components/ui/page-spinner";
import { useApiQuery } from "@/hooks/use-api-query";
import { ErrorBanner } from "@/components/ui/error-banner";

export default function EarningsTrackerPage() {
  const [filter, setFilter] = useState<"needs-attention" | "all">("needs-attention");

  const {
    data: bookings,
    loading,
    error,
    clearError,
  } = useApiQuery<unknown[]>(`/api/earnings-tracker?filter=${filter}`);

  return (
    <div className="flex flex-col flex-1 min-h-0 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Earnings Tracker</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setFilter("needs-attention")}
            className={`rounded-full px-3 py-1 text-sm font-medium ${
              filter === "needs-attention"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}
          >
            Needs Attention
          </button>
          <button
            onClick={() => setFilter("all")}
            className={`rounded-full px-3 py-1 text-sm font-medium ${
              filter === "all"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}
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
