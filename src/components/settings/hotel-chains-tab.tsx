"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppSelect } from "@/components/ui/app-select";
import { CurrencyCombobox } from "@/components/ui/currency-combobox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiFetch } from "@/lib/api-fetch";
import { logger } from "@/lib/logger";
import { HotelChain, PointType } from "@/lib/types";
import { ErrorBanner } from "@/components/ui/error-banner";
import { EmptyState } from "@/components/ui/empty-state";
import { Building2 } from "lucide-react";
import { toast } from "sonner";

export function HotelChainsTab() {
  const [hotelChains, setHotelChains] = useState<HotelChain[]>([]);
  const [pointTypes, setPointTypes] = useState<PointType[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [loyaltyProgram, setLoyaltyProgram] = useState("");
  const [basePointRate, setBasePointRate] = useState("");
  const [calculationCurrency, setCalculationCurrency] = useState("USD");
  const [pointTypeId, setPointTypeId] = useState("none");
  const [error, setError] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editHotelChain, setEditHotelChain] = useState<HotelChain | null>(null);
  const [editName, setEditName] = useState("");
  const [editLoyaltyProgram, setEditLoyaltyProgram] = useState("");
  const [editBasePointRate, setEditBasePointRate] = useState("");
  const [editCalculationCurrency, setEditCalculationCurrency] = useState("USD");
  const [editPointTypeId, setEditPointTypeId] = useState("none");

  // Hotel chain sub-brands management
  const [sbOpen, setSbOpen] = useState(false);
  const [sbHotelChainId, setSbHotelChainId] = useState<string | null>(null);
  const [sbName, setSbName] = useState("");
  const [sbBaseRate, setSbBaseRate] = useState("");

  const sbHotelChain = hotelChains.find((h) => h.id === sbHotelChainId) ?? null;

  const fetchData = useCallback(async () => {
    const [hotelChainsResult, ptResult] = await Promise.all([
      apiFetch<HotelChain[]>("/api/hotel-chains"),
      apiFetch<PointType[]>("/api/point-types"),
    ]);
    if (hotelChainsResult.ok) setHotelChains(hotelChainsResult.data);
    else setError(hotelChainsResult.error.message);
    if (ptResult.ok) setPointTypes(ptResult.data);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  const handleSubmit = async () => {
    const result = await apiFetch("/api/hotel-chains", {
      method: "POST",
      body: {
        name,
        loyaltyProgram: loyaltyProgram || null,
        basePointRate: basePointRate ? Number(basePointRate) : null,
        calculationCurrency,
        pointTypeId: pointTypeId !== "none" ? pointTypeId : null,
      },
    });
    if (result.ok) {
      setName("");
      setLoyaltyProgram("");
      setBasePointRate("");
      setCalculationCurrency("USD");
      setPointTypeId("none");
      setOpen(false);
      fetchData();
    } else {
      logger.error("Failed to add hotel chain", result.error, { status: result.status });
      toast.error("Failed to add hotel chain. Please try again.");
    }
  };

  const handleEdit = (hotelChain: HotelChain) => {
    setEditHotelChain(hotelChain);
    setEditName(hotelChain.name);
    setEditLoyaltyProgram(hotelChain.loyaltyProgram || "");
    setEditBasePointRate(hotelChain.basePointRate != null ? String(hotelChain.basePointRate) : "");
    setEditCalculationCurrency(hotelChain.calculationCurrency ?? "USD");
    setEditPointTypeId(hotelChain.pointTypeId != null ? hotelChain.pointTypeId : "none");
    setEditOpen(true);
  };

  const handleEditSubmit = async () => {
    if (!editHotelChain) return;
    const result = await apiFetch(`/api/hotel-chains/${editHotelChain.id}`, {
      method: "PUT",
      body: {
        name: editName,
        loyaltyProgram: editLoyaltyProgram || null,
        basePointRate: editBasePointRate ? Number(editBasePointRate) : null,
        calculationCurrency: editCalculationCurrency,
        pointTypeId: editPointTypeId !== "none" ? editPointTypeId : null,
      },
    });
    if (result.ok) {
      setEditOpen(false);
      setEditHotelChain(null);
      fetchData();
    } else {
      logger.error("Failed to update hotel chain", result.error, { status: result.status });
      toast.error("Failed to update hotel chain. Please try again.");
    }
  };

  const openSubBrands = (hotelChain: HotelChain) => {
    setSbHotelChainId(hotelChain.id);
    setSbName("");
    setSbBaseRate("");
    setSbOpen(true);
  };

  const handleAddSubBrand = async () => {
    if (!sbHotelChainId) return;
    const result = await apiFetch(`/api/hotel-chains/${sbHotelChainId}/hotel-chain-sub-brands`, {
      method: "POST",
      body: {
        name: sbName,
        basePointRate: sbBaseRate ? Number(sbBaseRate) : null,
      },
    });
    if (result.ok) {
      setSbName("");
      setSbBaseRate("");
      fetchData();
    } else {
      logger.error("Failed to add sub-brand", result.error, { status: result.status });
      toast.error("Failed to add hotel chain sub-brand. Please try again.");
    }
  };

  const handleDeleteSubBrand = async (sbId: string) => {
    const result = await apiFetch(`/api/hotel-chain-sub-brands/${sbId}`, { method: "DELETE" });
    if (result.ok) {
      fetchData();
    } else if (result.status === 409) {
      toast.error("Cannot delete: this hotel chain sub-brand is referenced by existing bookings.");
    } else {
      logger.error("Failed to delete sub-brand", result.error, { status: result.status });
      toast.error("Failed to delete hotel chain sub-brand. Please try again.");
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 space-y-4">
      <ErrorBanner error={error} onDismiss={() => setError(null)} />
      <div className="flex items-center justify-between shrink-0">
        <h2 className="text-lg font-semibold">Hotel Chains</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="add-hotel-chain-button">Add Hotel Chain</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Hotel Chain</DialogTitle>
              <DialogDescription>Add a new hotel chain to track bookings for.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="hotel-name">Name</Label>
                <Input
                  id="hotel-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Hotel chain name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hotel-loyalty">Loyalty Program</Label>
                <Input
                  id="hotel-loyalty"
                  value={loyaltyProgram}
                  onChange={(e) => setLoyaltyProgram(e.target.value)}
                  placeholder="e.g. Marriott Bonvoy"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hotel-base-rate">Base Point Rate</Label>
                <div className="flex gap-2">
                  <Input
                    id="hotel-base-rate"
                    type="number"
                    step="0.1"
                    value={basePointRate}
                    onChange={(e) => setBasePointRate(e.target.value)}
                    placeholder={`pts per 1 ${calculationCurrency}`}
                    className="flex-1"
                  />
                  <CurrencyCombobox
                    value={calculationCurrency}
                    onValueChange={setCalculationCurrency}
                    compact
                    className="w-20 shrink-0"
                    data-testid="hotel-calc-currency-select"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="hotel-point-type">Point Type</Label>
                <AppSelect
                  value={pointTypeId}
                  onValueChange={setPointTypeId}
                  options={[
                    { label: "None", value: "none" },
                    ...pointTypes.map((pt) => ({
                      label: pt.name,
                      value: pt.id,
                    })),
                  ]}
                  placeholder="Select point type..."
                  data-testid="hotel-point-type-select"
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleSubmit} disabled={!name.trim()}>
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Hotel Chain</DialogTitle>
            <DialogDescription>Update hotel chain details and point rates.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-hotel-name">Name</Label>
              <Input
                id="edit-hotel-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Hotel chain name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-hotel-loyalty">Loyalty Program</Label>
              <Input
                id="edit-hotel-loyalty"
                value={editLoyaltyProgram}
                onChange={(e) => setEditLoyaltyProgram(e.target.value)}
                placeholder="e.g. Marriott Bonvoy"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-hotel-base-rate">Base Point Rate</Label>
              <div className="flex gap-2">
                <Input
                  id="edit-hotel-base-rate"
                  type="number"
                  step="0.1"
                  value={editBasePointRate}
                  onChange={(e) => setEditBasePointRate(e.target.value)}
                  placeholder={`pts per 1 ${editCalculationCurrency}`}
                  className="flex-1"
                />
                <CurrencyCombobox
                  value={editCalculationCurrency}
                  onValueChange={setEditCalculationCurrency}
                  compact
                  className="w-20 shrink-0"
                  data-testid="edit-hotel-calc-currency-select"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-hotel-point-type">Point Type</Label>
              <AppSelect
                value={editPointTypeId}
                onValueChange={setEditPointTypeId}
                options={[
                  { label: "None", value: "none" },
                  ...pointTypes.map((pt) => ({
                    label: pt.name,
                    value: pt.id,
                  })),
                ]}
                placeholder="Select point type..."
                data-testid="edit-hotel-point-type-select"
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleEditSubmit} disabled={!editName.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sub-brands Management Dialog */}
      <Dialog open={sbOpen} onOpenChange={setSbOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Sub-brands — {sbHotelChain?.name}</DialogTitle>
            <DialogDescription>
              Manage sub-brands with optional point rate overrides (blank = inherit from chain).
              {sbHotelChain?.calculationCurrency && sbHotelChain.calculationCurrency !== "USD" && (
                <span className="block mt-1 text-xs">
                  Rates are in {sbHotelChain.calculationCurrency} (inherited from chain).
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="max-h-[300px] overflow-y-auto pr-2 space-y-3">
              {!sbHotelChain || sbHotelChain.hotelChainSubBrands.length === 0 ? (
                <EmptyState
                  icon={Building2}
                  title="No sub-brands"
                  description="Add sub-brands like Park Hyatt or Ritz-Carlton."
                  className="py-6 border-none bg-transparent"
                  data-testid="sub-brands-empty"
                />
              ) : (
                sbHotelChain.hotelChainSubBrands.map((sb) => (
                  <div key={sb.id} className="flex items-center gap-2 border-b pb-2 last:border-0">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{sb.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Base Rate:{" "}
                        {sb.basePointRate != null
                          ? `${sb.basePointRate} pts/${sbHotelChain.calculationCurrency ?? "USD"}`
                          : "Inherit"}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => handleDeleteSubBrand(sb.id)}
                    >
                      &times;
                    </Button>
                  </div>
                ))
              )}
            </div>
            <div className="border-t pt-3 space-y-2">
              <p className="text-sm font-medium">Add Sub-brand</p>
              <div className="space-y-2">
                <Label htmlFor="sb-name">Name *</Label>
                <Input
                  id="sb-name"
                  value={sbName}
                  onChange={(e) => setSbName(e.target.value)}
                  placeholder="e.g. Park Hyatt"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="sb-base-rate" className="text-xs">
                  Base Rate (pts per 1 {sbHotelChain?.calculationCurrency ?? "USD"})
                </Label>
                <Input
                  id="sb-base-rate"
                  type="number"
                  step="0.1"
                  value={sbBaseRate}
                  onChange={(e) => setSbBaseRate(e.target.value)}
                  placeholder="Inherit"
                />
              </div>
              <Button size="sm" onClick={handleAddSubBrand} disabled={!sbName.trim()}>
                Add Sub-brand
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {hotelChains.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No hotel chains"
          description="Add hotel chains like Marriott or Hilton to start tracking your stays."
          action={{
            label: "Add Hotel Chain",
            onClick: () => setOpen(true),
          }}
          data-testid="hotel-chains-empty"
        />
      ) : (
        <>
          {/* Mobile View: Cards */}
          <div className="grid grid-cols-1 gap-4 md:hidden" data-testid="hotel-chains-mobile">
            {hotelChains.map((hotelChain) => (
              <Card key={hotelChain.id} data-testid="hotel-chain-card">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold" data-testid="hotel-chain-card-name">
                        {hotelChain.name}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {hotelChain.loyaltyProgram || "No loyalty program"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">Base Rate</p>
                      <p className="text-lg font-bold">
                        {hotelChain.basePointRate != null
                          ? `${hotelChain.basePointRate} pts/${hotelChain.calculationCurrency ?? "USD"}`
                          : "-"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Point Type</span>
                    <span className="font-medium">{hotelChain.pointType?.name ?? "—"}</span>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => openSubBrands(hotelChain)}
                    >
                      Sub-brands
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleEdit(hotelChain)}>
                      Edit
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Desktop View: Table */}
          <div
            className="hidden md:flex md:flex-col md:flex-1 md:min-h-0 md:overflow-auto"
            data-testid="hotel-chains-desktop"
          >
            <Table containerClassName="overflow-visible">
              <TableHeader className="sticky top-0 bg-background z-20">
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Loyalty Program</TableHead>
                  <TableHead>Base Rate</TableHead>
                  <TableHead>Point Type</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {hotelChains.map((hotelChain) => (
                  <TableRow key={hotelChain.id} data-testid="hotel-chain-table-row">
                    <TableCell className="font-medium" data-testid="hotel-chain-table-name">
                      {hotelChain.name}
                    </TableCell>
                    <TableCell>{hotelChain.loyaltyProgram ?? "-"}</TableCell>
                    <TableCell>
                      {hotelChain.basePointRate != null
                        ? `${hotelChain.basePointRate} pts/${hotelChain.calculationCurrency ?? "USD"}`
                        : "-"}
                    </TableCell>
                    <TableCell>{hotelChain.pointType?.name ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => openSubBrands(hotelChain)}>
                          Sub-brands
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(hotelChain)}>
                          Edit
                        </Button>
                      </div>
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
