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

function ErrorBanner({
  error,
  onDismiss,
}: {
  error: string | null;
  onDismiss: () => void;
}) {
  if (!error) return null;
  return (
    <div className="rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
      <div className="flex items-start justify-between gap-2">
        <pre className="whitespace-pre-wrap font-mono text-xs flex-1">
          {error}
        </pre>
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

interface Hotel {
  id: number;
  name: string;
  loyaltyProgram: string | null;
  basePointRate: number | null;
  elitePointRate: number | null;
  pointValue: number | null;
}

interface CreditCard {
  id: number;
  name: string;
  rewardType: string;
  rewardRate: number;
  pointValue: number;
}

interface ShoppingPortal {
  id: number;
  name: string;
}

// ---------------------------------------------------------------------------
// Hotel Chains Tab
// ---------------------------------------------------------------------------

function HotelChainsTab() {
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [loyaltyProgram, setLoyaltyProgram] = useState("");
  const [basePointRate, setBasePointRate] = useState("");
  const [elitePointRate, setElitePointRate] = useState("");
  const [pointValue, setPointValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editHotel, setEditHotel] = useState<Hotel | null>(null);
  const [editName, setEditName] = useState("");
  const [editLoyaltyProgram, setEditLoyaltyProgram] = useState("");
  const [editBasePointRate, setEditBasePointRate] = useState("");
  const [editElitePointRate, setEditElitePointRate] = useState("");
  const [editPointValue, setEditPointValue] = useState("");

  const fetchHotels = useCallback(async () => {
    const res = await fetch("/api/hotels");
    if (res.ok) {
      setHotels(await res.json());
    } else {
      setError(await extractApiError(res, "Failed to load hotel chains."));
    }
  }, []);

  useEffect(() => {
    fetchHotels();
  }, [fetchHotels]);

  const handleSubmit = async () => {
    setError(null);
    const res = await fetch("/api/hotels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        loyaltyProgram: loyaltyProgram || null,
        basePointRate: basePointRate ? Number(basePointRate) : null,
        elitePointRate: elitePointRate ? Number(elitePointRate) : null,
        pointValue: pointValue ? Number(pointValue) : null,
      }),
    });
    if (res.ok) {
      setName("");
      setLoyaltyProgram("");
      setBasePointRate("");
      setElitePointRate("");
      setPointValue("");
      setOpen(false);
      fetchHotels();
    } else {
      setError(await extractApiError(res, "Failed to add hotel chain."));
    }
  };

  const handleEdit = (hotel: Hotel) => {
    setEditHotel(hotel);
    setEditName(hotel.name);
    setEditLoyaltyProgram(hotel.loyaltyProgram || "");
    setEditBasePointRate(hotel.basePointRate != null ? String(hotel.basePointRate) : "");
    setEditElitePointRate(hotel.elitePointRate != null ? String(hotel.elitePointRate) : "");
    setEditPointValue(hotel.pointValue != null ? String(hotel.pointValue) : "");
    setEditOpen(true);
  };

  const handleEditSubmit = async () => {
    if (!editHotel) return;
    setError(null);
    const res = await fetch(`/api/hotels/${editHotel.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editName,
        loyaltyProgram: editLoyaltyProgram || null,
        basePointRate: editBasePointRate ? Number(editBasePointRate) : null,
        elitePointRate: editElitePointRate ? Number(editElitePointRate) : null,
        pointValue: editPointValue ? Number(editPointValue) : null,
      }),
    });
    if (res.ok) {
      setEditOpen(false);
      setEditHotel(null);
      fetchHotels();
    } else {
      setError(await extractApiError(res, "Failed to update hotel chain."));
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
              <DialogDescription>
                Add a new hotel chain to track bookings for.
              </DialogDescription>
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
                <Label htmlFor="hotel-elite-rate">Elite Point Rate (per $1)</Label>
                <Input
                  id="hotel-elite-rate"
                  type="number"
                  step="0.1"
                  value={elitePointRate}
                  onChange={(e) => setElitePointRate(e.target.value)}
                  placeholder="e.g. 10"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hotel-point-value">Point Value ($)</Label>
                <Input
                  id="hotel-point-value"
                  type="number"
                  step="0.001"
                  value={pointValue}
                  onChange={(e) => setPointValue(e.target.value)}
                  placeholder="e.g. 0.005"
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
            <DialogDescription>
              Update hotel chain details and point rates.
            </DialogDescription>
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
              <Label htmlFor="edit-hotel-elite-rate">Elite Point Rate (per $1)</Label>
              <Input
                id="edit-hotel-elite-rate"
                type="number"
                step="0.1"
                value={editElitePointRate}
                onChange={(e) => setEditElitePointRate(e.target.value)}
                placeholder="e.g. 10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-hotel-point-value">Point Value ($)</Label>
              <Input
                id="edit-hotel-point-value"
                type="number"
                step="0.001"
                value={editPointValue}
                onChange={(e) => setEditPointValue(e.target.value)}
                placeholder="e.g. 0.005"
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
            <TableHead>Loyalty Program</TableHead>
            <TableHead>Base Rate</TableHead>
            <TableHead>Elite Rate</TableHead>
            <TableHead>Point Value</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {hotels.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                No hotel chains added yet.
              </TableCell>
            </TableRow>
          ) : (
            hotels.map((hotel) => (
              <TableRow key={hotel.id}>
                <TableCell>{hotel.name}</TableCell>
                <TableCell>{hotel.loyaltyProgram ?? "-"}</TableCell>
                <TableCell>{hotel.basePointRate ?? "-"}</TableCell>
                <TableCell>{hotel.elitePointRate ?? "-"}</TableCell>
                <TableCell>{hotel.pointValue != null ? `$${hotel.pointValue}` : "-"}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" onClick={() => handleEdit(hotel)}>
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
// Credit Cards Tab
// ---------------------------------------------------------------------------

function CreditCardsTab() {
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [rewardType, setRewardType] = useState("points");
  const [rewardRate, setRewardRate] = useState("");
  const [pointValue, setPointValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editCard, setEditCard] = useState<CreditCard | null>(null);
  const [editName, setEditName] = useState("");
  const [editRewardType, setEditRewardType] = useState("points");
  const [editRewardRate, setEditRewardRate] = useState("");
  const [editPointValue, setEditPointValue] = useState("");

  const fetchCards = useCallback(async () => {
    const res = await fetch("/api/credit-cards");
    if (res.ok) {
      setCards(await res.json());
    } else {
      setError(await extractApiError(res, "Failed to load credit cards."));
    }
  }, []);

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  const handleSubmit = async () => {
    setError(null);
    const res = await fetch("/api/credit-cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        rewardType,
        rewardRate: Number(rewardRate),
        pointValue: Number(pointValue),
      }),
    });
    if (res.ok) {
      setName("");
      setRewardType("points");
      setRewardRate("");
      setPointValue("");
      setOpen(false);
      fetchCards();
    } else {
      setError(await extractApiError(res, "Failed to add credit card."));
    }
  };

  const handleEdit = (card: CreditCard) => {
    setEditCard(card);
    setEditName(card.name);
    setEditRewardType(card.rewardType);
    setEditRewardRate(String(card.rewardRate));
    setEditPointValue(String(card.pointValue));
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
        pointValue: Number(editPointValue),
      }),
    });
    if (res.ok) {
      setEditOpen(false);
      setEditCard(null);
      fetchCards();
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
              <DialogDescription>
                Add a credit card to track rewards.
              </DialogDescription>
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
                <Label htmlFor="card-point-value">Point Value</Label>
                <Input
                  id="card-point-value"
                  type="number"
                  step="0.001"
                  value={pointValue}
                  onChange={(e) => setPointValue(e.target.value)}
                  placeholder="e.g. 0.01"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={handleSubmit}
                disabled={!name.trim() || !rewardRate || !pointValue}
              >
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
            <DialogDescription>
              Update credit card details and reward rate.
            </DialogDescription>
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
              <Label htmlFor="edit-card-point-value">Point Value</Label>
              <Input
                id="edit-card-point-value"
                type="number"
                step="0.001"
                value={editPointValue}
                onChange={(e) => setEditPointValue(e.target.value)}
                placeholder="e.g. 0.01"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={handleEditSubmit}
              disabled={!editName.trim() || !editRewardRate || !editPointValue}
            >
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
            <TableHead>Point Value</TableHead>
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
                <TableCell>{card.pointValue}</TableCell>
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
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const fetchPortals = useCallback(async () => {
    const res = await fetch("/api/portals");
    if (res.ok) {
      setPortals(await res.json());
    } else {
      setError(await extractApiError(res, "Failed to load shopping portals."));
    }
  }, []);

  useEffect(() => {
    fetchPortals();
  }, [fetchPortals]);

  const handleSubmit = async () => {
    setError(null);
    const res = await fetch("/api/portals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      setName("");
      setOpen(false);
      fetchPortals();
    } else {
      setError(await extractApiError(res, "Failed to add shopping portal."));
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
                Add a shopping portal for cashback tracking.
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
            </div>
            <DialogFooter>
              <Button onClick={handleSubmit} disabled={!name.trim()}>
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {portals.length === 0 ? (
            <TableRow>
              <TableCell className="text-center text-muted-foreground">
                No shopping portals added yet.
              </TableCell>
            </TableRow>
          ) : (
            portals.map((portal) => (
              <TableRow key={portal.id}>
                <TableCell>{portal.name}</TableCell>
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
      <Tabs defaultValue="hotels">
        <TabsList>
          <TabsTrigger value="hotels">Hotel Chains</TabsTrigger>
          <TabsTrigger value="credit-cards">Credit Cards</TabsTrigger>
          <TabsTrigger value="portals">Shopping Portals</TabsTrigger>
        </TabsList>
        <TabsContent value="hotels">
          <HotelChainsTab />
        </TabsContent>
        <TabsContent value="credit-cards">
          <CreditCardsTab />
        </TabsContent>
        <TabsContent value="portals">
          <ShoppingPortalsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
