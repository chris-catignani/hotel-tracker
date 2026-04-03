"use client";

import React, { useState } from "react";
import { cn, formatDate, pruneHotelName } from "@/lib/utils";
import {
  formatLoyaltyValue,
  formatCardRewardValue,
  formatPortalValue,
  formatPromotionValue,
  formatCardBenefitValue,
  formatPerkValue,
  formatPartnershipValue,
  statusColorClass,
} from "@/lib/earnings-tracker-utils";
import { PostingStatus } from "@/lib/types";
import type { EarningsTrackerGridProps } from "./earnings-tracker-grid";
import type { EarningsTrackerBooking } from "@/app/api/earnings-tracker/route";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface EarningsItem {
  key: string;
  category: string;
  categoryTestId: string;
  name: string;
  value: string;
  status: PostingStatus;
  onCycle: () => void;
}

function getEarningsItems(
  booking: EarningsTrackerBooking,
  patchBookingStatus: EarningsTrackerGridProps["patchBookingStatus"],
  patchPromotionStatus: EarningsTrackerGridProps["patchPromotionStatus"],
  patchCardBenefitStatus: EarningsTrackerGridProps["patchCardBenefitStatus"],
  patchBenefitStatus: EarningsTrackerGridProps["patchBenefitStatus"],
  patchPartnershipStatus: EarningsTrackerGridProps["patchPartnershipStatus"]
): EarningsItem[] {
  const items: EarningsItem[] = [];
  const shortName = (booking as any).hotelChain?.pointType?.shortName ?? null;

  // Portal
  if (booking.portalCashbackPostingStatus != null && booking.portalCashback > 0) {
    const isPointsPortal = (booking as any).shoppingPortal?.rewardType === "points";
    const portalBasis =
      (booking.portalCashbackOnTotal
        ? Number(booking.totalCost || 0)
        : Number(booking.pretaxCost || 0)) * Number(booking.lockedExchangeRate || 1);
    const rawPortalPoints = isPointsPortal
      ? Number(booking.portalCashbackRate || 0) * portalBasis
      : null;
    items.push({
      key: `${booking.id}-portal`,
      category: "Portal",
      categoryTestId: "portal",
      name: (booking as any).shoppingPortal?.name ?? "Portal",
      value: formatPortalValue(
        booking.portalCashback,
        (booking as any).shoppingPortal?.rewardType ?? null,
        (booking as any).shoppingPortal?.pointType?.shortName ?? null,
        (booking as any).shoppingPortal?.pointType?.usdCentsPerPoint ?? null,
        rawPortalPoints
      ),
      status: booking.portalCashbackPostingStatus,
      onCycle: () =>
        patchBookingStatus(
          booking.id,
          "portalCashbackPostingStatus",
          booking.portalCashbackPostingStatus!
        ),
    });
  }

  // Loyalty
  const loyaltyValue = formatLoyaltyValue(booking.loyaltyPointsEarned, shortName);
  if (loyaltyValue && booking.loyaltyPointsEarned != null && booking.loyaltyPointsEarned > 0) {
    items.push({
      key: `${booking.id}-loyalty`,
      category: "Loyalty",
      categoryTestId: "loyalty",
      name: (booking as any).hotelChain?.loyaltyProgram ?? "Loyalty",
      value: loyaltyValue,
      status: booking.loyaltyPostingStatus ?? "pending",
      onCycle: () =>
        patchBookingStatus(
          booking.id,
          "loyaltyPostingStatus",
          booking.loyaltyPostingStatus ?? "pending"
        ),
    });
  }

  // Card reward
  if (
    booking.cardRewardPostingStatus != null &&
    booking.userCreditCard &&
    (booking as any).cardReward > 0
  ) {
    const cc = booking.userCreditCard.creditCard;
    items.push({
      key: `${booking.id}-card`,
      category: "Card",
      categoryTestId: "card",
      name: cc.name,
      value: formatCardRewardValue(
        (booking as any).cardReward,
        cc.rewardType,
        cc.pointType?.shortName ?? null,
        cc.pointType?.usdCentsPerPoint != null ? Number(cc.pointType.usdCentsPerPoint) : null
      ),
      status: booking.cardRewardPostingStatus,
      onCycle: () =>
        patchBookingStatus(booking.id, "cardRewardPostingStatus", booking.cardRewardPostingStatus!),
    });
  }

  // Promotions
  const bps = ((booking as any).bookingPromotions ?? []).filter(
    (bp: any) => Number(bp.appliedValue) > 0
  );
  for (const bp of bps) {
    items.push({
      key: `${booking.id}-promo-${bp.id}`,
      category: "Promo",
      categoryTestId: "promo",
      name: bp.promotion?.name ?? "Promotion",
      value: formatPromotionValue(bp, shortName),
      status: bp.postingStatus,
      onCycle: () => patchPromotionStatus(booking.id, bp.id, bp.postingStatus),
    });
  }

  // Card benefits
  for (const bcb of (booking as any).bookingCardBenefits ?? []) {
    items.push({
      key: `${booking.id}-cardbenefit-${bcb.id}`,
      category: "Benefit",
      categoryTestId: "benefit",
      name: bcb.cardBenefit?.description ?? "Card Benefit",
      value: formatCardBenefitValue(Number(bcb.appliedValue)),
      status: bcb.postingStatus,
      onCycle: () => patchCardBenefitStatus(booking.id, bcb.id, bcb.postingStatus),
    });
  }

  // Perks
  for (const p of (booking as any).benefits ?? []) {
    items.push({
      key: `${booking.id}-perk-${p.id}`,
      category: "Perk",
      categoryTestId: "perk",
      name: formatPerkValue(p.benefitType, null, p.label),
      value: formatPerkValue(
        p.benefitType,
        p.dollarValue != null ? Number(p.dollarValue) : null,
        p.label,
        booking.currency ?? "USD"
      ),
      status: p.postingStatus,
      onCycle: () => patchBenefitStatus(booking.id, p.id, p.postingStatus),
    });
  }

  // Partnerships
  for (const earn of (booking as any).partnershipEarns ?? []) {
    const statusRecord =
      (booking as any).bookingPartnershipEarnStatuses?.find(
        (s: any) => s.partnershipEarnId === earn.id
      ) ?? null;
    const currentStatus: PostingStatus = statusRecord?.postingStatus ?? "pending";
    items.push({
      key: `${booking.id}-partner-${earn.id}`,
      category: "Partner",
      categoryTestId: "partner",
      name: earn.name ?? "Partnership",
      value: formatPartnershipValue(earn.pointsEarned ?? 0, earn.pointTypeName ?? ""),
      status: currentStatus,
      onCycle: () => patchPartnershipStatus(booking.id, earn.id, statusRecord, currentStatus),
    });
  }

  return items;
}

