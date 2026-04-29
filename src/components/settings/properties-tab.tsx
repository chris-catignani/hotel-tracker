"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ErrorBanner } from "@/components/ui/error-banner";
import { EmptyState } from "@/components/ui/empty-state";
import { Building2, Loader2, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { PageSpinner } from "@/components/ui/page-spinner";
import { apiFetch } from "@/lib/api-fetch";
import { logger } from "@/lib/logger";
import type { Property } from "@/lib/types";
import { HOTEL_ID } from "@/lib/constants";
import { toast } from "sonner";

interface PropertyWithChain extends Property {
  hotelChain?: { name: string } | null;
}

interface PropertiesResponse {
  properties: PropertyWithChain[];
  metadata: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

function chainPropertyIdPlaceholder(hotelChainId: string | null | undefined): string {
  if (hotelChainId === HOTEL_ID.HYATT) return "e.g. chiph";
  if (hotelChainId === HOTEL_ID.MARRIOTT) return "e.g. CHIWS";
  if (hotelChainId === HOTEL_ID.IHG) return "e.g. KULKL";
  if (hotelChainId === HOTEL_ID.GHA_DISCOVERY) return "e.g. 23084";
  if (hotelChainId === HOTEL_ID.ACCOR) return "e.g. C3M1";
  if (hotelChainId === HOTEL_ID.HILTON) return "e.g. NYCMHHH";
  return "e.g. ABC123";
}

export function PropertiesTab() {
  const [properties, setProperties] = useState<PropertyWithChain[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Track in-progress edits: propertyId → current input value
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const fetchProperties = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      includeChain: "true",
      page: page.toString(),
      limit: "50",
    });
    if (debouncedSearchTerm) {
      params.set("name", debouncedSearchTerm);
    }

    const result = await apiFetch<PropertiesResponse>(`/api/properties?${params.toString()}`);
    if (result.ok) {
      const { properties: data, metadata } = result.data;
      setProperties(data);
      setTotalPages(metadata.totalPages);
      setTotalCount(metadata.total);

      // Seed edit state from current values
      const initial: Record<string, string> = {};
      for (const p of data) {
        initial[p.id] = p.chainPropertyId ?? "";
      }
      setEdits(initial);
    } else {
      setError(result.error.message);
    }
    setLoading(false);
  }, [page, debouncedSearchTerm]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchProperties();
  }, [fetchProperties]);

  const handleSave = async (property: PropertyWithChain) => {
    const value = edits[property.id]?.trim() ?? "";
    setSaving((s) => ({ ...s, [property.id]: true }));
    const result = await apiFetch<PropertyWithChain>(`/api/properties/${property.id}`, {
      method: "PUT",
      body: { chainPropertyId: value || null },
    });
    if (result.ok) {
      setProperties((prev) =>
        prev.map((p) => (p.id === property.id ? { ...p, ...result.data } : p))
      );
      toast.success("Property updated");
    } else {
      logger.error("Failed to save chain property ID", result.error, { status: result.status });
      toast.error("Failed to save chain property ID. Please try again.");
    }
    setSaving((s) => ({ ...s, [property.id]: false }));
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 space-y-4">
      <ErrorBanner error={error} onDismiss={() => setError(null)} />
      <div className="shrink-0 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-0.5">
          <h2 className="text-lg font-semibold">Properties</h2>
          <p className="text-sm text-muted-foreground">
            Set the chain-specific scraper ID for each property.
          </p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search properties..."
            className="pl-9 pr-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            data-testid="property-search"
          />
          {loading && (
            <div className="absolute right-2.5 top-2.5" data-testid="search-loading">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
            </div>
          )}
        </div>
      </div>

      {loading && properties.length === 0 ? (
        <PageSpinner />
      ) : properties.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={debouncedSearchTerm ? "No properties found" : "No properties yet"}
          description={
            debouncedSearchTerm
              ? "Try adjusting your search terms."
              : "Properties are created automatically when you add a booking."
          }
          data-testid="properties-empty"
        />
      ) : (
        <>
          <div className="flex-1 min-h-0 relative flex flex-col">
            {loading && properties.length > 0 && (
              <div className="absolute inset-0 bg-background/50 z-10 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            )}

            {/* Mobile: card layout */}
            <div
              className="grid grid-cols-1 gap-4 md:hidden overflow-auto flex-1 min-h-0"
              data-testid="properties-mobile"
            >
              {properties.map((property) => (
                <Card key={property.id} data-testid={`property-card-${property.id}`}>
                  <CardContent className="p-4 space-y-3">
                    <div>
                      <p className="font-semibold text-sm" data-testid="property-name">
                        {property.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {[property.hotelChain?.name, property.city, property.countryCode]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Input
                        placeholder={chainPropertyIdPlaceholder(property.hotelChainId)}
                        value={edits[property.id] ?? ""}
                        onChange={(e) =>
                          setEdits((prev) => ({
                            ...prev,
                            [property.id]: e.target.value,
                          }))
                        }
                        className="h-8 text-sm font-mono"
                        maxLength={20}
                        data-testid="spirit-code-input"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSave(property)}
                        disabled={saving[property.id]}
                        data-testid="save-spirit-code"
                      >
                        {saving[property.id] ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          "Save"
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Desktop: table layout */}
            <div
              className="hidden md:flex md:flex-col md:flex-1 md:min-h-0 md:overflow-auto"
              data-testid="properties-desktop"
            >
              <Table containerClassName="overflow-visible">
                <TableHeader className="sticky top-0 bg-background z-20">
                  <TableRow>
                    <TableHead>Property</TableHead>
                    <TableHead>Chain</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Chain Property ID</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {properties.map((property) => (
                    <TableRow key={property.id} data-testid="property-row">
                      <TableCell
                        className="font-medium max-w-56 truncate"
                        data-testid="property-name"
                      >
                        {property.name}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {property.hotelChain?.name ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {[property.city, property.countryCode].filter(Boolean).join(", ") || "—"}
                      </TableCell>
                      <TableCell>
                        <Input
                          placeholder={chainPropertyIdPlaceholder(property.hotelChainId)}
                          value={edits[property.id] ?? ""}
                          onChange={(e) =>
                            setEdits((prev) => ({
                              ...prev,
                              [property.id]: e.target.value,
                            }))
                          }
                          className="h-8 text-sm font-mono w-36"
                          maxLength={20}
                          data-testid="spirit-code-input"
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSave(property)}
                          disabled={saving[property.id]}
                          data-testid="save-spirit-code"
                        >
                          {saving[property.id] ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            "Save"
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between py-2 border-t shrink-0">
            <p className="text-xs text-muted-foreground">
              Showing <span className="font-medium">{properties.length}</span> of{" "}
              <span className="font-medium">{totalCount}</span> properties
            </p>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1 || loading}
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="h-4 w-4" />
                <span className="sr-only">Previous page</span>
              </Button>
              <span className="text-xs font-medium">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages || loading}
                className="h-8 w-8 p-0"
              >
                <ChevronRight className="h-4 w-4" />
                <span className="sr-only">Next page</span>
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
