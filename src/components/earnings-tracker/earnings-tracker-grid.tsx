"use client";

import React from "react";
import type { EarningsTrackerBooking } from "@/app/api/earnings-tracker/route";
import { EarningsTrackerCell } from "./earnings-tracker-cell";
import { PostingStatus, BookingPartnershipEarnStatus } from "@/lib/types";
import {
  formatLoyaltyValue,
  formatCardRewardValue,
  formatPortalValue,
  formatPromotionValue,
  formatPartnershipValue,
  formatCardBenefitValue,
  formatPerkValue,
  statusColorClass,
  statusIcon,
} from "@/lib/earnings-tracker-utils";
import { cn, formatDate, pruneHotelName } from "@/lib/utils";

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface EarningsTrackerGridProps {
  bookings: EarningsTrackerBooking[];
  expandedCells: Record<string, string | null>;
  setExpandedCells: React.Dispatch<React.SetStateAction<Record<string, string | null>>>;
  patchBookingStatus: (
    bookingId: string,
    field: "loyaltyPostingStatus" | "cardRewardPostingStatus" | "portalCashbackPostingStatus",
    current: PostingStatus
  ) => Promise<void>;
  patchPromotionStatus: (bookingId: string, bpId: string, current: PostingStatus) => Promise<void>;
  patchCardBenefitStatus: (
    bookingId: string,
    bcbId: string,
    current: PostingStatus
  ) => Promise<void>;
  patchBenefitStatus: (
    bookingId: string,
    benefitId: string,
    current: PostingStatus
  ) => Promise<void>;
  patchPartnershipStatus: (
    bookingId: string,
    partnershipEarnId: string,
    existingRecord: BookingPartnershipEarnStatus | null,
    current: PostingStatus
  ) => Promise<void>;
}

