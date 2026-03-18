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
import { Building2, Loader2 } from "lucide-react";
import { extractApiError } from "@/lib/client-error";
import type { Property } from "@/lib/types";
import { HOTEL_ID } from "@/lib/constants";

interface PropertyWithChain extends Property {
  hotelChain?: { name: string } | null;
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

  const fetchProperties = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/properties?includeChain=true");
    if (res.ok) {
      const data = await res.json();
      setProperties(data);
      // Seed edit state from current values
      const initial: Record<string, string> = {};
      for (const p of data) {
        initial[p.id] = p.chainPropertyId ?? "";
      }
      setEdits(initial);
    } else {
      setError(await extractApiError(res, "Failed to load properties."));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchProperties();
  }, [fetchProperties]);

  const handleSave = async (property: PropertyWithChain) => {
    const value = edits[property.id]?.trim() ?? "";
    setSaving((s) => ({ ...s, [property.id]: true }));
    setError(null);
    const res = await fetch(`/api/properties/${property.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chainPropertyId: value || null }),
    });
    if (res.ok) {
      const updated: PropertyWithChain = await res.json();
      setProperties((prev) => prev.map((p) => (p.id === property.id ? { ...p, ...updated } : p)));
    } else {
      setError(await extractApiError(res, "Failed to save chain property ID."));
    }
    setSaving((s) => ({ ...s, [property.id]: false }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ErrorBanner error={error} onDismiss={() => setError(null)} />
      <div>
        <h2 className="text-lg font-semibold">Properties</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Set the chain-specific scraper ID for each property. Examples: Hyatt{" "}
          <strong>spirit code</strong> (e.g.{" "}
          <code className="text-xs bg-muted px-1 rounded">chiph</code>), Hilton{" "}
          <strong>ctyhocn code</strong> (e.g.{" "}
          <code className="text-xs bg-muted px-1 rounded">NYCMHHH</code>), Marriott{" "}
          <strong>MARSHA code</strong> (e.g.{" "}
          <code className="text-xs bg-muted px-1 rounded">CHIWS</code>), IHG{" "}
          <strong>hotel code</strong> (e.g.{" "}
          <code className="text-xs bg-muted px-1 rounded">KULKL</code>), GHA{" "}
          <strong>hotel ID</strong> (e.g.{" "}
          <code className="text-xs bg-muted px-1 rounded">23084</code>), Accor{" "}
          <strong>hotel ID</strong> (e.g.{" "}
          <code className="text-xs bg-muted px-1 rounded">C3M1</code>).
        </p>
      </div>

      {properties.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No properties yet"
          description="Properties are created automatically when you add a booking."
          data-testid="properties-empty"
        />
      ) : (
        <>
          {/* Mobile: card layout */}
          <div className="grid grid-cols-1 gap-4 md:hidden" data-testid="properties-mobile">
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
                      {saving[property.id] ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Desktop: table layout */}
          <div className="hidden md:block" data-testid="properties-desktop">
            <Table>
              <TableHeader>
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
                  <TableRow key={property.id} data-testid={`property-row-${property.id}`}>
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
        </>
      )}
    </div>
  );
}
