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
import { CATEGORY_LABELS } from "@/lib/constants";
import { PointType } from "@/lib/types";
import { ErrorBanner } from "@/components/ui/error-banner";

export function PointTypesTab() {
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
