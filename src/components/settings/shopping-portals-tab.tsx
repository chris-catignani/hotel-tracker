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
import { PointType, ShoppingPortal } from "@/lib/types";
import { ErrorBanner } from "./error-banner";

export function ShoppingPortalsTab() {
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
