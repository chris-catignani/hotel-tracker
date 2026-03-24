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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { apiFetch } from "@/lib/api-fetch";
import { logger } from "@/lib/logger";
import { CATEGORY_LABELS } from "@/lib/constants";
import { PointType } from "@/lib/types";
import { ErrorBanner } from "@/components/ui/error-banner";
import { EmptyState } from "@/components/ui/empty-state";
import { Coins } from "lucide-react";
import { toast } from "sonner";

export function PointTypesTab() {
  const [pointTypes, setPointTypes] = useState<PointType[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<"hotel" | "airline" | "transferable">("hotel");
  const [usdCentsPerPoint, setUsdCentsPerPoint] = useState("");
  const [isForeignCurrency, setIsForeignCurrency] = useState(false);
  const [programCurrency, setProgramCurrency] = useState("");
  const [programCentsPerPoint, setProgramCentsPerPoint] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editPt, setEditPt] = useState<PointType | null>(null);
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState<"hotel" | "airline" | "transferable">("hotel");
  const [editUsdCentsPerPoint, setEditUsdCentsPerPoint] = useState("");
  const [editIsForeignCurrency, setEditIsForeignCurrency] = useState(false);
  const [editProgramCurrency, setEditProgramCurrency] = useState("");
  const [editProgramCentsPerPoint, setEditProgramCentsPerPoint] = useState("");
  const [showEditErrors, setShowEditErrors] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [ptToDelete, setPtToDelete] = useState<PointType | null>(null);

  const fetchPointTypes = useCallback(async () => {
    const result = await apiFetch<PointType[]>("/api/point-types");
    if (result.ok) {
      setPointTypes(result.data);
    } else {
      setError(result.error.message);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchPointTypes();
  }, [fetchPointTypes]);

  const validate = useCallback(
    (n: string, cpp: string) => ({
      name: !n.trim() ? "Name is required" : "",
      usdCentsPerPoint: !cpp ? "Value is required" : "",
    }),
    []
  );

  const currentErrors = validate(name, usdCentsPerPoint);
  const isValid = !currentErrors.name && !currentErrors.usdCentsPerPoint;

  const handleSubmit = async () => {
    setShowErrors(true);
    if (!isValid) return;

    const result = await apiFetch("/api/point-types", {
      method: "POST",
      body: {
        name,
        category,
        usdCentsPerPoint: Number(usdCentsPerPoint),
        programCurrency: isForeignCurrency ? programCurrency.trim() || null : null,
        programCentsPerPoint:
          isForeignCurrency && programCentsPerPoint ? Number(programCentsPerPoint) : null,
      },
    });
    if (result.ok) {
      setName("");
      setCategory("hotel");
      setUsdCentsPerPoint("");
      setIsForeignCurrency(false);
      setProgramCurrency("");
      setProgramCentsPerPoint("");
      setShowErrors(false);
      setOpen(false);
      fetchPointTypes();
    } else {
      logger.error("Failed to add point type", result.error, { status: result.status });
      toast.error("Failed to add point type. Please try again.");
    }
  };

  const handleEdit = (pt: PointType) => {
    setEditPt(pt);
    setEditName(pt.name);
    setEditCategory(pt.category);
    setEditUsdCentsPerPoint(String(Number(pt.usdCentsPerPoint)));
    const hasForeign = pt.programCurrency != null;
    setEditIsForeignCurrency(hasForeign);
    setEditProgramCurrency(pt.programCurrency ?? "");
    setEditProgramCentsPerPoint(
      pt.programCentsPerPoint != null ? String(Number(pt.programCentsPerPoint)) : ""
    );
    setShowEditErrors(false);
    setEditOpen(true);
  };

  const editErrors = validate(editName, editUsdCentsPerPoint);
  const isEditValid = !editErrors.name && !editErrors.usdCentsPerPoint;

  const handleEditSubmit = async () => {
    if (!editPt) return;
    setShowEditErrors(true);
    if (!isEditValid) return;

    const result = await apiFetch(`/api/point-types/${editPt.id}`, {
      method: "PUT",
      body: {
        name: editName,
        category: editCategory,
        usdCentsPerPoint: Number(editUsdCentsPerPoint),
        programCurrency: editIsForeignCurrency ? editProgramCurrency.trim() || null : null,
        programCentsPerPoint:
          editIsForeignCurrency && editProgramCentsPerPoint
            ? Number(editProgramCentsPerPoint)
            : null,
      },
    });
    if (result.ok) {
      setEditOpen(false);
      setEditPt(null);
      setShowEditErrors(false);
      fetchPointTypes();
    } else {
      logger.error("Failed to update point type", result.error, { status: result.status });
      toast.error("Failed to update point type. Please try again.");
    }
  };

  const handleDeleteClick = (pt: PointType) => {
    setPtToDelete(pt);
    setDeleteOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!ptToDelete) return;
    setDeleteOpen(false);
    const result = await apiFetch(`/api/point-types/${ptToDelete.id}`, { method: "DELETE" });
    if (result.ok) {
      setPtToDelete(null);
      fetchPointTypes();
    } else if (result.status === 409) {
      toast.error("Cannot delete: this point type is in use by hotel chains, cards, or portals.");
    } else {
      logger.error("Failed to delete point type", result.error, { status: result.status });
      toast.error("Failed to delete point type. Please try again.");
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 space-y-4">
      <ErrorBanner error={error} onDismiss={() => setError(null)} />
      <div className="flex items-center justify-between shrink-0">
        <h2 className="text-lg font-semibold">Point Types</h2>
        <Dialog
          open={open}
          onOpenChange={(o) => {
            setOpen(o);
            if (!o) setShowErrors(false);
          }}
        >
          <DialogTrigger asChild>
            <Button data-testid="add-point-type-button">Add Point Type</Button>
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
                <Label htmlFor="pt-name">Name *</Label>
                <Input
                  id="pt-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Hilton Honors"
                  error={showErrors ? currentErrors.name : ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pt-category">Category</Label>
                <AppSelect
                  value={category}
                  onValueChange={(v) => setCategory(v as typeof category)}
                  options={[
                    { label: "Hotel", value: "hotel" },
                    { label: "Airline", value: "airline" },
                    { label: "Transferable", value: "transferable" },
                  ]}
                  placeholder="Select category"
                  data-testid="pt-category-select"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pt-cpp">USD Value per Point ($) *</Label>
                <Input
                  id="pt-cpp"
                  type="number"
                  step="0.000001"
                  value={usdCentsPerPoint}
                  onChange={(e) => setUsdCentsPerPoint(e.target.value)}
                  placeholder="e.g. 0.005"
                  error={showErrors ? currentErrors.usdCentsPerPoint : ""}
                />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="pt-foreign-currency"
                  checked={isForeignCurrency}
                  onCheckedChange={(v) => setIsForeignCurrency(!!v)}
                  data-testid="pt-foreign-currency-checkbox"
                />
                <Label htmlFor="pt-foreign-currency" className="font-normal cursor-pointer">
                  Points are denominated in a non-USD currency
                </Label>
              </div>
              {isForeignCurrency && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="pt-program-currency">Program Currency</Label>
                    <Input
                      id="pt-program-currency"
                      value={programCurrency}
                      onChange={(e) => setProgramCurrency(e.target.value)}
                      placeholder="e.g. EUR"
                      data-testid="pt-program-currency"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pt-program-cpp">Program Value per Point</Label>
                    <Input
                      id="pt-program-cpp"
                      type="number"
                      step="0.000001"
                      value={programCentsPerPoint}
                      onChange={(e) => setProgramCentsPerPoint(e.target.value)}
                      placeholder="e.g. 0.02"
                      data-testid="pt-program-cpp"
                    />
                  </div>
                </>
              )}
            </div>
            <DialogFooter>
              <Button onClick={handleSubmit}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Dialog */}
      <Dialog
        open={editOpen}
        onOpenChange={(o) => {
          setEditOpen(o);
          if (!o) setShowEditErrors(false);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Point Type</DialogTitle>
            <DialogDescription>Update point type details.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-pt-name">Name *</Label>
              <Input
                id="edit-pt-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="e.g. Hilton Honors"
                error={showEditErrors ? editErrors.name : ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-pt-category">Category</Label>
              <AppSelect
                value={editCategory}
                onValueChange={(v) => setEditCategory(v as typeof editCategory)}
                options={[
                  { label: "Hotel", value: "hotel" },
                  { label: "Airline", value: "airline" },
                  { label: "Transferable", value: "transferable" },
                ]}
                placeholder="Select category"
                data-testid="edit-pt-category-select"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-pt-cpp">USD Value per Point ($) *</Label>
              <Input
                id="edit-pt-cpp"
                type="number"
                step="0.000001"
                value={editUsdCentsPerPoint}
                onChange={(e) => setEditUsdCentsPerPoint(e.target.value)}
                placeholder="e.g. 0.005"
                error={showEditErrors ? editErrors.usdCentsPerPoint : ""}
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="edit-pt-foreign-currency"
                checked={editIsForeignCurrency}
                onCheckedChange={(v) => setEditIsForeignCurrency(!!v)}
                data-testid="edit-pt-foreign-currency-checkbox"
              />
              <Label htmlFor="edit-pt-foreign-currency" className="font-normal cursor-pointer">
                Points are denominated in a non-USD currency
              </Label>
            </div>
            {editIsForeignCurrency && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="edit-pt-program-currency">Program Currency</Label>
                  <Input
                    id="edit-pt-program-currency"
                    value={editProgramCurrency}
                    onChange={(e) => setEditProgramCurrency(e.target.value)}
                    placeholder="e.g. EUR"
                    data-testid="edit-pt-program-currency"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-pt-program-cpp">Program Value per Point</Label>
                  <Input
                    id="edit-pt-program-cpp"
                    type="number"
                    step="0.000001"
                    value={editProgramCentsPerPoint}
                    onChange={(e) => setEditProgramCentsPerPoint(e.target.value)}
                    placeholder="e.g. 0.02"
                    data-testid="edit-pt-program-cpp"
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button onClick={handleEditSubmit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Point Type?"
        description={
          ptToDelete
            ? `Are you sure you want to delete "${ptToDelete.name}"? This cannot be undone.`
            : ""
        }
        onConfirm={handleDeleteConfirm}
      />

      {pointTypes.length === 0 ? (
        <EmptyState
          icon={Coins}
          title="No point types"
          description="Define point values for hotel chains, credit cards, and portals."
          action={{
            label: "Add Point Type",
            onClick: () => setOpen(true),
          }}
          data-testid="point-types-empty"
        />
      ) : (
        <>
          {/* Mobile View: Cards */}
          <div className="grid grid-cols-1 gap-4 md:hidden" data-testid="point-types-mobile">
            {(["hotel", "airline", "transferable"] as const).flatMap((category) => {
              const group = pointTypes.filter((pt) => pt.category === category);
              if (group.length === 0) return [];
              return [
                <div key={`header-mobile-${category}`} className="pt-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground bg-muted/30 px-2 py-1 rounded">
                    {CATEGORY_LABELS[category]}
                  </h3>
                </div>,
                ...group.map((pt) => (
                  <Card key={pt.id} data-testid="point-type-card">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <h4 className="font-bold" data-testid="point-type-name">
                          {pt.name}
                        </h4>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">USD Value/Point</p>
                          <p className="font-medium">
                            ${parseFloat(Number(pt.usdCentsPerPoint).toFixed(3))}
                            {pt.programCurrency && pt.programCentsPerPoint != null
                              ? ` (${pt.programCurrency} ${parseFloat(Number(pt.programCentsPerPoint).toFixed(3))})`
                              : ""}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2 pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => handleEdit(pt)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 text-destructive"
                          onClick={() => handleDeleteClick(pt)}
                        >
                          Delete
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )),
              ];
            })}
          </div>

          {/* Desktop View: Table */}
          <div
            className="hidden md:flex md:flex-col md:flex-1 md:min-h-0 md:overflow-auto"
            data-testid="point-types-desktop"
          >
            <Table containerClassName="overflow-visible">
              <TableHeader className="sticky top-0 bg-background z-20">
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>USD Value/Point</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(["hotel", "airline", "transferable"] as const).flatMap((category) => {
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
                      <TableRow key={pt.id} data-testid="point-type-row">
                        <TableCell data-testid="point-type-name">{pt.name}</TableCell>
                        <TableCell>
                          ${parseFloat(Number(pt.usdCentsPerPoint).toFixed(3))}
                          {pt.programCurrency && pt.programCentsPerPoint != null
                            ? ` (${pt.programCurrency} ${parseFloat(Number(pt.programCentsPerPoint).toFixed(3))})`
                            : ""}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button variant="ghost" size="sm" onClick={() => handleEdit(pt)}>
                              Edit
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDeleteClick(pt)}>
                              Delete
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )),
                  ];
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
