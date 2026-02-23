"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { calculateNetCost, NetCostBooking } from "@/lib/net-cost";
import { formatCurrency, formatDate, formatCerts } from "@/lib/utils";
import { CalendarDays, Building2, Wallet, Coins, ScrollText } from "lucide-react";

interface BookingCardProps {
  booking: NetCostBooking & {
    id: number;
    propertyName: string;
    checkIn: string;
    checkOut: string;
    numNights: number;
    hotelChainSubBrand?: { name: string } | null;
  };
  onDelete?: (id: number) => void;
  showActions?: boolean;
}

export function BookingCard({ booking, onDelete, showActions = false }: BookingCardProps) {
  const netCost = calculateNetCost(booking);
  const totalCost = Number(booking.totalCost);

  return (
    <Card className="overflow-hidden" data-testid={`booking-card-${booking.id}`}>
      <CardContent className="p-0">
        <div className="p-4 space-y-3">
          {/* Header: Property & Chain */}
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1">
              <Link
                href={`/bookings/${booking.id}`}
                className="font-bold hover:underline line-clamp-1"
                data-testid="booking-card-property"
              >
                {booking.propertyName}
              </Link>
              <div className="flex flex-wrap gap-1 items-center text-xs text-muted-foreground">
                <Badge variant="outline" className="font-normal px-1.5 py-0">
                  {booking.hotelChain.name}
                </Badge>
                {booking.hotelChainSubBrand && (
                  <span className="before:content-['·'] before:mr-1">
                    {booking.hotelChainSubBrand.name}
                  </span>
                )}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div
                className={`text-lg font-bold ${netCost < totalCost ? "text-green-600" : ""}`}
                data-testid="booking-card-net-night"
              >
                {formatCurrency(netCost / booking.numNights)}
                <span className="text-[10px] font-normal text-muted-foreground block leading-none">
                  per night (net)
                </span>
              </div>
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm">
            <div className="flex items-center gap-2">
              <CalendarDays className="size-3.5 text-muted-foreground shrink-0" />
              <div className="leading-tight">
                <span className="text-xs text-muted-foreground block">Dates</span>
                <span className="font-medium whitespace-nowrap">
                  {formatDate(booking.checkIn)} ({booking.numNights}n)
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Wallet className="size-3.5 text-muted-foreground shrink-0" />
              <div className="leading-tight">
                <span className="text-xs text-muted-foreground block">Cash Spent</span>
                <span className="font-medium">
                  {totalCost > 0 ? formatCurrency(totalCost) : "—"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Coins className="size-3.5 text-muted-foreground shrink-0" />
              <div className="leading-tight">
                <span className="text-xs text-muted-foreground block">Points Redeemed</span>
                <span className="font-medium">
                  {booking.pointsRedeemed ? `${booking.pointsRedeemed.toLocaleString()} pts` : "—"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <ScrollText className="size-3.5 text-muted-foreground shrink-0" />
              <div className="leading-tight">
                <span className="text-xs text-muted-foreground block">Certificates</span>
                <span className="font-medium">{formatCerts(booking.certificates, true)}</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          {showActions && (
            <div className="pt-2 flex gap-2">
              <Link href={`/bookings/${booking.id}`} className="flex-1">
                <Button variant="outline" size="sm" className="w-full">
                  View Details
                </Button>
              </Link>
              {onDelete && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => onDelete(booking.id)}
                  data-testid="booking-card-delete"
                >
                  Delete
                </Button>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
