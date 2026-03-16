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
import { Loader2, Trash2, Pencil, Check, X } from "lucide-react";
import { ChainPropertyIdHint } from "@/components/price-watch/booking-price-watch";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatCurrency, formatDate, pruneHotelName } from "@/lib/utils";
import { ErrorBanner } from "@/components/ui/error-banner";
import { extractApiError } from "@/lib/client-error";
import { HOTEL_ID } from "@/lib/constants";

interface PriceSnapshot {
  lowestRefundableCashPrice: string | number | null;
  lowestRefundableCashCurrency: string;
  lowestAwardPrice: number | null;
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
    hotelChainId: string | null;
    countryCode: string | null;
    city: string | null;
  };
  bookings: WatchBooking[];
  snapshots: PriceSnapshot[];
}

function chainPropertyIdLabel(hotelChainId: string | null): string {
  if (hotelChainId === HOTEL_ID.HYATT) return "Spirit Code";
  if (hotelChainId === HOTEL_ID.MARRIOTT) return "MARSHA Code";
  if (hotelChainId === HOTEL_ID.IHG) return "Hotel Code";
  if (hotelChainId === HOTEL_ID.GHA_DISCOVERY) return "Hotel ID";
  if (hotelChainId === HOTEL_ID.ACCOR) return "Hotel ID";
  return "Chain Property ID";
}

function chainPropertyIdPlaceholder(hotelChainId: string | null): string {
  if (hotelChainId === HOTEL_ID.HYATT) return "e.g. chiph";
  if (hotelChainId === HOTEL_ID.MARRIOTT) return "e.g. CHIWS";
  if (hotelChainId === HOTEL_ID.IHG) return "e.g. KULKL";
  if (hotelChainId === HOTEL_ID.GHA_DISCOVERY) return "e.g. 23084";
  if (hotelChainId === HOTEL_ID.ACCOR) return "e.g. C3M1";
  return "e.g. ABC123";
}

