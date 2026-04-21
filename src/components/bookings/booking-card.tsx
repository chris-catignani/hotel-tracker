"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { calculateNetCost, NetCostBooking } from "@/lib/net-cost";
import { formatCurrency, formatDate, formatCerts } from "@/lib/utils";
import { CalendarDays, Wallet, Coins, ScrollText } from "lucide-react";

interface BookingCardProps {
  booking: NetCostBooking & {
    id: string;
    property: { name: string };
    checkIn: string;
    checkOut: string;
    numNights: number;
    currency?: string;
    isFutureEstimate?: boolean;
    exchangeRateEstimated?: boolean;
    hotelChainSubBrand?: { name: string } | null;
    priceWatchBookings?: { priceWatch: { isEnabled: boolean } }[];
    accommodationType?: string;
  };
  onDelete?: (id: string) => void;
  showActions?: boolean;
}

export function BookingCard({ booking, onDelete, showActions = false }: BookingCardProps) {
  const netCost = calculateNetCost(booking);
  const exchangeRate = booking.lockedExchangeRate ? Number(booking.lockedExchangeRate) : 1;
  const usdTotalCost = Number(booking.totalCost) * exchangeRate;
  const today = new Date().toISOString().split("T")[0];
  const isFutureBooking = booking.checkIn.slice(0, 10) > today;

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
                {booking.property.name}
              </Link>
              <div className="flex flex-wrap gap-1 items-center text-xs text-muted-foreground">
                {booking.hotelChain ? (
                  <Badge variant="outline" className="font-normal px-1.5 py-0">
                    {booking.hotelChain.name}
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="font-normal px-1.5 py-0 text-muted-foreground"
                  >
                    Apartment / Rental
                  </Badge>
                )}
                {booking.hotelChainSubBrand && (
                  <span className="before:content-['·'] before:mr-1">
                    {booking.hotelChainSubBrand.name}
                  </span>
                )}
                {booking.accommodationType !== "apartment" &&
                  isFutureBooking &&
                  (booking.priceWatchBookings?.[0]?.priceWatch.isEnabled ? (
                    <Badge className="font-normal px-1.5 py-0 bg-green-100 text-green-700 border-green-200 hover:bg-green-100">
                      Watching Price
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="font-normal px-1.5 py-0 text-muted-foreground"
                    >
                      {booking.priceWatchBookings?.[0] ? "Price Watch Off" : "No Price Watch"}
                    </Badge>
                  ))}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div
                className={`text-lg font-bold ${netCost < usdTotalCost ? "text-green-600" : ""}`}
                data-testid="booking-card-net-night"
              >
                {formatCurrency(netCost / booking.numNights, "USD", {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })}
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
                  {usdTotalCost > 0 ? (
                    booking.currency !== "USD" ? (
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            className="underline decoration-dotted cursor-pointer hover:opacity-80"
                            data-testid="cost-popover-trigger"
                          >
                            {formatCurrency(usdTotalCost, "USD", {
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 0,
                            })}
                            {booking.isFutureEstimate ? " (est.)" : ""}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent
                          className="w-auto p-3 text-sm"
                          align="center"
                          data-testid="cost-popover-content"
                        >
                          <p className="font-medium">
                            {formatCurrency(Number(booking.totalCost), booking.currency, {
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 0,
                            })}
                          </p>
                          <p className="text-muted-foreground text-xs mt-0.5">
                            {booking.isFutureEstimate
                              ? "Estimated at current rate"
                              : "Locked at check-in rate"}
                          </p>
                          {booking.exchangeRateEstimated && (
                            <p className="text-amber-600 text-xs mt-0.5">
                              Historical rate unavailable — estimated using current rate
                            </p>
                          )}
                        </PopoverContent>
                      </Popover>
                    ) : (
                      `${formatCurrency(usdTotalCost, "USD", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                    )
                  ) : (
                    "—"
                  )}
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
