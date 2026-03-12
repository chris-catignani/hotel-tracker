"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Eye, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { extractApiError } from "@/lib/client-error";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface PriceWatchBookingData {
  id: string; // PriceWatchBooking id
  priceWatchId: string;
  cashThreshold: string | number | null;
  awardThreshold: number | null;
  dateFlexibilityDays: number;
}

interface PriceSnapshotRoom {
  id: string;
  roomId: string;
  roomName: string;
  ratePlanCode: string;
  ratePlanName: string;
  cashPrice: string | number | null;
  cashCurrency: string;
  awardPrice: number | null;
  isRefundable: boolean;
  isCorporate: boolean;
}

interface PriceWatchData {
  id: string;
  isEnabled: boolean;
  lastCheckedAt: string | null;
  property: {
    id: string;
    name: string;
    chainPropertyId: string | null;
  };
  snapshots: {
    id: string;
    checkIn: string;
    checkOut: string;
    lowestRefundableCashPrice: string | number | null;
    lowestRefundableCashCurrency: string;
    lowestAwardPrice: number | null;
    fetchedAt: string;
    source: string;
    rooms: PriceSnapshotRoom[];
  }[];
}

interface BookingPriceWatchProps {
  bookingId: string;
  propertyId: string;
  hotelChainId: string;
  checkIn: string;
  checkOut: string;
  totalCost: string | number;
  currency: string;
  initialWatchBooking: PriceWatchBookingData | null;
}

