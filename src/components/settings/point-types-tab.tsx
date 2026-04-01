// src/components/settings/point-types-tab.tsx
"use client";

import { useCallback, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AppSelect } from "@/components/ui/app-select";
import { Checkbox } from "@/components/ui/checkbox";
import { apiFetch } from "@/lib/api-fetch";
import { logger } from "@/lib/logger";
import { PointType } from "@/lib/types";
import { Coins } from "lucide-react";
import { toast } from "sonner";
import { SettingsCrudTab, ColumnDef, CrudActions } from "./settings-crud-tab";

export function PointTypesTab() {
  const [name, setName] = useState("");
  const [shortName, setShortName] = useState("");
  const [category, setCategory] = useState<"hotel" | "airline" | "transferable">("hotel");
  const [usdCentsPerPoint, setUsdCentsPerPoint] = useState("");
  const [isForeignCurrency, setIsForeignCurrency] = useState(false);
  const [programCurrency, setProgramCurrency] = useState("");
  const [programCentsPerPoint, setProgramCentsPerPoint] = useState("");
  const [showErrors, setShowErrors] = useState(false);

  const [editPt, setEditPt] = useState<PointType | null>(null);
  const [editName, setEditName] = useState("");
  const [editShortName, setEditShortName] = useState("");
  const [editCategory, setEditCategory] = useState<"hotel" | "airline" | "transferable">("hotel");
  const [editUsdCentsPerPoint, setEditUsdCentsPerPoint] = useState("");
  const [editIsForeignCurrency, setEditIsForeignCurrency] = useState(false);
  const [editProgramCurrency, setEditProgramCurrency] = useState("");
  const [editProgramCentsPerPoint, setEditProgramCentsPerPoint] = useState("");
  const [showEditErrors, setShowEditErrors] = useState(false);

  const [ptToDelete, setPtToDelete] = useState<PointType | null>(null);

  const validate = useCallback(
    (n: string, sn: string, cpp: string) => ({
      name: !n.trim() ? "Name is required" : "",
      shortName: !sn.trim() ? "Short name is required" : "",
      usdCentsPerPoint: !cpp ? "Value is required" : "",
    }),
    []
  );

  const currentErrors = validate(name, shortName, usdCentsPerPoint);
  const isAddValid =
    !currentErrors.name && !currentErrors.shortName && !currentErrors.usdCentsPerPoint;

  const editErrors = validate(editName, editShortName, editUsdCentsPerPoint);
  const isEditValid = !editErrors.name && !editErrors.shortName && !editErrors.usdCentsPerPoint;

  const fetchItems = async () => {
    const result = await apiFetch<PointType[]>("/api/point-types");
    if (!result.ok) throw new Error(result.error.message);
    return result.data;
  };

  const handleAddSubmit = async () => {
    setShowErrors(true);
    if (!isAddValid) return false;
    const result = await apiFetch("/api/point-types", {
      method: "POST",
      body: {
        name,
        shortName: shortName.trim() || null,
        category,
        usdCentsPerPoint: Number(usdCentsPerPoint),
        programCurrency: isForeignCurrency ? programCurrency.trim() || null : null,
        programCentsPerPoint:
          isForeignCurrency && programCentsPerPoint ? Number(programCentsPerPoint) : null,
      },
    });
    if (result.ok) {
      setName("");
      setShortName("");
      setCategory("hotel");
      setUsdCentsPerPoint("");
      setIsForeignCurrency(false);
      setProgramCurrency("");
      setProgramCentsPerPoint("");
      setShowErrors(false);
      return true;
    }
    logger.error("Failed to add point type", result.error, { status: result.status });
    toast.error("Failed to add point type. Please try again.");
    return false;
  };

  const handleEditSubmit = async () => {
    if (!editPt) return false;
    setShowEditErrors(true);
    if (!isEditValid) return false;
    const result = await apiFetch(`/api/point-types/${editPt.id}`, {
      method: "PUT",
      body: {
        name: editName,
        shortName: editShortName.trim() || null,
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
      setEditPt(null);
      setShowEditErrors(false);
      return true;
    }
    logger.error("Failed to update point type", result.error, { status: result.status });
    toast.error("Failed to update point type. Please try again.");
    return false;
  };

  const handleDeleteConfirm = async () => {
    if (!ptToDelete) return;
    const result = await apiFetch(`/api/point-types/${ptToDelete.id}`, { method: "DELETE" });
    if (!result.ok) {
      if (result.status === 409) {
        toast.error("Cannot delete: this point type is in use by hotel chains, cards, or portals.");
      } else {
        logger.error("Failed to delete point type", result.error, { status: result.status });
        toast.error("Failed to delete point type. Please try again.");
      }
    }
  };

  const columns: ColumnDef<PointType>[] = [
    { header: "Name", render: (pt) => <span data-testid="point-type-name">{pt.name}</span> },
    {
      header: "USD Value/Point",
      render: (pt) => (
        <>
          ${parseFloat(Number(pt.usdCentsPerPoint).toFixed(3))}
          {pt.programCurrency && pt.programCentsPerPoint != null
            ? ` (${pt.programCurrency} ${parseFloat(Number(pt.programCentsPerPoint).toFixed(3))})`
            : ""}
        </>
      ),
    },
  ];

  const renderMobileCard = (pt: PointType, actions: CrudActions<PointType>) => (
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
          <Button variant="outline" size="sm" className="flex-1" onClick={() => actions.onEdit(pt)}>
            Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-destructive"
            onClick={() => actions.onDelete(pt)}
          >
            Delete
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const categoryOptions = [
    { label: "Hotel", value: "hotel" },
    { label: "Airline", value: "airline" },
    { label: "Transferable", value: "transferable" },
  ];

  const addFields = () => (
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
        <Label htmlFor="pt-short-name">Short Name *</Label>
        <Input
          id="pt-short-name"
          value={shortName}
          onChange={(e) => setShortName(e.target.value)}
          placeholder="e.g. Hilton"
          error={showErrors ? currentErrors.shortName : ""}
        />
      </div>
      <div className="space-y-2">
        <Label>Category</Label>
        <AppSelect
          value={category}
          onValueChange={(v) => setCategory(v as typeof category)}
          options={categoryOptions}
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
  );

  const editFields = () => (
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
        <Label htmlFor="edit-pt-short-name">Short Name *</Label>
        <Input
          id="edit-pt-short-name"
          value={editShortName}
          onChange={(e) => setEditShortName(e.target.value)}
          placeholder="e.g. Hilton"
          error={showEditErrors ? editErrors.shortName : ""}
        />
      </div>
      <div className="space-y-2">
        <Label>Category</Label>
        <AppSelect
          value={editCategory}
          onValueChange={(v) => setEditCategory(v as typeof editCategory)}
          options={categoryOptions}
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
  );

  return (
    <SettingsCrudTab<PointType>
      title="Point Types"
      addButtonLabel="Add Point Type"
      addButtonTestId="add-point-type-button"
      fetchItems={fetchItems}
      columns={columns}
      renderMobileCard={renderMobileCard}
      addDialog={{
        title: "Add Point Type",
        description: "Define a loyalty currency (hotel points, airline miles, card rewards).",
        renderFields: addFields,
        onSubmit: handleAddSubmit,
        isValid: true, // submit handler enforces validation and returns false if invalid
        onClose: () => setShowErrors(false),
      }}
      editDialog={{
        title: "Edit Point Type",
        description: "Update point type details.",
        renderFields: editFields,
        onSubmit: handleEditSubmit,
        isValid: true, // submit handler enforces validation and returns false if invalid
        onOpen: (pt) => {
          setEditPt(pt);
          setEditName(pt.name);
          setEditShortName(pt.shortName ?? "");
          setEditCategory(pt.category);
          setEditUsdCentsPerPoint(String(Number(pt.usdCentsPerPoint)));
          const hasForeign = pt.programCurrency != null;
          setEditIsForeignCurrency(hasForeign);
          setEditProgramCurrency(pt.programCurrency ?? "");
          setEditProgramCentsPerPoint(
            pt.programCentsPerPoint != null ? String(Number(pt.programCentsPerPoint)) : ""
          );
          setShowEditErrors(false);
        },
        onClose: () => setShowEditErrors(false),
      }}
      deleteDialog={{
        getTitle: () => "Delete Point Type?",
        getDescription: (pt) =>
          `Are you sure you want to delete "${pt.name}"? This cannot be undone.`,
        onConfirm: handleDeleteConfirm,
        onOpen: setPtToDelete,
      }}
      emptyState={{
        icon: Coins,
        title: "No point types",
        description: "Define point values for hotel chains, credit cards, and portals.",
      }}
      testIds={{ list: "point-types-desktop", empty: "point-types-empty" }}
    />
  );
}
