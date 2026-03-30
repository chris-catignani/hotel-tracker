"use client";

import { useState } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-fetch";
import { PostingStatusCell } from "./posting-status-cell";
import { PostingStatus, BookingPartnershipEarnStatus } from "@/lib/types";
import {
  nextPostingStatus,
  formatLoyaltyValue,
  formatCardRewardValue,
  formatPortalValue,
  formatPromotionValue,
  formatPartnershipValue,
  formatCardBenefitValue,
  formatPerkValue,
  statusColorClass,
  statusLabel,
} from "@/lib/posting-status-utils";
import { cn, formatDate } from "@/lib/utils";

/* eslint-disable @typescript-eslint/no-explicit-any */

export function PostingStatusGrid({ initialBookings }: { initialBookings: any[] }) {
  const [bookings, setBookings] = useState(initialBookings);
  const [expandedCells, setExpandedCells] = useState<Record<string, string | null>>({});

  function toggleCell(bookingId: string, column: string) {
    setExpandedCells((prev) => ({
      ...prev,
      [bookingId]: prev[bookingId] === column ? null : column,
    }));
  }

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

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b text-xs uppercase text-muted-foreground font-semibold">
            <th className="text-left px-3 py-2 whitespace-nowrap">Booking</th>
            <th className="px-2 py-2 whitespace-nowrap">Loyalty</th>
            <th className="px-2 py-2 whitespace-nowrap">Promotions</th>
            <th className="px-2 py-2 whitespace-nowrap">Card Reward</th>
            <th className="px-2 py-2 whitespace-nowrap">Portal</th>
            <th className="px-2 py-2 whitespace-nowrap">Partners</th>
            <th className="px-2 py-2 whitespace-nowrap">Card Benefits</th>
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
  const bps = booking.bookingPromotions ?? [];
  const cardBenefits = booking.bookingCardBenefits ?? [];
  const perks = booking.benefits ?? [];
  const partnerships = booking.partnershipEarns ?? [];

  // Loyalty cell
  const loyaltyValue = formatLoyaltyValue(
    booking.loyaltyPointsEarned,
    booking.hotelChain?.loyaltyProgram ?? null
  );
  const loyaltyCell =
    loyaltyValue && booking.loyaltyPostingStatus != null ? (
      <PostingStatusCell
        kind="single"
        value={loyaltyValue}
        status={booking.loyaltyPostingStatus}
        testId={`loyalty-cell-${booking.id}`}
        onCycle={() =>
          patchBookingStatus(booking.id, "loyaltyPostingStatus", booking.loyaltyPostingStatus)
        }
      />
    ) : (
      <PostingStatusCell kind="empty" />
    );

  // Card reward cell
  const cardRewardCell =
    booking.cardRewardPostingStatus != null && booking.userCreditCard ? (
      <PostingStatusCell
        kind="single"
        value={formatCardRewardValue(
          booking.cardReward ?? 0,
          booking.userCreditCard.creditCard.rewardType,
          booking.userCreditCard.creditCard.pointType?.name ?? null
        )}
        status={booking.cardRewardPostingStatus}
        onCycle={() =>
          patchBookingStatus(booking.id, "cardRewardPostingStatus", booking.cardRewardPostingStatus)
        }
      />
    ) : (
      <PostingStatusCell kind="empty" />
    );

  // Portal cell
  const portalCell =
    booking.portalCashbackPostingStatus != null ? (
      <PostingStatusCell
        kind="single"
        value={formatPortalValue(booking.portalCashback ?? 0)}
        status={booking.portalCashbackPostingStatus}
        onCycle={() =>
          patchBookingStatus(
            booking.id,
            "portalCashbackPostingStatus",
            booking.portalCashbackPostingStatus
          )
        }
      />
    ) : (
      <PostingStatusCell kind="empty" />
    );

  // Promotions cell
  const promoCell =
    bps.length === 0 ? (
      <PostingStatusCell kind="empty" />
    ) : bps.length === 1 ? (
      <PostingStatusCell
        kind="single"
        value={formatPromotionValue(bps[0])}
        status={bps[0].postingStatus}
        testId={`promotions-cell-${booking.id}`}
        onCycle={() => patchPromotionStatus(booking.id, bps[0].id, bps[0].postingStatus)}
      />
    ) : (
      <PostingStatusCell
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
      <PostingStatusCell kind="empty" />
    ) : cardBenefits.length === 1 ? (
      <PostingStatusCell
        kind="single"
        value={formatCardBenefitValue(Number(cardBenefits[0].appliedValue))}
        status={cardBenefits[0].postingStatus}
        onCycle={() =>
          patchCardBenefitStatus(booking.id, cardBenefits[0].id, cardBenefits[0].postingStatus)
        }
      />
    ) : (
      <PostingStatusCell
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
      <PostingStatusCell kind="empty" />
    ) : perks.length === 1 ? (
      <PostingStatusCell
        kind="single"
        value={formatPerkValue(
          perks[0].benefitType,
          perks[0].dollarValue != null ? Number(perks[0].dollarValue) : null,
          perks[0].label
        )}
        status={perks[0].postingStatus}
        onCycle={() => patchBenefitStatus(booking.id, perks[0].id, perks[0].postingStatus)}
      />
    ) : (
      <PostingStatusCell
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
      <PostingStatusCell kind="empty" />
    ) : partnerships.length === 1 ? (
      (() => {
        const earn = partnerships[0];
        const statusRecord =
          booking.bookingPartnershipEarnStatuses?.find(
            (s: any) => s.partnershipEarnId === earn.id
          ) ?? null;
        const currentStatus: PostingStatus = statusRecord?.postingStatus ?? "pending";
        return (
          <PostingStatusCell
            kind="single"
            value={formatPartnershipValue(earn.earnedValue ?? 0, earn.pointTypeName ?? "")}
            status={currentStatus}
            onCycle={() => patchPartnershipStatus(booking.id, earn.id, statusRecord, currentStatus)}
          />
        );
      })()
    ) : (
      <PostingStatusCell
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
      <td className="px-3 py-2 whitespace-nowrap">
        <div className="font-semibold">{booking.property?.name ?? "Unknown"}</div>
        <div className="text-xs text-muted-foreground">
          {formatDate(booking.checkIn)}--{formatDate(booking.checkOut)}
        </div>
      </td>
      <td className={cn("px-2 py-2 text-center", expandedCol === "loyalty" && "bg-primary/5")}>
        {loyaltyCell}
      </td>
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
      <td className="px-2 py-2 text-center">{cardRewardCell}</td>
      <td className="px-2 py-2 text-center">{portalCell}</td>
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
        className={cn("px-2 py-2 text-center relative", expandedCol === "perks" && "bg-primary/5")}
      >
        {perkCell}
        {expandedCol === "perks" && (
          <div className="absolute bottom-[-10px] left-1/2 -translate-x-1/2 w-0 h-0 border-l-[8px] border-r-[8px] border-t-[10px] border-l-transparent border-r-transparent border-t-primary z-10" />
        )}
      </td>
    </tr>
  );

  // Expansion rows
  if (expandedCol === "promotions" && bps.length > 1) {
    rows.push(
      <tr
        key={`${booking.id}-promotions-expand`}
        data-testid={`promotions-expand-${booking.id}`}
        className="border-t-2 border-primary"
      >
        <td colSpan={8} className="px-3 pb-3 pt-1 bg-muted/20">
          <div className="text-[10px] font-bold uppercase tracking-wide text-primary mb-2">
            Promotions -- {booking.property?.name}
          </div>
          <div className="flex flex-col gap-1">
            {bps.map((bp: any) => (
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
                  {formatPromotionValue(bp)} · {statusLabel(bp.postingStatus)}
                </span>
              </div>
            ))}
          </div>
        </td>
      </tr>
    );
  }

  if (expandedCol === "cardBenefits" && cardBenefits.length > 1) {
    rows.push(
      <tr key={`${booking.id}-cardBenefits-expand`} className="border-t-2 border-primary">
        <td colSpan={8} className="px-3 pb-3 pt-1 bg-muted/20">
          <div className="text-[10px] font-bold uppercase tracking-wide text-primary mb-2">
            Card Benefits -- {booking.property?.name}
          </div>
          <div className="flex flex-col gap-1">
            {cardBenefits.map((bcb: any) => (
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
                  {formatCardBenefitValue(Number(bcb.appliedValue))} ·{" "}
                  {statusLabel(bcb.postingStatus)}
                </span>
              </div>
            ))}
          </div>
        </td>
      </tr>
    );
  }

  if (expandedCol === "perks" && perks.length > 1) {
    rows.push(
      <tr key={`${booking.id}-perks-expand`} className="border-t-2 border-primary">
        <td colSpan={8} className="px-3 pb-3 pt-1 bg-muted/20">
          <div className="text-[10px] font-bold uppercase tracking-wide text-primary mb-2">
            Perks -- {booking.property?.name}
          </div>
          <div className="flex flex-col gap-1">
            {perks.map((p: any) => (
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
                    p.label
                  )}{" "}
                  · {statusLabel(p.postingStatus)}
                </span>
              </div>
            ))}
          </div>
        </td>
      </tr>
    );
  }

  if (expandedCol === "partners" && partnerships.length > 1) {
    rows.push(
      <tr key={`${booking.id}-partners-expand`} className="border-t-2 border-primary">
        <td colSpan={8} className="px-3 pb-3 pt-1 bg-muted/20">
          <div className="text-[10px] font-bold uppercase tracking-wide text-primary mb-2">
            Partnership Earns -- {booking.property?.name}
          </div>
          <div className="flex flex-col gap-1">
            {partnerships.map((earn: any) => {
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
                    {formatPartnershipValue(earn.earnedValue ?? 0, earn.pointTypeName ?? "")} ·{" "}
                    {statusLabel(currentStatus)}
                  </span>
                </div>
              );
            })}
          </div>
        </td>
      </tr>
    );
  }

  return rows;
}

function worstStatus(statuses: PostingStatus[]): PostingStatus {
  if (statuses.includes("failed")) return "failed";
  if (statuses.includes("pending")) return "pending";
  return "posted";
}
