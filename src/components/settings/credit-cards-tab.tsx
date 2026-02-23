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
import { CreditCard, PointType } from "@/lib/types";
import { ErrorBanner } from "@/components/ui/error-banner";

export function CreditCardsTab() {
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
            <Button data-testid="add-credit-card-button">Add Credit Card</Button>
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

            {/* Mobile View: Cards */}
            <div className="grid grid-cols-1 gap-4 md:hidden" data-testid="credit-cards-mobile">
              {cards.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No credit cards added yet.</p>
              ) : (
                cards.map((card) => (
                  <Card key={card.id} data-testid="credit-card-card">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-bold" data-testid="credit-card-card-name">
                            {card.name}
                          </h3>
                          <p className="text-sm text-muted-foreground capitalize">{card.rewardType}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium">Rate</p>
                          <p className="text-lg font-bold">{card.rewardRate}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Point Type</span>
                        <span className="font-medium">{card.pointType?.name ?? "—"}</span>
                      </div>
                      <div className="pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => handleEdit(card)}
                        >
                          Edit
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
      
            {/* Desktop View: Table */}
            <div className="hidden md:block" data-testid="credit-cards-desktop">
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
                      <TableRow key={card.id} data-testid="credit-card-table-row">
                        <TableCell className="font-medium" data-testid="credit-card-table-name">
                          {card.name}
                        </TableCell>
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
      
    </div>
  );
}
