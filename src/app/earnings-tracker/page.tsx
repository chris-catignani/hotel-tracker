"use client";

import { useState, useEffect } from "react";
import { EarningsTrackerGrid } from "@/components/earnings-tracker/earnings-tracker-grid";
import { EarningsTrackerMobileList } from "@/components/earnings-tracker/earnings-tracker-mobile-list";
import { PageSpinner } from "@/components/ui/page-spinner";
import { useApiQuery } from "@/hooks/use-api-query";
import { ErrorBanner } from "@/components/ui/error-banner";
import { apiFetch } from "@/lib/api-fetch";
import { toast } from "sonner";
import { PostingStatus, BookingPartnershipEarnStatus } from "@/lib/types";
import { nextPostingStatus } from "@/lib/earnings-tracker-utils";
import type { EarningsTrackerBooking } from "@/app/api/earnings-tracker/route";
import type { EarningsTrackerGridProps } from "@/components/earnings-tracker/earnings-tracker-grid";

/* eslint-disable @typescript-eslint/no-explicit-any */

export default function EarningsTrackerPage() {
  const [filter, setFilter] = useState<"needs-attention" | "all">("needs-attention");
  const [expandedCells, setExpandedCells] = useState<Record<string, string | null>>({});
  const [bookings, setBookings] = useState<EarningsTrackerBooking[]>([]);

  const {
    data: fetchedBookings,
    loading,
    error,
    clearError,
  } = useApiQuery<EarningsTrackerBooking[]>(`/api/earnings-tracker?filter=${filter}`);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (fetchedBookings) setBookings(fetchedBookings);
  }, [fetchedBookings]);

  async function patchBookingStatus(
    bookingId: string,
    field: "loyaltyPostingStatus" | "cardRewardPostingStatus" | "portalCashbackPostingStatus",
    current: PostingStatus
  ) {
    const next = nextPostingStatus(current);
    const res = await apiFetch(`/api/bookings/${bookingId}`, {
      method: "PATCH",
      body: { [field]: next },
    });
    if (!res.ok) {
      toast.error("Failed to update status");
      return;
    }
    setBookings((prev) => prev.map((b) => (b.id === bookingId ? { ...b, [field]: next } : b)));
  }

  async function patchPromotionStatus(bookingId: string, bpId: string, current: PostingStatus) {
    const next = nextPostingStatus(current);
    const res = await apiFetch(`/api/booking-promotions/${bpId}`, {
      method: "PATCH",
      body: { postingStatus: next },
    });
    if (!res.ok) {
      toast.error("Failed to update status");
      return;
    }
    setBookings((prev) =>
      prev.map((b) =>
        b.id === bookingId
          ? {
              ...b,
              bookingPromotions: b.bookingPromotions.map((bp: any) =>
                bp.id === bpId ? { ...bp, postingStatus: next } : bp
              ),
            }
          : b
      )
    );
  }

  async function patchCardBenefitStatus(bookingId: string, bcbId: string, current: PostingStatus) {
    const next = nextPostingStatus(current);
    const res = await apiFetch(`/api/booking-card-benefits/${bcbId}`, {
      method: "PATCH",
      body: { postingStatus: next },
    });
    if (!res.ok) {
      toast.error("Failed to update status");
      return;
    }
    setBookings((prev) =>
      prev.map((b) =>
        b.id === bookingId
          ? {
              ...b,
              bookingCardBenefits: b.bookingCardBenefits.map((bcb: any) =>
                bcb.id === bcbId ? { ...bcb, postingStatus: next } : bcb
              ),
            }
          : b
      )
    );
  }

  async function patchBenefitStatus(bookingId: string, benefitId: string, current: PostingStatus) {
    const next = nextPostingStatus(current);
    const res = await apiFetch(`/api/booking-benefits/${benefitId}`, {
      method: "PATCH",
      body: { postingStatus: next },
    });
    if (!res.ok) {
      toast.error("Failed to update status");
      return;
    }
    setBookings((prev) =>
      prev.map((b) =>
        b.id === bookingId
          ? {
              ...b,
              benefits: b.benefits.map((ben: any) =>
                ben.id === benefitId ? { ...ben, postingStatus: next } : ben
              ),
            }
          : b
      )
    );
  }

  async function patchPartnershipStatus(
    bookingId: string,
    partnershipEarnId: string,
    existingRecord: BookingPartnershipEarnStatus | null,
    current: PostingStatus
  ) {
    const next = nextPostingStatus(current);
    let res;
    if (!existingRecord) {
      res = await apiFetch("/api/booking-partnership-earn-statuses", {
        method: "POST",
        body: { bookingId, partnershipEarnId, postingStatus: next },
      });
    } else {
      res = await apiFetch(`/api/booking-partnership-earn-statuses/${existingRecord.id}`, {
        method: "PATCH",
        body: { postingStatus: next },
      });
    }
    if (!res.ok) {
      toast.error("Failed to update status");
      return;
    }
    const updated = res.data;
    setBookings((prev) =>
      prev.map((b) => {
        if (b.id !== bookingId) return b;
        const existing = b.bookingPartnershipEarnStatuses.find(
          (s: any) => s.partnershipEarnId === partnershipEarnId
        );
        return {
          ...b,
          bookingPartnershipEarnStatuses: existing
            ? b.bookingPartnershipEarnStatuses.map((s: any) =>
                s.partnershipEarnId === partnershipEarnId ? updated : s
              )
            : [...b.bookingPartnershipEarnStatuses, updated],
        };
      })
    );
  }

  const sharedProps: EarningsTrackerGridProps = {
    bookings,
    expandedCells,
    setExpandedCells,
    patchBookingStatus,
    patchPromotionStatus,
    patchCardBenefitStatus,
    patchBenefitStatus,
    patchPartnershipStatus,
  };

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

      {loading ? (
        <PageSpinner />
      ) : (
        <>
          {/* Mobile view */}
          <div className="md:hidden">
            <EarningsTrackerMobileList {...sharedProps} />
          </div>
          {/* Desktop view */}
          <div
            className="hidden md:flex md:flex-col md:flex-1 md:min-h-0"
            data-testid="earnings-tracker-desktop"
          >
            <EarningsTrackerGrid {...sharedProps} />
          </div>
        </>
      )}
    </div>
  );
}
