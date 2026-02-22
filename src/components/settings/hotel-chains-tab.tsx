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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { extractApiError } from "@/lib/client-error";
import { HotelChain, PointType } from "@/lib/types";
import { ErrorBanner } from "@/components/ui/error-banner";

export function HotelChainsTab() {
  const [hotelChains, setHotelChains] = useState<HotelChain[]>([]);
  const [pointTypes, setPointTypes] = useState<PointType[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [loyaltyProgram, setLoyaltyProgram] = useState("");
  const [basePointRate, setBasePointRate] = useState("");
  const [pointTypeId, setPointTypeId] = useState("none");
  const [error, setError] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editHotelChain, setEditHotelChain] = useState<HotelChain | null>(null);
  const [editName, setEditName] = useState("");
  const [editLoyaltyProgram, setEditLoyaltyProgram] = useState("");
  const [editBasePointRate, setEditBasePointRate] = useState("");
  const [editPointTypeId, setEditPointTypeId] = useState("none");

  // Hotel chain sub-brands management
  const [sbOpen, setSbOpen] = useState(false);
  const [sbHotelChainId, setSbHotelChainId] = useState<number | null>(null);
  const [sbName, setSbName] = useState("");
  const [sbBaseRate, setSbBaseRate] = useState("");

  const sbHotelChain = hotelChains.find((h) => h.id === sbHotelChainId) ?? null;

  const fetchData = useCallback(async () => {
    const [hotelChainsRes, ptRes] = await Promise.all([
      fetch("/api/hotel-chains"),
      fetch("/api/point-types"),
    ]);
    if (hotelChainsRes.ok) setHotelChains(await hotelChainsRes.json());
    else setError(await extractApiError(hotelChainsRes, "Failed to load hotel chains."));
    if (ptRes.ok) setPointTypes(await ptRes.json());
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  const handleSubmit = async () => {
    setError(null);
    const res = await fetch("/api/hotel-chains", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        loyaltyProgram: loyaltyProgram || null,
        basePointRate: basePointRate ? Number(basePointRate) : null,
        pointTypeId: pointTypeId !== "none" ? Number(pointTypeId) : null,
      }),
    });
    if (res.ok) {
      setName("");
      setLoyaltyProgram("");
      setBasePointRate("");
      setPointTypeId("none");
      setOpen(false);
      fetchData();
    } else {
      setError(await extractApiError(res, "Failed to add hotel chain."));
    }
  };

  const handleEdit = (hotelChain: HotelChain) => {
    setEditHotelChain(hotelChain);
    setEditName(hotelChain.name);
    setEditLoyaltyProgram(hotelChain.loyaltyProgram || "");
    setEditBasePointRate(hotelChain.basePointRate != null ? String(hotelChain.basePointRate) : "");
    setEditPointTypeId(hotelChain.pointTypeId != null ? String(hotelChain.pointTypeId) : "none");
    setEditOpen(true);
  };

  const handleEditSubmit = async () => {
    if (!editHotelChain) return;
    setError(null);
    const res = await fetch(`/api/hotel-chains/${editHotelChain.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editName,
        loyaltyProgram: editLoyaltyProgram || null,
        basePointRate: editBasePointRate ? Number(editBasePointRate) : null,
        pointTypeId: editPointTypeId !== "none" ? Number(editPointTypeId) : null,
      }),
    });
    if (res.ok) {
      setEditOpen(false);
      setEditHotelChain(null);
      fetchData();
    } else {
      setError(await extractApiError(res, "Failed to update hotel chain."));
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
    setError(null);
    const res = await fetch(`/api/hotel-chains/${sbHotelChainId}/hotel-chain-sub-brands`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: sbName,
        basePointRate: sbBaseRate ? Number(sbBaseRate) : null,
      }),
    });
    if (res.ok) {
      setSbName("");
      setSbBaseRate("");
      fetchData();
    } else {
      setError(await extractApiError(res, "Failed to add hotel chain sub-brand."));
    }
  };

  const handleDeleteSubBrand = async (sbId: number) => {
    setError(null);
    const res = await fetch(`/api/hotel-chain-sub-brands/${sbId}`, { method: "DELETE" });
    if (res.ok) {
      fetchData();
    } else if (res.status === 409) {
      setError("Cannot delete: this hotel chain sub-brand is referenced by existing bookings.");
    } else {
      setError(await extractApiError(res, "Failed to delete hotel chain sub-brand."));
    }
  };

  return (
    <div className="space-y-4">
      <ErrorBanner error={error} onDismiss={() => setError(null)} />
      <div className="flex items-center justify-between">
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
                <Label htmlFor="hotel-base-rate">Base Point Rate (per $1)</Label>
                <Input
                  id="hotel-base-rate"
                  type="number"
                  step="0.1"
                  value={basePointRate}
                  onChange={(e) => setBasePointRate(e.target.value)}
                  placeholder="e.g. 10"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hotel-point-type">Point Type</Label>
                <Select value={pointTypeId} onValueChange={setPointTypeId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select point type..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {pointTypes.map((pt) => (
                      <SelectItem key={pt.id} value={String(pt.id)}>
                        {pt.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
              <Label htmlFor="edit-hotel-base-rate">Base Point Rate (per $1)</Label>
              <Input
                id="edit-hotel-base-rate"
                type="number"
                step="0.1"
                value={editBasePointRate}
                onChange={(e) => setEditBasePointRate(e.target.value)}
                placeholder="e.g. 10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-hotel-point-type">Point Type</Label>
              <Select value={editPointTypeId} onValueChange={setEditPointTypeId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select point type..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {pointTypes.map((pt) => (
                    <SelectItem key={pt.id} value={String(pt.id)}>
                      {pt.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {!sbHotelChain || sbHotelChain.hotelChainSubBrands.length === 0 ? (
              <p className="text-sm text-muted-foreground">No sub-brands yet.</p>
            ) : (
              sbHotelChain.hotelChainSubBrands.map((sb) => (
                <div key={sb.id} className="flex items-center gap-2 border-b pb-2 last:border-0">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{sb.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Base Rate: {sb.basePointRate ?? "Inherit"}
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
                  Base Rate (per $1)
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

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Loyalty Program</TableHead>
            <TableHead>Base Rate</TableHead>
            <TableHead>Point Type</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {hotelChains.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground">
                No hotel chains added yet.
              </TableCell>
            </TableRow>
          ) : (
            hotelChains.map((hotelChain) => (
              <TableRow key={hotelChain.id}>
                <TableCell>{hotelChain.name}</TableCell>
                <TableCell>{hotelChain.loyaltyProgram ?? "-"}</TableCell>
                <TableCell>{hotelChain.basePointRate ?? "-"}</TableCell>
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
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