export function BookingPriceWatch({
  bookingId,
  propertyId,
  checkIn,
  checkOut,
  totalCost,
  currency,
  initialWatchBooking,
}: BookingPriceWatchProps) {
  const [watch, setWatch] = useState<PriceWatchData | null>(null);
  const [, setWatchBooking] = useState<PriceWatchBookingData | null>(initialWatchBooking);

  // Load the full watch data on mount if a PriceWatchBooking exists
  const loadWatch = useCallback(async (priceWatchId: string) => {
    const res = await fetch(`/api/price-watches/${priceWatchId}`);
    if (res.ok) setWatch(await res.json());
  }, []);

  useEffect(() => {
    if (initialWatchBooking) loadWatch(initialWatchBooking.priceWatchId);
  }, [initialWatchBooking, loadWatch]);
  const [cashThreshold, setCashThreshold] = useState(
    initialWatchBooking?.cashThreshold != null
      ? String(Number(initialWatchBooking.cashThreshold))
      : ""
  );
  const [awardThreshold, setAwardThreshold] = useState(
    initialWatchBooking?.awardThreshold != null ? String(initialWatchBooking.awardThreshold) : ""
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRooms, setShowRooms] = useState(false);

  const isEnabled = watch?.isEnabled ?? false;
  const latestSnapshot = watch?.snapshots?.[0] ?? null;

  const handleToggle = async (enabled: boolean) => {
    setError(null);
    setSaving(true);
    try {
      if (!watch) {
        // Enable — create the watch
        const res = await fetch("/api/price-watches", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            propertyId,
            isEnabled: true,
            bookingId,
            cashThreshold: cashThreshold ? Number(cashThreshold) : null,
            awardThreshold: awardThreshold ? Number(awardThreshold) : null,
          }),
        });
        if (!res.ok) throw new Error(await extractApiError(res, "Request failed"));
        const data = await res.json();
        setWatch(data);
        const pwb = data.bookings?.find((b: { bookingId: string }) => b.bookingId === bookingId);
        if (pwb) setWatchBooking(pwb);
      } else {
        // Toggle existing watch
        const res = await fetch(`/api/price-watches/${watch.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isEnabled: enabled }),
        });
        if (!res.ok) throw new Error(await extractApiError(res, "Request failed"));
        const data = await res.json();
        setWatch(data);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update price watch");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveThresholds = async () => {
    if (!watch) return;
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/price-watches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId,
          isEnabled: watch.isEnabled,
          bookingId,
          cashThreshold: cashThreshold ? Number(cashThreshold) : null,
          awardThreshold: awardThreshold ? Number(awardThreshold) : null,
        }),
      });
      if (!res.ok) throw new Error(await extractApiError(res, "Request failed"));
      const data = await res.json();
      setWatch(data);
      const pwb = data.bookings?.find((b: { bookingId: string }) => b.bookingId === bookingId);
      if (pwb) setWatchBooking(pwb);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save thresholds");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Eye className="h-4 w-4" />
          Price Watch
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Enable toggle */}
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-sm">Monitor prices for this stay</p>
            <p className="text-xs text-muted-foreground">
              {formatDate(checkIn)} → {formatDate(checkOut)}
            </p>
          </div>
          <Switch
            checked={isEnabled}
            onCheckedChange={handleToggle}
            disabled={saving}
            data-testid="price-watch-toggle"
          />
        </div>

        {isEnabled && (
          <>
            {/* Spirit code hint */}
            {watch && !watch.property.chainPropertyId && (
              <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
                <strong>Hyatt Spirit Code needed</strong> — find it in the property URL on hyatt.com
                (e.g. <code>hyatt.com/.../{"{spiritCode}"}</code>) and ask your admin to set it on
                this property.
              </div>
            )}

            {/* Alert thresholds */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Cash alert below ({currency})</Label>
                <Input
                  type="number"
                  placeholder={`e.g. ${Number(totalCost).toFixed(0)}`}
                  value={cashThreshold}
                  onChange={(e) => setCashThreshold(e.target.value)}
                  className="h-8 text-sm"
                  data-testid="cash-threshold-input"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Award alert below (pts)</Label>
                <Input
                  type="number"
                  placeholder="e.g. 25000"
                  value={awardThreshold}
                  onChange={(e) => setAwardThreshold(e.target.value)}
                  className="h-8 text-sm"
                  data-testid="award-threshold-input"
                />
              </div>
            </div>

            <Button size="sm" variant="outline" onClick={handleSaveThresholds} disabled={saving}>
              {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
              Save Thresholds
            </Button>

            {/* Latest snapshot */}
            {latestSnapshot && (
              <div className="rounded-md border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium">Latest Prices</p>
                  <Badge variant="outline" className="text-xs">
                    {latestSnapshot.source}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Lowest Cash (refundable)</p>
                    <p className="font-medium" data-testid="latest-cash-price">
                      {latestSnapshot.lowestRefundableCashPrice != null
                        ? formatCurrency(
                            Number(latestSnapshot.lowestRefundableCashPrice),
                            latestSnapshot.lowestRefundableCashCurrency
                          )
                        : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Lowest Award</p>
                    <p className="font-medium" data-testid="latest-award-price">
                      {latestSnapshot.lowestAwardPrice != null
                        ? `${latestSnapshot.lowestAwardPrice.toLocaleString()} pts`
                        : "—"}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Checked {formatDate(latestSnapshot.fetchedAt)}
                </p>

                {latestSnapshot.rooms.length > 0 && (
                  <div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-between h-7 text-xs px-2"
                      onClick={() => setShowRooms((v) => !v)}
                      data-testid="toggle-room-rates"
                    >
                      All room rates ({latestSnapshot.rooms.length})
                      {showRooms ? (
                        <ChevronUp className="h-3 w-3" />
                      ) : (
                        <ChevronDown className="h-3 w-3" />
                      )}
                    </Button>
                    {showRooms && (
                      <div className="mt-2 overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-xs">Room</TableHead>
                              <TableHead className="text-xs">Rate Plan</TableHead>
                              <TableHead className="text-xs">Refundable</TableHead>
                              <TableHead className="text-xs text-right">Cash</TableHead>
                              <TableHead className="text-xs text-right">Award</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {latestSnapshot.rooms.map((room) => (
                              <TableRow key={room.id} data-testid="room-rate-row">
                                <TableCell className="text-xs py-1.5">{room.roomName}</TableCell>
                                <TableCell className="text-xs py-1.5">
                                  <span>{room.ratePlanName}</span>
                                  {room.isCorporate && (
                                    <Badge
                                      variant="outline"
                                      className="ml-1 text-[10px] px-1 py-0 border-blue-300 text-blue-700"
                                    >
                                      Corp
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell className="text-xs py-1.5">
                                  {room.awardPrice != null ? (
                                    <span className="text-muted-foreground">—</span>
                                  ) : room.isRefundable ? (
                                    <Badge
                                      variant="outline"
                                      className="text-[10px] px-1 py-0 border-green-300 text-green-700"
                                    >
                                      Yes
                                    </Badge>
                                  ) : (
                                    <Badge
                                      variant="outline"
                                      className="text-[10px] px-1 py-0 border-orange-300 text-orange-700"
                                    >
                                      No
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell className="text-xs py-1.5 text-right">
                                  {room.cashPrice != null
                                    ? formatCurrency(Number(room.cashPrice), room.cashCurrency)
                                    : "—"}
                                </TableCell>
                                <TableCell className="text-xs py-1.5 text-right">
                                  {room.awardPrice != null
                                    ? `${room.awardPrice.toLocaleString()} pts`
                                    : "—"}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {watch && !latestSnapshot && (
              <p className="text-xs text-muted-foreground">
                No price data yet. Click &ldquo;Check Now&rdquo; to fetch current prices.
              </p>
            )}

            {watch?.lastCheckedAt && (
              <p className="text-xs text-muted-foreground">
                Last auto-checked: {formatDate(watch.lastCheckedAt)}
              </p>
            )}
          </>
        )}

        {error && <p className="text-xs text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