interface SummaryBadge {
  label: string;
  variant: "posted" | "pending" | "failed";
}

function getSummaryBadge(items: { status: PostingStatus }[]): SummaryBadge | null {
  if (items.length === 0) return null;
  const failedCount = items.filter((i) => i.status === "failed").length;
  if (failedCount > 0) return { label: `${failedCount} failed`, variant: "failed" };
  const pendingCount = items.filter((i) => i.status === "pending").length;
  if (pendingCount > 0) return { label: `${pendingCount} pending`, variant: "pending" };
  return { label: "all posted", variant: "posted" };
}

const BADGE_CLASSES: Record<SummaryBadge["variant"], string> = {
  posted: "bg-green-900 text-green-200",
  pending: "bg-amber-900 text-amber-200",
  failed: "bg-red-900 text-red-200",
};

export function EarningsTrackerMobileList({
  bookings,
  patchBookingStatus,
  patchPromotionStatus,
  patchCardBenefitStatus,
  patchBenefitStatus,
  patchPartnershipStatus,
}: EarningsTrackerGridProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {bookings.map((booking) => {
        const items = getEarningsItems(
          booking,
          patchBookingStatus,
          patchPromotionStatus,
          patchCardBenefitStatus,
          patchBenefitStatus,
          patchPartnershipStatus
        );
        const badge = getSummaryBadge(items);
        const isExpanded = expandedIds.has(booking.id);

        return (
          <div key={booking.id} className="rounded-lg border bg-card">
            {/* Collapsed header */}
            <button
              className="w-full flex items-center justify-between px-4 py-3 text-left"
              onClick={() => toggle(booking.id)}
              data-testid={`mobile-booking-row-${booking.id}`}
            >
              <div className="min-w-0">
                <div className="font-semibold text-sm truncate">
                  {pruneHotelName(booking.property?.name ?? "Unknown")}
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatDate((booking as any).checkIn)} – {formatDate((booking as any).checkOut)}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-3">
                {badge && (
                  <span
                    className={cn(
                      "rounded px-2 py-0.5 text-xs font-semibold",
                      BADGE_CLASSES[badge.variant]
                    )}
                    data-testid={`mobile-summary-badge-${booking.id}`}
                  >
                    {badge.label}
                  </span>
                )}
                <span className="text-muted-foreground text-sm">{isExpanded ? "▾" : "▸"}</span>
              </div>
            </button>

            {/* Expanded earnings list */}
            {isExpanded && (
              <div
                className="border-t px-4 py-2 flex flex-col gap-1"
                data-testid={`mobile-earnings-list-${booking.id}`}
              >
                {items.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-1">No trackable earnings</p>
                ) : (
                  items.map((item) => (
                    <div
                      key={item.key}
                      className="flex items-center gap-2 py-1 border-b last:border-b-0"
                    >
                      <span
                        className="text-[10px] font-semibold uppercase text-muted-foreground w-14 shrink-0"
                        data-testid={`mobile-category-label-${item.categoryTestId}`}
                      >
                        {item.category}
                      </span>
                      <span className="text-xs text-foreground flex-1 truncate">{item.name}</span>
                      <button
                        className={cn(
                          "rounded px-2 py-0.5 text-xs font-semibold shrink-0",
                          statusColorClass(item.status)
                        )}
                        onClick={item.onCycle}
                        data-testid={`mobile-status-badge-${booking.id}-${item.categoryTestId}`}
                      >
                        {item.value}
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