export function EarningsTrackerGrid({
  bookings,
  expandedCells,
  setExpandedCells,
  patchBookingStatus,
  patchPromotionStatus,
  patchCardBenefitStatus,
  patchBenefitStatus,
  patchPartnershipStatus,
}: EarningsTrackerGridProps) {
  function toggleCell(bookingId: string, column: string) {
    setExpandedCells((prev) => ({
      ...prev,
      [bookingId]: prev[bookingId] === column ? null : column,
    }));
  }

  return (
    <div className="flex-1 min-h-0 overflow-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b text-xs text-muted-foreground font-semibold sticky top-0 bg-background z-20">
            <th className="text-left px-3 py-2 whitespace-nowrap sticky left-0 bg-background z-10">
              Booking
            </th>
            <th className="px-2 py-2 whitespace-nowrap">Portal</th>
            <th className="px-2 py-2 whitespace-nowrap">Promotions</th>
            <th className="px-2 py-2 whitespace-nowrap">Loyalty</th>
            <th className="px-2 py-2 whitespace-nowrap">Card Rewards</th>
            <th className="px-2 py-2 whitespace-nowrap">Card Benefits</th>
            <th className="px-2 py-2 whitespace-nowrap">Partners</th>
            <th className="px-2 py-2 whitespace-nowrap">Perks</th>
          </tr>
        </thead>
        <tbody>
          {bookings.map((booking) => {
            const expandedCol = expandedCells[booking.id] ?? null;
            return renderBookingRows(
              booking,
              expandedCol,
              toggleCell,
              patchBookingStatus,
              patchPromotionStatus,
              patchCardBenefitStatus,
              patchBenefitStatus,
              patchPartnershipStatus
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// Column index map for aligning expansion rows under their header
const COL_OFFSET: Record<string, number> = {
  promotions: 2,
  cardBenefits: 5,
  partners: 6,
  perks: 7,
};
const TOTAL_COLS = 8;

function renderBookingRows(
  booking: any,
  expandedCol: string | null,
  toggleCell: (bookingId: string, col: string) => void,
  patchBookingStatus: any,
  patchPromotionStatus: any,
  patchCardBenefitStatus: any,
  patchBenefitStatus: any,
  patchPartnershipStatus: any
) {
  const bps = (booking.bookingPromotions ?? []).filter((bp: any) => Number(bp.appliedValue) > 0);
  const cardBenefits = booking.bookingCardBenefits ?? [];
  const perks = booking.benefits ?? [];
  const partnerships = booking.partnershipEarns ?? [];

  // Loyalty cell
  const loyaltyValue = formatLoyaltyValue(
    booking.loyaltyPointsEarned,
    booking.hotelChain?.pointType?.shortName ?? null
  );
  const effectiveLoyaltyStatus: PostingStatus = booking.loyaltyPostingStatus ?? "pending";
  const loyaltyCell =
    loyaltyValue && booking.loyaltyPointsEarned > 0 ? (
      <EarningsTrackerCell
        kind="single"
        value={loyaltyValue}
        status={effectiveLoyaltyStatus}
        testId={`loyalty-cell-${booking.id}`}
        onCycle={() =>
          patchBookingStatus(booking.id, "loyaltyPostingStatus", effectiveLoyaltyStatus)
        }
      />
    ) : (
      <EarningsTrackerCell kind="empty" />
    );

  // Card reward cell
  const cardRewardCell =
    booking.cardRewardPostingStatus != null && booking.userCreditCard && booking.cardReward > 0 ? (
      <EarningsTrackerCell
        kind="single"
        value={formatCardRewardValue(
          booking.cardReward ?? 0,
          booking.userCreditCard.creditCard.rewardType,
          booking.userCreditCard.creditCard.pointType?.shortName ?? null,
          booking.userCreditCard.creditCard.pointType?.usdCentsPerPoint ?? null
        )}
        status={booking.cardRewardPostingStatus}
        testId={`card-reward-cell-${booking.id}`}
        onCycle={() =>
          patchBookingStatus(booking.id, "cardRewardPostingStatus", booking.cardRewardPostingStatus)
        }
      />
    ) : (
      <EarningsTrackerCell kind="empty" />
    );

  // Portal cell
  const isPointsPortal = booking.shoppingPortal?.rewardType === "points";
  const portalBasis =
    (booking.portalCashbackOnTotal
      ? Number(booking.totalCost || 0)
      : Number(booking.pretaxCost || 0)) * Number(booking.lockedExchangeRate || 1);
  const rawPortalPoints = isPointsPortal
    ? Number(booking.portalCashbackRate || 0) * portalBasis
    : null;
  const portalCell =
    booking.portalCashbackPostingStatus != null && booking.portalCashback > 0 ? (
      <EarningsTrackerCell
        kind="single"
        value={formatPortalValue(
          booking.portalCashback ?? 0,
          booking.shoppingPortal?.rewardType ?? null,
          booking.shoppingPortal?.pointType?.shortName ?? null,
          booking.shoppingPortal?.pointType?.usdCentsPerPoint ?? null,
          rawPortalPoints
        )}
        status={booking.portalCashbackPostingStatus}
        testId={`portal-cashback-cell-${booking.id}`}
        onCycle={() =>
          patchBookingStatus(
            booking.id,
            "portalCashbackPostingStatus",
            booking.portalCashbackPostingStatus
          )
        }
      />
    ) : (
      <EarningsTrackerCell kind="empty" />
    );

  // Promotions cell
  const promoCell =
    bps.length === 0 ? (
      <EarningsTrackerCell kind="empty" />
    ) : bps.length === 1 ? (
      <EarningsTrackerCell
        kind="single"
        value={formatPromotionValue(bps[0], booking.hotelChain?.pointType?.shortName ?? null)}
        status={bps[0].postingStatus}
        testId={`promotions-cell-${booking.id}`}
        onCycle={() => patchPromotionStatus(booking.id, bps[0].id, bps[0].postingStatus)}
      />
    ) : (
      <EarningsTrackerCell
        kind="multi"
        testId={`promotions-cell-${booking.id}`}
        postedCount={bps.filter((bp: any) => bp.postingStatus === "posted").length}
        total={bps.length}
        worstStatus={worstStatus(bps.map((bp: any) => bp.postingStatus))}
        isExpanded={expandedCol === "promotions"}
        onToggle={() => toggleCell(booking.id, "promotions")}
      />
    );

  // Card benefits cell
  const cardBenefitCell =
    cardBenefits.length === 0 ? (
      <EarningsTrackerCell kind="empty" />
    ) : cardBenefits.length === 1 ? (
      <EarningsTrackerCell
        kind="single"
        value={formatCardBenefitValue(Number(cardBenefits[0].appliedValue))}
        status={cardBenefits[0].postingStatus}
        testId={`card-benefit-cell-${booking.id}`}
        onCycle={() =>
          patchCardBenefitStatus(booking.id, cardBenefits[0].id, cardBenefits[0].postingStatus)
        }
      />
    ) : (
      <EarningsTrackerCell
        kind="multi"
        postedCount={cardBenefits.filter((b: any) => b.postingStatus === "posted").length}
        total={cardBenefits.length}
        worstStatus={worstStatus(cardBenefits.map((b: any) => b.postingStatus))}
        isExpanded={expandedCol === "cardBenefits"}
        onToggle={() => toggleCell(booking.id, "cardBenefits")}
      />
    );

  // Perks cell
  const perkCell =
    perks.length === 0 ? (
      <EarningsTrackerCell kind="empty" />
    ) : perks.length === 1 ? (
      <EarningsTrackerCell
        kind="single"
        value={formatPerkValue(
          perks[0].benefitType,
          perks[0].dollarValue != null ? Number(perks[0].dollarValue) : null,
          perks[0].label,
          booking.currency ?? "USD"
        )}
        status={perks[0].postingStatus}
        testId={`perks-cell-${booking.id}`}
        onCycle={() => patchBenefitStatus(booking.id, perks[0].id, perks[0].postingStatus)}
      />
    ) : (
      <EarningsTrackerCell
        kind="multi"
        postedCount={perks.filter((p: any) => p.postingStatus === "posted").length}
        total={perks.length}
        worstStatus={worstStatus(perks.map((p: any) => p.postingStatus))}
        isExpanded={expandedCol === "perks"}
        onToggle={() => toggleCell(booking.id, "perks")}
      />
    );

  // Partners cell
  const partnerCell =
    partnerships.length === 0 ? (
      <EarningsTrackerCell kind="empty" />
    ) : partnerships.length === 1 ? (
      (() => {
        const earn = partnerships[0];
        const statusRecord =
          booking.bookingPartnershipEarnStatuses?.find(
            (s: any) => s.partnershipEarnId === earn.id
          ) ?? null;
        const currentStatus: PostingStatus = statusRecord?.postingStatus ?? "pending";
        return (
          <EarningsTrackerCell
            kind="single"
            value={formatPartnershipValue(earn.pointsEarned ?? 0, earn.pointTypeName ?? "")}
            status={currentStatus}
            onCycle={() => patchPartnershipStatus(booking.id, earn.id, statusRecord, currentStatus)}
            testId={`partners-cell-${booking.id}`}
          />
        );
      })()
    ) : (
      <EarningsTrackerCell
        kind="multi"
        postedCount={
          partnerships.filter((e: any) => {
            const s = booking.bookingPartnershipEarnStatuses?.find(
              (sr: any) => sr.partnershipEarnId === e.id
            );
            return s?.postingStatus === "posted";
          }).length
        }
        total={partnerships.length}
        worstStatus={worstStatus(
          partnerships.map((e: any) => {
            const s = booking.bookingPartnershipEarnStatuses?.find(
              (sr: any) => sr.partnershipEarnId === e.id
            );
            return s?.postingStatus ?? "pending";
          })
        )}
        isExpanded={expandedCol === "partners"}
        onToggle={() => toggleCell(booking.id, "partners")}
      />
    );

  const rows = [];

  // Main booking row
  rows.push(
    <tr key={booking.id} className="border-t">
      <td className="px-3 py-2 whitespace-nowrap sticky left-0 bg-background z-10">
        <a href={`/bookings/${booking.id}`} className="font-semibold hover:underline">
          {pruneHotelName(booking.property?.name ?? "Unknown")}
        </a>
        <div className="text-xs text-muted-foreground">
          {formatDate(booking.checkIn)}--{formatDate(booking.checkOut)}
        </div>
      </td>
      <td className="px-2 py-2 text-center">{portalCell}</td>
      <td
        className={cn(
          "px-2 py-2 text-center relative",
          expandedCol === "promotions" && "bg-primary/5"
        )}
      >
        {promoCell}
        {expandedCol === "promotions" && (
          <div className="absolute bottom-[-10px] left-1/2 -translate-x-1/2 w-0 h-0 border-l-[8px] border-r-[8px] border-t-[10px] border-l-transparent border-r-transparent border-t-primary z-10" />
        )}
      </td>
      <td className="px-2 py-2 text-center">{loyaltyCell}</td>
      <td className="px-2 py-2 text-center">{cardRewardCell}</td>
      <td
        className={cn(
          "px-2 py-2 text-center relative",
          expandedCol === "cardBenefits" && "bg-primary/5"
        )}
      >
        {cardBenefitCell}
        {expandedCol === "cardBenefits" && (
          <div className="absolute bottom-[-10px] left-1/2 -translate-x-1/2 w-0 h-0 border-l-[8px] border-r-[8px] border-t-[10px] border-l-transparent border-r-transparent border-t-primary z-10" />
        )}
      </td>
      <td
        className={cn(
          "px-2 py-2 text-center relative",
          expandedCol === "partners" && "bg-primary/5"
        )}
      >
        {partnerCell}
        {expandedCol === "partners" && (
          <div className="absolute bottom-[-10px] left-1/2 -translate-x-1/2 w-0 h-0 border-l-[8px] border-r-[8px] border-t-[10px] border-l-transparent border-r-transparent border-t-primary z-10" />
        )}
      </td>
      <td
        className={cn("px-2 py-2 text-center relative", expandedCol === "perks" && "bg-primary/5")}
      >
        {perkCell}
        {expandedCol === "perks" && (
          <div className="absolute bottom-[-10px] left-1/2 -translate-x-1/2 w-0 h-0 border-l-[8px] border-r-[8px] border-t-[10px] border-l-transparent border-r-transparent border-t-primary z-10" />
        )}
      </td>
    </tr>
  );

  function expandRow(
    key: string,
    col: string,
    title: string,
    content: React.ReactNode,
    testId?: string
  ) {
    const offset = COL_OFFSET[col] ?? 0;
    return (
      <tr key={key} data-testid={testId} className="border-t-2 border-primary">
        <td className="sticky left-0 bg-background z-10" />
        {offset > 1 && <td colSpan={offset - 1} className="bg-muted/20" />}
        <td colSpan={TOTAL_COLS - offset} className="px-3 pb-3 pt-1 bg-muted/20">
          <div className="text-[10px] font-bold uppercase tracking-wide text-primary mb-2">
            {title}
          </div>
          <div className="flex flex-col gap-1">{content}</div>
        </td>
      </tr>
    );
  }

  // Expansion rows
  if (expandedCol === "promotions" && bps.length > 1) {
    rows.push(
      expandRow(
        `${booking.id}-promotions-expand`,
        "promotions",
        `Promotions — ${booking.property?.name}`,
        bps.map((bp: any) => (
          <div
            key={bp.id}
            className="flex items-center gap-2 px-2 py-1 rounded bg-card cursor-pointer w-fit"
            onClick={() => patchPromotionStatus(booking.id, bp.id, bp.postingStatus)}
          >
            <span className="font-medium text-xs">{bp.promotion?.name}</span>
            <span
              className={cn(
                "rounded px-2 py-0.5 text-xs font-semibold whitespace-nowrap",
                statusColorClass(bp.postingStatus)
              )}
            >
              {formatPromotionValue(bp, booking.hotelChain?.pointType?.shortName ?? null)} ·{" "}
              {statusIcon(bp.postingStatus)}
            </span>
          </div>
        )),
        `promotions-expand-${booking.id}`
      )
    );
  }

  if (expandedCol === "cardBenefits" && cardBenefits.length > 1) {
    rows.push(
      expandRow(
        `${booking.id}-cardBenefits-expand`,
        "cardBenefits",
        `Card Benefits — ${booking.property?.name}`,
        cardBenefits.map((bcb: any) => (
          <div
            key={bcb.id}
            className="flex items-center gap-2 px-2 py-1 rounded bg-card cursor-pointer w-fit"
            onClick={() => patchCardBenefitStatus(booking.id, bcb.id, bcb.postingStatus)}
          >
            <span className="font-medium text-xs">{bcb.cardBenefit?.description}</span>
            <span
              className={cn(
                "rounded px-2 py-0.5 text-xs font-semibold whitespace-nowrap",
                statusColorClass(bcb.postingStatus)
              )}
            >
              {formatCardBenefitValue(Number(bcb.appliedValue))} · {statusIcon(bcb.postingStatus)}
            </span>
          </div>
        ))
      )
    );
  }

  if (expandedCol === "perks" && perks.length > 1) {
    rows.push(
      expandRow(
        `${booking.id}-perks-expand`,
        "perks",
        `Perks — ${booking.property?.name}`,
        perks.map((p: any) => (
          <div
            key={p.id}
            className="flex items-center gap-2 px-2 py-1 rounded bg-card cursor-pointer w-fit"
            onClick={() => patchBenefitStatus(booking.id, p.id, p.postingStatus)}
          >
            <span className="font-medium text-xs">
              {formatPerkValue(p.benefitType, null, p.label)}
            </span>
            <span
              className={cn(
                "rounded px-2 py-0.5 text-xs font-semibold whitespace-nowrap",
                statusColorClass(p.postingStatus)
              )}
            >
              {formatPerkValue(
                p.benefitType,
                p.dollarValue != null ? Number(p.dollarValue) : null,
                p.label,
                booking.currency ?? "USD"
              )}{" "}
              · {statusIcon(p.postingStatus)}
            </span>
          </div>
        ))
      )
    );
  }

  if (expandedCol === "partners" && partnerships.length > 1) {
    rows.push(
      expandRow(
        `${booking.id}-partners-expand`,
        "partners",
        `Partnership Earns — ${booking.property?.name}`,
        partnerships.map((earn: any) => {
          const statusRecord =
            booking.bookingPartnershipEarnStatuses?.find(
              (s: any) => s.partnershipEarnId === earn.id
            ) ?? null;
          const currentStatus: PostingStatus = statusRecord?.postingStatus ?? "pending";
          return (
            <div
              key={earn.id}
              className="flex items-center gap-2 px-2 py-1 rounded bg-card cursor-pointer w-fit"
              onClick={() =>
                patchPartnershipStatus(booking.id, earn.id, statusRecord, currentStatus)
              }
            >
              <span className="font-medium text-xs">{earn.name}</span>
              <span
                className={cn(
                  "rounded px-2 py-0.5 text-xs font-semibold whitespace-nowrap",
                  statusColorClass(currentStatus)
                )}
              >
                {formatPartnershipValue(earn.pointsEarned ?? 0, earn.pointTypeName ?? "")} ·{" "}
                {statusIcon(currentStatus)}
              </span>
            </div>
          );
        })
      )
    );
  }

  return rows;
}

function worstStatus(statuses: PostingStatus[]): PostingStatus {
  if (statuses.includes("failed")) return "failed";
  if (statuses.includes("pending")) return "pending";
  return "posted";
}
