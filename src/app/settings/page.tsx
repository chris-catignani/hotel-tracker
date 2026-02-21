"use client";

import { useEffect, useState, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { extractApiError } from "@/lib/client-error";

// ---------------------------------------------------------------------------
// Error Banner
// ---------------------------------------------------------------------------

function ErrorBanner({ error, onDismiss }: { error: string | null; onDismiss: () => void }) {
  if (!error) return null;
  return (
    <div className="rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
      <div className="flex items-start justify-between gap-2">
        <pre className="whitespace-pre-wrap font-mono text-xs flex-1">{error}</pre>
        <button
          onClick={onDismiss}
          className="shrink-0 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-200"
        >
          &times;
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PointType {
  id: number;
  name: string;
  category: "hotel" | "airline" | "transferable";
  centsPerPoint: string | number;
}

interface HotelChainSubBrand {
  id: number;
  hotelChainId: number;
  name: string;
  basePointRate: number | null;
}

interface HotelChainEliteStatus {
  id: number;
  name: string;
  bonusPercentage: number | null;
  fixedRate: number | null;
  isFixed: boolean;
}

interface UserStatus {
  id: number;
  hotelChainId: number;
  eliteStatusId: number | null;
  eliteStatus: HotelChainEliteStatus | null;
}

interface HotelChain {
  id: number;
  name: string;
  loyaltyProgram: string | null;
  basePointRate: number | null;
  pointTypeId: number | null;
  pointType: PointType | null;
  hotelChainSubBrands: HotelChainSubBrand[];
  eliteStatuses: HotelChainEliteStatus[];
  userStatus: UserStatus | null;
}

interface CreditCard {
  id: number;
  name: string;
  rewardType: string;
  rewardRate: number;
  pointTypeId: number | null;
  pointType: PointType | null;
}

interface ShoppingPortal {
  id: number;
  name: string;
  rewardType: string;
  pointTypeId: number | null;
  pointType: PointType | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  hotel: "Hotel",
  airline: "Airline",
  transferable: "Transferable",
};

// ---------------------------------------------------------------------------
// User Status Tab
// ---------------------------------------------------------------------------

function UserStatusTab() {
  const [userStatuses, setUserStatuses] = useState<UserStatus[]>([]);
  const [hotelChains, setHotelChains] = useState<HotelChain[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const [statusRes, chainsRes] = await Promise.all([
      fetch("/api/user-statuses"),
      fetch("/api/hotel-chains"),
    ]);
    if (statusRes.ok) setUserStatuses(await statusRes.json());
    if (chainsRes.ok) setHotelChains(await chainsRes.json());
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  const handleStatusChange = async (hotelChainId: number, eliteStatusId: string) => {
    setError(null);
    const res = await fetch("/api/user-statuses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hotelChainId,
        eliteStatusId: eliteStatusId === "none" ? null : Number(eliteStatusId),
      }),
    });
    if (res.ok) {
      fetchData();
    } else {
      setError(await extractApiError(res, "Failed to update status."));
    }
  };

  return (
    <div className="space-y-4">
      <ErrorBanner error={error} onDismiss={() => setError(null)} />
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">My Elite Status</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Select your current elite status level for each hotel chain to improve point earning
        calculations.
      </p>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Hotel Chain</TableHead>
            <TableHead>Current Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {hotelChains.map((chain) => {
            const currentStatus = userStatuses.find((us) => us.hotelChainId === chain.id);
            return (
              <TableRow key={chain.id}>
                <TableCell className="font-medium">{chain.name}</TableCell>
                <TableCell>
                  <Select
                    value={
                      currentStatus?.eliteStatusId ? String(currentStatus.eliteStatusId) : "none"
                    }
                    onValueChange={(v) => handleStatusChange(chain.id, v)}
                  >
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Select status..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Base Member / No Status</SelectItem>
                      {chain.eliteStatuses?.map((status) => (
                        <SelectItem key={status.id} value={String(status.id)}>
                          {status.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Point Types Tab
// ---------------------------------------------------------------------------

function PointTypesTab() {
  const [pointTypes, setPointTypes] = useState<PointType[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<"hotel" | "airline" | "transferable">("hotel");
  const [centsPerPoint, setCentsPerPoint] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editPt, setEditPt] = useState<PointType | null>(null);
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState<"hotel" | "airline" | "transferable">("hotel");
  const [editCentsPerPoint, setEditCentsPerPoint] = useState("");

  const fetchPointTypes = useCallback(async () => {
    const res = await fetch("/api/point-types");
    if (res.ok) {
      setPointTypes(await res.json());
    } else {
      setError(await extractApiError(res, "Failed to load point types."));
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchPointTypes();
  }, [fetchPointTypes]);

  const handleSubmit = async () => {
    setError(null);
    const res = await fetch("/api/point-types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, category, centsPerPoint: Number(centsPerPoint) }),
    });
    if (res.ok) {
      setName("");
      setCategory("hotel");
      setCentsPerPoint("");
      setOpen(false);
      fetchPointTypes();
    } else {
      setError(await extractApiError(res, "Failed to add point type."));
    }
  };

  const handleEdit = (pt: PointType) => {
    setEditPt(pt);
    setEditName(pt.name);
    setEditCategory(pt.category);
    setEditCentsPerPoint(String(Number(pt.centsPerPoint)));
    setEditOpen(true);
  };

  const handleEditSubmit = async () => {
    if (!editPt) return;
    setError(null);
    const res = await fetch(`/api/point-types/${editPt.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editName,
        category: editCategory,
        centsPerPoint: Number(editCentsPerPoint),
      }),
    });
    if (res.ok) {
      setEditOpen(false);
      setEditPt(null);
      fetchPointTypes();
    } else {
      setError(await extractApiError(res, "Failed to update point type."));
    }
  };

  const handleDelete = async (pt: PointType) => {
    setError(null);
    const res = await fetch(`/api/point-types/${pt.id}`, { method: "DELETE" });
    if (res.ok) {
      fetchPointTypes();
    } else if (res.status === 409) {
      setError("Cannot delete: this point type is in use by hotel chains, cards, or portals.");
    } else {
      setError(await extractApiError(res, "Failed to delete point type."));
    }
  };

  return (
    <div className="space-y-4">
      <ErrorBanner error={error} onDismiss={() => setError(null)} />
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Point Types</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>Add Point Type</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Point Type</DialogTitle>
              <DialogDescription>
                Define a loyalty currency (hotel points, airline miles, card rewards).
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="pt-name">Name</Label>
                <Input
                  id="pt-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Hilton Honors"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pt-category">Category</Label>
                <Select value={category} onValueChange={(v) => setCategory(v as typeof category)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hotel">Hotel</SelectItem>
                    <SelectItem value="airline">Airline</SelectItem>
                    <SelectItem value="transferable">Transferable</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pt-cpp">Value per Point ($)</Label>
                <Input
                  id="pt-cpp"
                  type="number"
                  step="0.000001"
                  value={centsPerPoint}
                  onChange={(e) => setCentsPerPoint(e.target.value)}
                  placeholder="e.g. 0.005"
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleSubmit} disabled={!name.trim() || !centsPerPoint}>
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
            <DialogTitle>Edit Point Type</DialogTitle>
            <DialogDescription>Update point type details.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-pt-name">Name</Label>
              <Input
                id="edit-pt-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="e.g. Hilton Honors"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-pt-category">Category</Label>
              <Select
                value={editCategory}
                onValueChange={(v) => setEditCategory(v as typeof editCategory)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hotel">Hotel</SelectItem>
                  <SelectItem value="airline">Airline</SelectItem>
                  <SelectItem value="transferable">Transferable</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-pt-cpp">Value per Point ($)</Label>
              <Input
                id="edit-pt-cpp"
                type="number"
                step="0.000001"
                value={editCentsPerPoint}
                onChange={(e) => setEditCentsPerPoint(e.target.value)}
                placeholder="e.g. 0.005"
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleEditSubmit} disabled={!editName.trim() || !editCentsPerPoint}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Value/Point</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pointTypes.length === 0 ? (
            <TableRow>
              <TableCell colSpan={3} className="text-center text-muted-foreground">
                No point types added yet.
              </TableCell>
            </TableRow>
          ) : (
            (["hotel", "airline", "transferable"] as const).flatMap((category) => {
              const group = pointTypes.filter((pt) => pt.category === category);
              if (group.length === 0) return [];
              return [
                <TableRow key={`header-${category}`}>
                  <TableCell
                    colSpan={3}
                    className="text-muted-foreground text-xs font-semibold uppercase tracking-wide bg-muted/30 py-1.5"
                  >
                    {CATEGORY_LABELS[category]}
                  </TableCell>
                </TableRow>,
                ...group.map((pt) => (
                  <TableRow key={pt.id}>
                    <TableCell>{pt.name}</TableCell>
                    <TableCell>${parseFloat(Number(pt.centsPerPoint).toFixed(6))}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(pt)}>
                          Edit
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(pt)}>
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )),
              ];
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hotel Chains Tab
// ---------------------------------------------------------------------------

function HotelChainsTab() {
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
  const [editSbOpen, setEditSbOpen] = useState(false);
  const [editSb, setEditSb] = useState<HotelChainSubBrand | null>(null);
  const [editSbName, setEditSbName] = useState("");
  const [editSbBaseRate, setEditSbBaseRate] = useState("");

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

  const handleEditSb = (sb: HotelChainSubBrand) => {
    setEditSb(sb);
    setEditSbName(sb.name);
    setEditSbBaseRate(sb.basePointRate != null ? String(sb.basePointRate) : "");
    setEditSbOpen(true);
  };

  const handleEditSbSubmit = async () => {
    if (!editSb) return;
    setError(null);
    const res = await fetch(`/api/hotel-chain-sub-brands/${editSb.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editSbName,
        basePointRate: editSbBaseRate ? Number(editSbBaseRate) : null,
      }),
    });
    if (res.ok) {
      setEditSbOpen(false);
      setEditSb(null);
      fetchData();
    } else {
      setError(await extractApiError(res, "Failed to update hotel chain sub-brand."));
    }
  };

  const handleDeleteSb = async (sb: HotelChainSubBrand) => {
    setError(null);
    const res = await fetch(`/api/hotel-chain-sub-brands/${sb.id}`, { method: "DELETE" });
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
            <Button>Add Hotel Chain</Button>
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
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-2 shrink-0">
            <DialogTitle>Sub-brands — {sbHotelChain?.name}</DialogTitle>
            <DialogDescription>
              Manage sub-brands with optional point rate overrides (blank = inherit from chain).
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-2 space-y-3">
            {!sbHotelChain || sbHotelChain.hotelChainSubBrands.length === 0 ? (
              <p className="text-sm text-muted-foreground">No sub-brands yet.</p>
            ) : (
              sbHotelChain.hotelChainSubBrands.map((sb) => (
                <div
                  key={sb.id}
                  className="flex items-center justify-between border rounded-md px-3 py-2"
                >
                  <div>
                    <span className="font-medium text-sm">{sb.name}</span>
                    {sb.basePointRate != null && (
                      <span className="text-xs text-muted-foreground ml-2">
                        {sb.basePointRate != null ? `Base: ${sb.basePointRate}x` : ""}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => handleEditSb(sb)}>
                      Edit
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteSb(sb)}>
                      Delete
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="border-t p-6 pt-3 space-y-2 shrink-0 bg-muted/20">
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
        </DialogContent>
      </Dialog>

      {/* Edit Sub-brand Dialog */}
      <Dialog open={editSbOpen} onOpenChange={setEditSbOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Sub-brand</DialogTitle>
            <DialogDescription>Update sub-brand name and point rate overrides.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-sb-name">Name</Label>
              <Input
                id="edit-sb-name"
                value={editSbName}
                onChange={(e) => setEditSbName(e.target.value)}
                placeholder="Sub-brand name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-sb-base-rate">Base Rate (per $1)</Label>
              <Input
                id="edit-sb-base-rate"
                type="number"
                step="0.1"
                value={editSbBaseRate}
                onChange={(e) => setEditSbBaseRate(e.target.value)}
                placeholder="Inherit from chain"
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleEditSbSubmit} disabled={!editSbName.trim()}>
              Save
            </Button>
          </DialogFooter>
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

// ---------------------------------------------------------------------------
// Credit Cards Tab
// ---------------------------------------------------------------------------

function CreditCardsTab() {
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [pointTypes, setPointTypes] = useState<PointType[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [rewardType, setRewardType] = useState("points");
  const [rewardRate, setRewardRate] = useState("");
  const [pointTypeId, setPointTypeId] = useState("none");
  const [error, setError] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editCard, setEditCard] = useState<CreditCard | null>(null);
  const [editName, setEditName] = useState("");
  const [editRewardType, setEditRewardType] = useState("points");
  const [editRewardRate, setEditRewardRate] = useState("");
  const [editPointTypeId, setEditPointTypeId] = useState("none");

  const fetchData = useCallback(async () => {
    const [cardsRes, ptRes] = await Promise.all([
      fetch("/api/credit-cards"),
      fetch("/api/point-types"),
    ]);
    if (cardsRes.ok) setCards(await cardsRes.json());
    else setError(await extractApiError(cardsRes, "Failed to load credit cards."));
    if (ptRes.ok) setPointTypes(await ptRes.json());
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  const handleSubmit = async () => {
    setError(null);
    const res = await fetch("/api/credit-cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        rewardType,
        rewardRate: Number(rewardRate),
        pointTypeId: pointTypeId !== "none" ? Number(pointTypeId) : null,
      }),
    });
    if (res.ok) {
      setName("");
      setRewardType("points");
      setRewardRate("");
      setPointTypeId("none");
      setOpen(false);
      fetchData();
    } else {
      setError(await extractApiError(res, "Failed to add credit card."));
    }
  };

  const handleEdit = (card: CreditCard) => {
    setEditCard(card);
    setEditName(card.name);
    setEditRewardType(card.rewardType);
    setEditRewardRate(String(card.rewardRate));
    setEditPointTypeId(card.pointTypeId != null ? String(card.pointTypeId) : "none");
    setEditOpen(true);
  };

  const handleEditSubmit = async () => {
    if (!editCard) return;
    setError(null);
    const res = await fetch(`/api/credit-cards/${editCard.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editName,
        rewardType: editRewardType,
        rewardRate: Number(editRewardRate),
        pointTypeId: editPointTypeId !== "none" ? Number(editPointTypeId) : null,
      }),
    });
    if (res.ok) {
      setEditOpen(false);
      setEditCard(null);
      fetchData();
    } else {
      setError(await extractApiError(res, "Failed to update credit card."));
    }
  };

  return (
    <div className="space-y-4">
      <ErrorBanner error={error} onDismiss={() => setError(null)} />
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Credit Cards</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>Add Credit Card</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Credit Card</DialogTitle>
              <DialogDescription>Add a credit card to track rewards.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="card-name">Name</Label>
                <Input
                  id="card-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Card name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="card-reward-type">Reward Type</Label>
                <Select value={rewardType} onValueChange={setRewardType}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select reward type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="points">Points</SelectItem>
                    <SelectItem value="cashback">Cashback</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="card-reward-rate">Reward Rate</Label>
                <Input
                  id="card-reward-rate"
                  type="number"
                  step="0.01"
                  value={rewardRate}
                  onChange={(e) => setRewardRate(e.target.value)}
                  placeholder="e.g. 3"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="card-point-type">Point Type</Label>
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
              <Button onClick={handleSubmit} disabled={!name.trim() || !rewardRate}>
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
            <DialogTitle>Edit Credit Card</DialogTitle>
            <DialogDescription>Update credit card details and reward rate.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-card-name">Name</Label>
              <Input
                id="edit-card-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Card name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-card-reward-type">Reward Type</Label>
              <Select value={editRewardType} onValueChange={setEditRewardType}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select reward type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="points">Points</SelectItem>
                  <SelectItem value="cashback">Cashback</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-card-reward-rate">Reward Rate</Label>
              <Input
                id="edit-card-reward-rate"
                type="number"
                step="0.01"
                value={editRewardRate}
                onChange={(e) => setEditRewardRate(e.target.value)}
                placeholder="e.g. 3"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-card-point-type">Point Type</Label>
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
            <Button onClick={handleEditSubmit} disabled={!editName.trim() || !editRewardRate}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Reward Type</TableHead>
            <TableHead>Reward Rate</TableHead>
            <TableHead>Point Type</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {cards.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground">
                No credit cards added yet.
              </TableCell>
            </TableRow>
          ) : (
            cards.map((card) => (
              <TableRow key={card.id}>
                <TableCell>{card.name}</TableCell>
                <TableCell className="capitalize">{card.rewardType}</TableCell>
                <TableCell>{card.rewardRate}</TableCell>
                <TableCell>{card.pointType?.name ?? "—"}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" onClick={() => handleEdit(card)}>
                    Edit
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shopping Portals Tab
// ---------------------------------------------------------------------------

function ShoppingPortalsTab() {
  const [portals, setPortals] = useState<ShoppingPortal[]>([]);
  const [pointTypes, setPointTypes] = useState<PointType[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [rewardType, setRewardType] = useState("cashback");
  const [pointTypeId, setPointTypeId] = useState("none");
  const [error, setError] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editPortal, setEditPortal] = useState<ShoppingPortal | null>(null);
  const [editName, setEditName] = useState("");
  const [editRewardType, setEditRewardType] = useState("cashback");
  const [editPointTypeId, setEditPointTypeId] = useState("none");

  const fetchData = useCallback(async () => {
    const [portalsRes, ptRes] = await Promise.all([
      fetch("/api/portals"),
      fetch("/api/point-types"),
    ]);
    if (portalsRes.ok) setPortals(await portalsRes.json());
    else setError(await extractApiError(portalsRes, "Failed to load shopping portals."));
    if (ptRes.ok) setPointTypes(await ptRes.json());
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  const handleSubmit = async () => {
    setError(null);
    const res = await fetch("/api/portals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        rewardType,
        pointTypeId: rewardType === "points" && pointTypeId !== "none" ? Number(pointTypeId) : null,
      }),
    });
    if (res.ok) {
      setName("");
      setRewardType("cashback");
      setPointTypeId("none");
      setOpen(false);
      fetchData();
    } else {
      setError(await extractApiError(res, "Failed to add shopping portal."));
    }
  };

  const handleEdit = (portal: ShoppingPortal) => {
    setEditPortal(portal);
    setEditName(portal.name);
    setEditRewardType(portal.rewardType);
    setEditPointTypeId(portal.pointTypeId != null ? String(portal.pointTypeId) : "none");
    setEditOpen(true);
  };

  const handleEditSubmit = async () => {
    if (!editPortal) return;
    setError(null);
    const res = await fetch(`/api/portals/${editPortal.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editName,
        rewardType: editRewardType,
        pointTypeId:
          editRewardType === "points" && editPointTypeId !== "none"
            ? Number(editPointTypeId)
            : null,
      }),
    });
    if (res.ok) {
      setEditOpen(false);
      setEditPortal(null);
      fetchData();
    } else {
      setError(await extractApiError(res, "Failed to update shopping portal."));
    }
  };

  return (
    <div className="space-y-4">
      <ErrorBanner error={error} onDismiss={() => setError(null)} />
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Shopping Portals</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>Add Portal</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Shopping Portal</DialogTitle>
              <DialogDescription>
                Add a shopping portal for cashback or points tracking.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="portal-name">Name</Label>
                <Input
                  id="portal-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Portal name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="portal-reward-type">Reward Type</Label>
                <Select value={rewardType} onValueChange={setRewardType}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select reward type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cashback">Cashback</SelectItem>
                    <SelectItem value="points">Points</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {rewardType === "points" && (
                <div className="space-y-2">
                  <Label htmlFor="portal-point-type">Point Type</Label>
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
              )}
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
            <DialogTitle>Edit Shopping Portal</DialogTitle>
            <DialogDescription>Update shopping portal details.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-portal-name">Name</Label>
              <Input
                id="edit-portal-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Portal name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-portal-reward-type">Reward Type</Label>
              <Select value={editRewardType} onValueChange={setEditRewardType}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select reward type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cashback">Cashback</SelectItem>
                  <SelectItem value="points">Points</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {editRewardType === "points" && (
              <div className="space-y-2">
                <Label htmlFor="edit-portal-point-type">Point Type</Label>
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
            )}
          </div>
          <DialogFooter>
            <Button onClick={handleEditSubmit} disabled={!editName.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Reward Type</TableHead>
            <TableHead>Point Type</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {portals.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground">
                No shopping portals added yet.
              </TableCell>
            </TableRow>
          ) : (
            portals.map((portal) => (
              <TableRow key={portal.id}>
                <TableCell>{portal.name}</TableCell>
                <TableCell className="capitalize">{portal.rewardType}</TableCell>
                <TableCell>{portal.pointType?.name ?? "—"}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" onClick={() => handleEdit(portal)}>
                    Edit
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// OTA Agencies Tab
// ---------------------------------------------------------------------------

interface OtaAgency {
  id: number;
  name: string;
}

function OtaAgenciesTab() {
  const [agencies, setAgencies] = useState<OtaAgency[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editAgency, setEditAgency] = useState<OtaAgency | null>(null);
  const [editName, setEditName] = useState("");

  const fetchAgencies = useCallback(async () => {
    const res = await fetch("/api/ota-agencies");
    if (res.ok) setAgencies(await res.json());
    else setError(await extractApiError(res, "Failed to load OTA agencies."));
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAgencies();
  }, [fetchAgencies]);

  const handleSubmit = async () => {
    setError(null);
    const res = await fetch("/api/ota-agencies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      setName("");
      setOpen(false);
      fetchAgencies();
    } else {
      setError(await extractApiError(res, "Failed to add OTA agency."));
    }
  };

  const handleEdit = (agency: OtaAgency) => {
    setEditAgency(agency);
    setEditName(agency.name);
    setEditOpen(true);
  };

  const handleEditSubmit = async () => {
    if (!editAgency) return;
    setError(null);
    const res = await fetch(`/api/ota-agencies/${editAgency.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName }),
    });
    if (res.ok) {
      setEditOpen(false);
      setEditAgency(null);
      fetchAgencies();
    } else {
      setError(await extractApiError(res, "Failed to update OTA agency."));
    }
  };

  const handleDelete = async (agency: OtaAgency) => {
    setError(null);
    const res = await fetch(`/api/ota-agencies/${agency.id}`, { method: "DELETE" });
    if (res.ok) {
      fetchAgencies();
    } else if (res.status === 409) {
      setError("Cannot delete: this agency is referenced by existing bookings.");
    } else {
      setError(await extractApiError(res, "Failed to delete OTA agency."));
    }
  };

  return (
    <div className="space-y-4">
      <ErrorBanner error={error} onDismiss={() => setError(null)} />
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">OTA Agencies</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>Add Agency</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add OTA Agency</DialogTitle>
              <DialogDescription>
                Add an online travel agency to track bookings made through it.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="agency-name">Name</Label>
                <Input
                  id="agency-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Chase Travel"
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
            <DialogTitle>Edit OTA Agency</DialogTitle>
            <DialogDescription>Update agency name.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-agency-name">Name</Label>
              <Input
                id="edit-agency-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="e.g. Chase Travel"
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

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {agencies.length === 0 ? (
            <TableRow>
              <TableCell colSpan={2} className="text-center text-muted-foreground">
                No OTA agencies added yet.
              </TableCell>
            </TableRow>
          ) : (
            agencies.map((agency) => (
              <TableRow key={agency.id}>
                <TableCell>{agency.name}</TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(agency)}>
                      Edit
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(agency)}>
                      Delete
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

// ---------------------------------------------------------------------------
// Settings Page
// ---------------------------------------------------------------------------

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>
      <Tabs defaultValue="my-status">
        <TabsList>
          <TabsTrigger value="my-status">My Status</TabsTrigger>
          <TabsTrigger value="point-types">Point Types</TabsTrigger>
          <TabsTrigger value="hotels">Hotel Chains</TabsTrigger>
          <TabsTrigger value="credit-cards">Credit Cards</TabsTrigger>
          <TabsTrigger value="portals">Shopping Portals</TabsTrigger>
          <TabsTrigger value="ota-agencies">OTA Agencies</TabsTrigger>
        </TabsList>
        <TabsContent value="my-status">
          <UserStatusTab />
        </TabsContent>
        <TabsContent value="point-types">
          <PointTypesTab />
        </TabsContent>
        <TabsContent value="hotels">
          <HotelChainsTab />
        </TabsContent>
        <TabsContent value="credit-cards">
          <CreditCardsTab />
        </TabsContent>
        <TabsContent value="portals">
          <ShoppingPortalsTab />
        </TabsContent>
        <TabsContent value="ota-agencies">
          <OtaAgenciesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
