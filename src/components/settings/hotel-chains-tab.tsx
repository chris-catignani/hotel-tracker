"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AppSelect } from "@/components/ui/app-select";
import { CurrencyCombobox } from "@/components/ui/currency-combobox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiFetch } from "@/lib/api-fetch";
import { logger } from "@/lib/logger";
import { HotelChain, PointType } from "@/lib/types";
import { EmptyState } from "@/components/ui/empty-state";
import { Building2 } from "lucide-react";
import { toast } from "sonner";
import { SettingsCrudTab, ColumnDef, CrudActions } from "./settings-crud-tab";

export function HotelChainsTab() {
  const [pointTypes, setPointTypes] = useState<PointType[]>([]);
  const [hotelChains, setHotelChainsLocal] = useState<HotelChain[]>([]);
  const [name, setName] = useState("");
  const [loyaltyProgram, setLoyaltyProgram] = useState("");
  const [basePointRate, setBasePointRate] = useState("");
  const [calculationCurrency, setCalculationCurrency] = useState("USD");
  const [pointTypeId, setPointTypeId] = useState("none");
  const [editHotelChain, setEditHotelChain] = useState<HotelChain | null>(null);
  const [editName, setEditName] = useState("");
  const [editLoyaltyProgram, setEditLoyaltyProgram] = useState("");
  const [editBasePointRate, setEditBasePointRate] = useState("");
  const [editCalculationCurrency, setEditCalculationCurrency] = useState("USD");
  const [editPointTypeId, setEditPointTypeId] = useState("none");

  // Sub-brands
  const [sbOpen, setSbOpen] = useState(false);
  const [sbHotelChainId, setSbHotelChainId] = useState<string | null>(null);
  const [sbName, setSbName] = useState("");
  const [sbBaseRate, setSbBaseRate] = useState("");

  const sbHotelChain = hotelChains.find((h) => h.id === sbHotelChainId) ?? null;

  const fetchDependencies = async () => {
    const ptResult = await apiFetch<PointType[]>("/api/point-types");
    if (ptResult.ok) setPointTypes(ptResult.data);
  };

  const fetchItems = async () => {
    const result = await apiFetch<HotelChain[]>("/api/hotel-chains");
    if (!result.ok) throw new Error(result.error.message);
    const chains = result.data;
    setHotelChainsLocal(chains);
    return chains;
  };

  const handleAddSubmit = async () => {
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
      return true;
    }
    logger.error("Failed to add hotel chain", result.error, { status: result.status });
    toast.error("Failed to add hotel chain. Please try again.");
    return false;
  };

  const handleEditSubmit = async () => {
    if (!editHotelChain) return false;
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
      setEditHotelChain(null);
      return true;
    }
    logger.error("Failed to update hotel chain", result.error, { status: result.status });
    toast.error("Failed to update hotel chain. Please try again.");
    return false;
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
      body: { name: sbName, basePointRate: sbBaseRate ? Number(sbBaseRate) : null },
    });
    if (result.ok) {
      setSbName("");
      setSbBaseRate("");
      await fetchItems();
    } else {
      logger.error("Failed to add sub-brand", result.error, { status: result.status });
      toast.error("Failed to add hotel chain sub-brand. Please try again.");
    }
  };

  const handleDeleteSubBrand = async (sbId: string) => {
    const result = await apiFetch(`/api/hotel-chain-sub-brands/${sbId}`, { method: "DELETE" });
    if (result.ok) {
      await fetchItems();
    } else if (result.status === 409) {
      toast.error("Cannot delete: this hotel chain sub-brand is referenced by existing bookings.");
    } else {
      logger.error("Failed to delete sub-brand", result.error, { status: result.status });
      toast.error("Failed to delete hotel chain sub-brand. Please try again.");
    }
  };

  const pointTypeOptions = [
    { label: "None", value: "none" },
    ...pointTypes.map((pt) => ({ label: pt.name, value: pt.id })),
  ];

  const formatRate = (hc: HotelChain) =>
    hc.basePointRate != null ? `${hc.basePointRate} pts/${hc.calculationCurrency ?? "USD"}` : "-";

  const columns: ColumnDef<HotelChain>[] = [
    {
      header: "Name",
      render: (hc) => (
        <span className="font-medium" data-testid="hotel-chain-table-name">
          {hc.name}
        </span>
      ),
    },
    { header: "Loyalty Program", render: (hc) => hc.loyaltyProgram ?? "-" },
    { header: "Base Rate", render: formatRate },
    { header: "Point Type", render: (hc) => hc.pointType?.name ?? "—" },
    {
      header: "",
      render: (hc) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => openSubBrands(hc)}
          data-testid="hotel-chain-sub-brands-button"
        >
          Sub-brands
        </Button>
      ),
    },
  ];

  const renderMobileCard = (hc: HotelChain, actions: CrudActions<HotelChain>) => (
    <Card key={hc.id} data-testid="hotel-chain-card">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-bold" data-testid="hotel-chain-card-name">
              {hc.name}
            </h3>
            <p className="text-sm text-muted-foreground">
              {hc.loyaltyProgram || "No loyalty program"}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium">Base Rate</p>
            <p className="text-lg font-bold">{formatRate(hc)}</p>
          </div>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Point Type</span>
          <span className="font-medium">{hc.pointType?.name ?? "—"}</span>
        </div>
        <div className="flex gap-2 pt-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={() => openSubBrands(hc)}>
            Sub-brands
          </Button>
          <Button variant="outline" size="sm" onClick={() => actions.onEdit(hc)}>
            Edit
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const subBrandsDialog = (
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
                <div
                  key={sb.id}
                  className="flex items-center gap-2 border-b pb-2 last:border-0"
                  data-testid="sub-brand-row"
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium" data-testid="sub-brand-name">
                      {sb.name}
                    </p>
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
                    data-testid="sub-brand-delete-button"
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
  );

  return (
    <SettingsCrudTab<HotelChain>
      title="Hotel Chains"
      addButtonLabel="Add Hotel Chain"
      addButtonTestId="add-hotel-chain-button"
      fetchItems={fetchItems}
      fetchDependencies={fetchDependencies}
      columns={columns}
      renderMobileCard={renderMobileCard}
      addDialog={{
        title: "Add Hotel Chain",
        description: "Add a new hotel chain to track bookings for.",
        renderFields: () => (
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
              <Label>Point Type</Label>
              <AppSelect
                value={pointTypeId}
                onValueChange={setPointTypeId}
                options={pointTypeOptions}
                placeholder="Select point type..."
                data-testid="hotel-point-type-select"
              />
            </div>
          </div>
        ),
        onSubmit: handleAddSubmit,
        isValid: name.trim().length > 0,
      }}
      editDialog={{
        title: "Edit Hotel Chain",
        description: "Update hotel chain details and point rates.",
        renderFields: () => (
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
              <Label>Point Type</Label>
              <AppSelect
                value={editPointTypeId}
                onValueChange={setEditPointTypeId}
                options={pointTypeOptions}
                placeholder="Select point type..."
                data-testid="edit-hotel-point-type-select"
              />
            </div>
          </div>
        ),
        onSubmit: handleEditSubmit,
        isValid: editName.trim().length > 0,
        onOpen: (hc) => {
          setEditHotelChain(hc);
          setEditName(hc.name);
          setEditLoyaltyProgram(hc.loyaltyProgram || "");
          setEditBasePointRate(hc.basePointRate != null ? String(hc.basePointRate) : "");
          setEditCalculationCurrency(hc.calculationCurrency ?? "USD");
          setEditPointTypeId(hc.pointTypeId != null ? hc.pointTypeId : "none");
        },
      }}
      extraDialogs={subBrandsDialog}
      emptyState={{
        icon: Building2,
        title: "No hotel chains",
        description: "Add hotel chains like Marriott or Hilton to start tracking your stays.",
      }}
      testIds={{ list: "hotel-chains-desktop", empty: "hotel-chains-empty" }}
    />
  );
}
