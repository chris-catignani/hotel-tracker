"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RefreshCw, Loader2, Trash2 } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ErrorBanner } from "@/components/ui/error-banner";
import { extractApiError } from "@/lib/client-error";

interface PriceSnapshot {
  cashPrice: string | number | null;
  cashCurrency: string;
  awardPrice: number | null;
  fetchedAt: string;
  source: string;
}

interface WatchBooking {
  id: string;
  bookingId: string;
  cashThreshold: string | number | null;
  awardThreshold: number | null;
  booking: {
    id: string;
    checkIn: string;
    checkOut: string;
    numNights: number;
    totalCost: string | number;
    currency: string;
    hotelChain: { name: string };
  };
}

interface PriceWatch {
  id: string;
  isEnabled: boolean;
  lastCheckedAt: string | null;
  property: {
    id: string;
    name: string;
    chainPropertyId: string | null;
    countryCode: string | null;
    city: string | null;
  };
  bookings: WatchBooking[];
  snapshots: PriceSnapshot[];
}

export default function PriceWatchPage() {
  const [watches, setWatches] = useState<PriceWatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadWatches = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/price-watches");
    if (res.ok) {
      const data = await res.json();
      setWatches(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadWatches();
  }, [loadWatches]);

  const handleToggle = async (watch: PriceWatch, enabled: boolean) => {
    setTogglingId(watch.id);
    setError(null);
    const res = await fetch(`/api/price-watches/${watch.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isEnabled: enabled }),
    });
    if (res.ok) {
      const updated = await res.json();
      setWatches((prev) => prev.map((w) => (w.id === watch.id ? updated : w)));
    } else {
      setError(await extractApiError(res, "Failed to update price watch."));
    }
    setTogglingId(null);
  };

  const handleRefresh = async (watch: PriceWatch) => {
    setRefreshingId(watch.id);
    setError(null);
    const res = await fetch(`/api/price-watches/${watch.id}/refresh`, { method: "POST" });
    if (res.ok) {
      const watchRes = await fetch(`/api/price-watches/${watch.id}`);
      if (watchRes.ok) {
        const updated = await watchRes.json();
        setWatches((prev) => prev.map((w) => (w.id === watch.id ? updated : w)));
      }
    } else {
      setError(await extractApiError(res, "Failed to refresh price watch."));
    }
    setRefreshingId(null);
  };

  const handleDelete = async (watch: PriceWatch) => {
    if (!confirm(`Stop watching prices for ${watch.property.name}?`)) return;
    setDeletingId(watch.id);
    setError(null);
    const res = await fetch(`/api/price-watches/${watch.id}`, { method: "DELETE" });
    if (res.ok) {
      setWatches((prev) => prev.filter((w) => w.id !== watch.id));
    } else {
      setError(await extractApiError(res, "Failed to delete price watch."));
    }
    setDeletingId(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div>
        <h1 className="text-2xl font-bold">Price Watch</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Monitor hotel rates and get alerted when prices drop below your thresholds.
        </p>
      </div>

      <ErrorBanner error={error} onDismiss={() => setError(null)} />

      {watches.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p>No price watches yet.</p>
            <p className="text-sm mt-1">
              Enable price watching from the{" "}
              <Link href="/bookings" className="underline">
                booking detail page
              </Link>
              .
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Mobile: card layout */}
          <div className="md:hidden space-y-4">
            {watches.map((watch) => {
              const latest = watch.snapshots[0];
              const upcomingBookings = watch.bookings.filter(
                (b) => new Date(b.booking.checkIn) >= new Date()
              );
              return (
                <Card key={watch.id} data-testid={`price-watch-card-${watch.id}`}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-sm">{watch.property.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {[watch.property.city, watch.property.countryCode]
                            .filter(Boolean)
                            .join(", ")}
                        </p>
                      </div>
                      <Switch
                        checked={watch.isEnabled}
                        onCheckedChange={(v) => handleToggle(watch, v)}
                        disabled={togglingId === watch.id}
                      />
                    </div>

                    {upcomingBookings.length > 0 && (
                      <div className="text-xs text-muted-foreground">
                        {upcomingBookings.map((b) => (
                          <Link
                            key={b.bookingId}
                            href={`/bookings/${b.bookingId}`}
                            className="underline block"
                          >
                            {formatDate(b.booking.checkIn)} → {formatDate(b.booking.checkOut)}
                          </Link>
                        ))}
                      </div>
                    )}

                    {latest ? (
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground">Cash</p>
                          <p className="font-medium">
                            {latest.cashPrice != null
                              ? formatCurrency(Number(latest.cashPrice), latest.cashCurrency)
                              : "—"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Award</p>
                          <p className="font-medium">
                            {latest.awardPrice != null
                              ? `${latest.awardPrice.toLocaleString()} pts`
                              : "—"}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">No price data yet</p>
                    )}

                    {!watch.property.chainPropertyId && (
                      <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
                        Spirit code needed
                      </Badge>
                    )}

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRefresh(watch)}
                        disabled={refreshingId === watch.id}
                        className="flex-1"
                      >
                        {refreshingId === watch.id ? (
                          <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        ) : (
                          <RefreshCw className="h-3 w-3 mr-1" />
                        )}
                        Refresh
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(watch)}
                        disabled={deletingId === watch.id}
                      >
                        {deletingId === watch.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Trash2 className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Desktop: table layout */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Property</TableHead>
                  <TableHead>Upcoming Stays</TableHead>
                  <TableHead>Latest Cash</TableHead>
                  <TableHead>Latest Award</TableHead>
                  <TableHead>Last Checked</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {watches.map((watch) => {
                  const latest = watch.snapshots[0];
                  const upcomingBookings = watch.bookings.filter(
                    (b) => new Date(b.booking.checkIn) >= new Date()
                  );
                  return (
                    <TableRow key={watch.id} data-testid={`price-watch-row-${watch.id}`}>
                      <TableCell>
                        <div className="font-medium">{watch.property.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {[watch.property.city, watch.property.countryCode]
                            .filter(Boolean)
                            .join(", ")}
                        </div>
                        {!watch.property.chainPropertyId && (
                          <Badge
                            variant="outline"
                            className="text-xs text-amber-600 border-amber-300 mt-1"
                          >
                            Spirit code needed
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-0.5">
                          {upcomingBookings.length === 0 ? (
                            <span className="text-xs text-muted-foreground">No upcoming stays</span>
                          ) : (
                            upcomingBookings.map((b) => (
                              <Link
                                key={b.bookingId}
                                href={`/bookings/${b.bookingId}`}
                                className="text-xs underline block"
                              >
                                {formatDate(b.booking.checkIn)} → {formatDate(b.booking.checkOut)}
                              </Link>
                            ))
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {latest?.cashPrice != null
                          ? formatCurrency(Number(latest.cashPrice), latest.cashCurrency)
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {latest?.awardPrice != null
                          ? `${latest.awardPrice.toLocaleString()} pts`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {watch.lastCheckedAt ? formatDate(watch.lastCheckedAt) : "Never"}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={watch.isEnabled}
                          onCheckedChange={(v) => handleToggle(watch, v)}
                          disabled={togglingId === watch.id}
                          data-testid={`watch-toggle-${watch.id}`}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRefresh(watch)}
                            disabled={refreshingId === watch.id}
                            data-testid={`refresh-watch-${watch.id}`}
                          >
                            {refreshingId === watch.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <RefreshCw className="h-3 w-3" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(watch)}
                            disabled={deletingId === watch.id}
                            data-testid={`delete-watch-${watch.id}`}
                          >
                            {deletingId === watch.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Trash2 className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
