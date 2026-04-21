"use client";

import { useState } from "react";
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
import { Loader2, Pencil, Check, X } from "lucide-react";
import { PageSpinner } from "@/components/ui/page-spinner";
import { ChainPropertyIdHint } from "@/components/price-watch/booking-price-watch";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatCurrency, formatDate, pruneHotelName } from "@/lib/utils";
import { ErrorBanner } from "@/components/ui/error-banner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { HOTEL_ID } from "@/lib/constants";
import { useApiQuery } from "@/hooks/use-api-query";
import { apiFetch } from "@/lib/api-fetch";
import { logger } from "@/lib/logger";
import { toast } from "sonner";

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
    propertyId: string;
    property: { name: string };
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
  propertyId: string;
  isEnabled: boolean;
  lastCheckedAt: string | null;
  property: {
    id: string;
    name: string;
    chainPropertyId: string | null;
    hotelChainId: string | null;
    hotelChain: { name: string } | null;
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
  if (hotelChainId === HOTEL_ID.HILTON) return "ctyhocn Code";
  return "Chain Property ID";
}

function chainPropertyIdPlaceholder(hotelChainId: string | null): string {
  if (hotelChainId === HOTEL_ID.HYATT) return "e.g. chiph";
  if (hotelChainId === HOTEL_ID.MARRIOTT) return "e.g. CHIWS";
  if (hotelChainId === HOTEL_ID.IHG) return "e.g. KULKL";
  if (hotelChainId === HOTEL_ID.GHA_DISCOVERY) return "e.g. 23084";
  if (hotelChainId === HOTEL_ID.ACCOR) return "e.g. C3M1";
  if (hotelChainId === HOTEL_ID.HILTON) return "e.g. NYCMHHH";
  return "e.g. ABC123";
}

function ChainPropertyIdEditor({
  propertyId,
  hotelChainId,
  chainPropertyId,
  propertyName,
  chainName,
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
  chainName?: string | null;
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
      {chainName && <span className="text-xs text-muted-foreground">{chainName} ·</span>}
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
  const {
    data: watchesData,
    loading,
    error: fetchError,
    clearError,
    refetch: refetchWatches,
  } = useApiQuery<PriceWatch[]>("/api/price-watches", {
    onError: (err) =>
      logger.error("Failed to fetch price watches", err.error, { status: err.status }),
  });
  const watches = watchesData ?? [];

  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingPropertyId, setEditingPropertyId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [savingPropertyId, setSavingPropertyId] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [watchToDelete, setWatchToDelete] = useState<PriceWatch | null>(null);

  const handleToggle = async (watch: PriceWatch, enabled: boolean) => {
    setTogglingId(watch.id);
    const result = await apiFetch<PriceWatch>(`/api/price-watches/${watch.id}`, {
      method: "PUT",
      body: { isEnabled: enabled },
    });
    setTogglingId(null);
    if (!result.ok) {
      logger.error("Failed to update price watch", result.error, {
        priceWatchId: watch.id,
        status: result.status,
      });
      toast.error("Failed to update price watch. Please try again.");
      return;
    }
    refetchWatches();
  };

  const handleDeleteClick = (watch: PriceWatch) => {
    setWatchToDelete(watch);
    setDeleteOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!watchToDelete) return;
    setDeleteOpen(false);
    setDeletingId(watchToDelete.id);
    const result = await apiFetch(`/api/price-watches/${watchToDelete.id}`, { method: "DELETE" });
    setDeletingId(null);
    if (!result.ok) {
      logger.error("Failed to delete price watch", result.error, {
        priceWatchId: watchToDelete.id,
        status: result.status,
      });
      toast.error("Failed to delete price watch. Please try again.");
      return;
    }
    setWatchToDelete(null);
    refetchWatches();
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
    const result = await apiFetch<{ chainPropertyId: string | null }>(
      `/api/properties/${propertyId}`,
      {
        method: "PUT",
        body: { chainPropertyId: editingValue.trim() || null },
      }
    );
    setSavingPropertyId(null);
    if (!result.ok) {
      logger.error("Failed to save chain property ID", result.error, {
        propertyId,
        status: result.status,
      });
      toast.error("Failed to save. Please try again.");
      return;
    }
    refetchWatches();
    setEditingPropertyId(null);
    setEditingValue("");
  };

  if (loading && !watchesData) {
    return <PageSpinner />;
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Price Watch</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Monitor hotel rates and get alerted when prices drop below your thresholds.
        </p>
      </div>

      <ErrorBanner
        error={fetchError ? "Failed to load price watches. Please try again." : null}
        onDismiss={clearError}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Stop Price Watch?"
        description={`Stop watching prices for ${watchToDelete ? pruneHotelName(watchToDelete.property.name) : ""}?`}
        onConfirm={handleDeleteConfirm}
        confirmLabel="Stop Watching"
      />

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
                      <div className="space-y-1">
                        {upcomingBookings.map((b) => {
                          const isAlternate = b.booking.propertyId !== watch.propertyId;
                          return (
                            <div key={b.bookingId}>
                              <Link
                                href={`/bookings/${b.bookingId}`}
                                className="text-xs underline block"
                              >
                                {formatDate(b.booking.checkIn)} → {formatDate(b.booking.checkOut)}
                              </Link>
                              <div className="text-xs text-muted-foreground">
                                {isAlternate ? (
                                  <>
                                    <Badge variant="outline" className="mr-1 text-xs">
                                      Alternate
                                    </Badge>
                                    for booking at <strong>{b.booking.property.name}</strong>
                                  </>
                                ) : (
                                  <>
                                    Anchor watch for booking at{" "}
                                    <strong>{b.booking.property.name}</strong>
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}
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
                      chainName={watch.property.hotelChain?.name}
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
                      variant="destructive"
                      onClick={() => handleDeleteClick(watch)}
                      disabled={deletingId === watch.id}
                    >
                      {deletingId === watch.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        "Delete"
                      )}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Desktop: table layout */}
          <div className="hidden md:flex md:flex-col md:flex-1 md:min-h-0 md:overflow-auto">
            <Table containerClassName="overflow-visible">
              <TableHeader className="sticky top-0 bg-background z-20">
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
                          chainName={watch.property.hotelChain?.name}
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
                            upcomingBookings.map((b) => {
                              const isAlternate = b.booking.propertyId !== watch.propertyId;
                              return (
                                <div key={b.bookingId}>
                                  <Link
                                    href={`/bookings/${b.bookingId}`}
                                    className="text-xs underline block"
                                  >
                                    {formatDate(b.booking.checkIn)} →{" "}
                                    {formatDate(b.booking.checkOut)}
                                  </Link>
                                  <div className="text-xs text-muted-foreground">
                                    {isAlternate ? (
                                      <>
                                        <Badge variant="outline" className="mr-1 text-xs">
                                          Alternate
                                        </Badge>
                                        for booking at <strong>{b.booking.property.name}</strong>
                                      </>
                                    ) : (
                                      <>
                                        Anchor watch for booking at{" "}
                                        <strong>{b.booking.property.name}</strong>
                                      </>
                                    )}
                                  </div>
                                </div>
                              );
                            })
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
                          variant="destructive"
                          onClick={() => handleDeleteClick(watch)}
                          disabled={deletingId === watch.id}
                          data-testid={`delete-watch-${watch.id}`}
                        >
                          {deletingId === watch.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            "Delete"
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