function ChainPropertyIdEditor({
  propertyId,
  hotelChainId,
  chainPropertyId,
  propertyName,
  isEditing,
  editingValue,
  isSaving,
  onEdit,
  onSave,
  onCancel,
  onValueChange,
  className,
}: {
  propertyId: string;
  hotelChainId: string | null;
  chainPropertyId: string | null;
  propertyName: string;
  isEditing: boolean;
  editingValue: string;
  isSaving: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onValueChange: (value: string) => void;
  className?: string;
}) {
  if (isEditing) {
    return (
      <div className={`flex items-center gap-1 ${className ?? ""}`}>
        <Input
          value={editingValue}
          onChange={(e) => onValueChange(e.target.value)}
          placeholder={chainPropertyIdPlaceholder(hotelChainId)}
          className="h-7 text-xs w-28"
          data-testid={`spirit-code-input-${propertyId}`}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSave();
            if (e.key === "Escape") onCancel();
          }}
        />
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0"
          onClick={onSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Check className="h-3 w-3 text-green-600" />
          )}
        </Button>
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={onCancel}>
          <X className="h-3 w-3 text-muted-foreground" />
        </Button>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-1 ${className ?? ""}`}>
      {chainPropertyId ? (
        <span className="text-xs text-muted-foreground font-mono">{chainPropertyId}</span>
      ) : (
        <Popover>
          <PopoverTrigger asChild>
            <Badge
              variant="outline"
              className="text-xs text-amber-600 border-amber-300 cursor-pointer hover:bg-amber-50"
            >
              {chainPropertyIdLabel(hotelChainId)} needed
            </Badge>
          </PopoverTrigger>
          <PopoverContent className="w-80 text-sm" align="start">
            <ChainPropertyIdHint hotelChainId={hotelChainId} propertyName={propertyName} />
          </PopoverContent>
        </Popover>
      )}
      <Button
        size="sm"
        variant="ghost"
        className="h-6 w-6 p-0"
        onClick={onEdit}
        data-testid={`edit-spirit-code-${propertyId}`}
      >
        <Pencil className="h-3 w-3 text-muted-foreground" />
      </Button>
    </div>
  );
}

export default function PriceWatchPage() {
  const [watches, setWatches] = useState<PriceWatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingPropertyId, setEditingPropertyId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [savingPropertyId, setSavingPropertyId] = useState<string | null>(null);

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

  const handleDelete = async (watch: PriceWatch) => {
    if (!confirm(`Stop watching prices for ${pruneHotelName(watch.property.name)}?`)) return;
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

  const handleEditChainPropertyId = (propertyId: string, current: string | null) => {
    setEditingPropertyId(propertyId);
    setEditingValue(current ?? "");
  };

  const handleCancelEdit = () => {
    setEditingPropertyId(null);
    setEditingValue("");
  };

  const handleSaveChainPropertyId = async (propertyId: string) => {
    setSavingPropertyId(propertyId);
    setError(null);
    const res = await fetch(`/api/properties/${propertyId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chainPropertyId: editingValue.trim() || null }),
    });
    if (res.ok) {
      const saved = editingValue.trim() || null;
      setWatches((prev) =>
        prev.map((w) =>
          w.property.id === propertyId
            ? { ...w, property: { ...w.property, chainPropertyId: saved } }
            : w
        )
      );
      setEditingPropertyId(null);
      setEditingValue("");
    } else {
      setError(await extractApiError(res, "Failed to save spirit code."));
    }
    setSavingPropertyId(null);
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
                        <p className="font-semibold text-sm">
                          {pruneHotelName(watch.property.name)}
                        </p>
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
                            {latest.lowestRefundableCashPrice != null
                              ? formatCurrency(
                                  Number(latest.lowestRefundableCashPrice),
                                  latest.lowestRefundableCashCurrency
                                )
                              : "—"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Award</p>
                          <p className="font-medium">
                            {latest.lowestAwardPrice != null
                              ? `${latest.lowestAwardPrice.toLocaleString()} pts`
                              : "—"}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">No price data yet</p>
                    )}

                    <ChainPropertyIdEditor
                      propertyId={watch.property.id}
                      hotelChainId={watch.property.hotelChainId}
                      chainPropertyId={watch.property.chainPropertyId}
                      propertyName={watch.property.name}
                      isEditing={editingPropertyId === watch.property.id}
                      editingValue={editingValue}
                      isSaving={savingPropertyId === watch.property.id}
                      onEdit={() =>
                        handleEditChainPropertyId(watch.property.id, watch.property.chainPropertyId)
                      }
                      onSave={() => handleSaveChainPropertyId(watch.property.id)}
                      onCancel={handleCancelEdit}
                      onValueChange={setEditingValue}
                    />

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
                        <div className="font-medium">{pruneHotelName(watch.property.name)}</div>
                        <div className="text-xs text-muted-foreground">
                          {[watch.property.city, watch.property.countryCode]
                            .filter(Boolean)
                            .join(", ")}
                        </div>
                        <ChainPropertyIdEditor
                          propertyId={watch.property.id}
                          hotelChainId={watch.property.hotelChainId}
                          chainPropertyId={watch.property.chainPropertyId}
                          propertyName={watch.property.name}
                          isEditing={editingPropertyId === watch.property.id}
                          editingValue={editingValue}
                          isSaving={savingPropertyId === watch.property.id}
                          onEdit={() =>
                            handleEditChainPropertyId(
                              watch.property.id,
                              watch.property.chainPropertyId
                            )
                          }
                          onSave={() => handleSaveChainPropertyId(watch.property.id)}
                          onCancel={handleCancelEdit}
                          onValueChange={setEditingValue}
                          className="mt-1"
                        />
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
                        {latest?.lowestRefundableCashPrice != null
                          ? formatCurrency(
                              Number(latest.lowestRefundableCashPrice),
                              latest.lowestRefundableCashCurrency
                            )
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {latest?.lowestAwardPrice != null
                          ? `${latest.lowestAwardPrice.toLocaleString()} pts`
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
