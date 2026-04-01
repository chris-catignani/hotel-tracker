"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AppSelect } from "@/components/ui/app-select";
import { apiFetch } from "@/lib/api-fetch";
import { logger } from "@/lib/logger";
import { PointType, ShoppingPortal } from "@/lib/types";
import { Globe } from "lucide-react";
import { toast } from "sonner";
import { SettingsCrudTab, ColumnDef, CrudActions } from "./settings-crud-tab";

export function ShoppingPortalsTab() {
  const [pointTypes, setPointTypes] = useState<PointType[]>([]);
  const [name, setName] = useState("");
  const [rewardType, setRewardType] = useState("cashback");
  const [pointTypeId, setPointTypeId] = useState("none");
  const [editPortal, setEditPortal] = useState<ShoppingPortal | null>(null);
  const [editName, setEditName] = useState("");
  const [editRewardType, setEditRewardType] = useState("cashback");
  const [editPointTypeId, setEditPointTypeId] = useState("none");

  const fetchDependencies = async () => {
    const ptResult = await apiFetch<PointType[]>("/api/point-types");
    if (ptResult.ok) setPointTypes(ptResult.data);
  };

  const fetchItems = async () => {
    const result = await apiFetch<ShoppingPortal[]>("/api/portals");
    if (!result.ok) throw new Error(result.error.message);
    return result.data;
  };

  const handleAddSubmit = async () => {
    const result = await apiFetch("/api/portals", {
      method: "POST",
      body: {
        name,
        rewardType,
        pointTypeId: rewardType === "points" && pointTypeId !== "none" ? pointTypeId : null,
      },
    });
    if (result.ok) {
      setName("");
      setRewardType("cashback");
      setPointTypeId("none");
      return true;
    }
    logger.error("Failed to add shopping portal", result.error, { status: result.status });
    toast.error("Failed to add shopping portal. Please try again.");
    return false;
  };

  const handleEditSubmit = async () => {
    if (!editPortal) return false;
    const result = await apiFetch(`/api/portals/${editPortal.id}`, {
      method: "PUT",
      body: {
        name: editName,
        rewardType: editRewardType,
        pointTypeId:
          editRewardType === "points" && editPointTypeId !== "none" ? editPointTypeId : null,
      },
    });
    if (result.ok) {
      setEditPortal(null);
      return true;
    }
    logger.error("Failed to update shopping portal", result.error, { status: result.status });
    toast.error("Failed to update shopping portal. Please try again.");
    return false;
  };

  const columns: ColumnDef<ShoppingPortal>[] = [
    { header: "Name", render: (p) => <span data-testid="portal-name">{p.name}</span> },
    { header: "Reward Type", render: (p) => <span className="capitalize">{p.rewardType}</span> },
    { header: "Point Type", render: (p) => p.pointType?.name ?? "—" },
  ];

  const renderMobileCard = (portal: ShoppingPortal, actions: CrudActions<ShoppingPortal>) => (
    <Card key={portal.id} data-testid="portal-card">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <h4 className="font-bold" data-testid="portal-name">
              {portal.name}
            </h4>
            <p className="text-sm text-muted-foreground capitalize">{portal.rewardType}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Point Type</p>
            <p className="font-medium">{portal.pointType?.name ?? "—"}</p>
          </div>
        </div>
        <div className="pt-2">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => actions.onEdit(portal)}
          >
            Edit
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const rewardTypeOptions = [
    { label: "Cashback", value: "cashback" },
    { label: "Points", value: "points" },
  ];
  const pointTypeOptions = [
    { label: "None", value: "none" },
    ...pointTypes.map((pt) => ({ label: pt.name, value: pt.id })),
  ];

  return (
    <SettingsCrudTab<ShoppingPortal>
      title="Shopping Portals"
      addButtonLabel="Add Portal"
      addButtonTestId="add-portal-button"
      fetchItems={fetchItems}
      fetchDependencies={fetchDependencies}
      columns={columns}
      renderMobileCard={renderMobileCard}
      addDialog={{
        title: "Add Shopping Portal",
        description: "Add a shopping portal for cashback or points tracking.",
        renderFields: () => (
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
              <Label>Reward Type</Label>
              <AppSelect
                value={rewardType}
                onValueChange={setRewardType}
                options={rewardTypeOptions}
                placeholder="Select reward type"
                data-testid="portal-reward-type-select"
              />
            </div>
            {rewardType === "points" && (
              <div className="space-y-2">
                <Label>Point Type</Label>
                <AppSelect
                  value={pointTypeId}
                  onValueChange={setPointTypeId}
                  options={pointTypeOptions}
                  placeholder="Select point type..."
                  data-testid="portal-point-type-select"
                />
              </div>
            )}
          </div>
        ),
        onSubmit: handleAddSubmit,
        isValid: name.trim().length > 0,
      }}
      editDialog={{
        title: "Edit Shopping Portal",
        description: "Update shopping portal details.",
        renderFields: () => (
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
              <Label>Reward Type</Label>
              <AppSelect
                value={editRewardType}
                onValueChange={setEditRewardType}
                options={rewardTypeOptions}
                placeholder="Select reward type"
                data-testid="edit-portal-reward-type-select"
              />
            </div>
            {editRewardType === "points" && (
              <div className="space-y-2">
                <Label>Point Type</Label>
                <AppSelect
                  value={editPointTypeId}
                  onValueChange={setEditPointTypeId}
                  options={pointTypeOptions}
                  placeholder="Select point type..."
                  data-testid="edit-portal-point-type-select"
                />
              </div>
            )}
          </div>
        ),
        onSubmit: handleEditSubmit,
        isValid: editName.trim().length > 0,
        onOpen: (portal) => {
          setEditPortal(portal);
          setEditName(portal.name);
          setEditRewardType(portal.rewardType);
          setEditPointTypeId(portal.pointTypeId != null ? portal.pointTypeId : "none");
        },
      }}
      emptyState={{
        icon: Globe,
        title: "No shopping portals",
        description:
          "Add portals like Rakuten or TopCashback to track extra rewards on your bookings.",
      }}
      testIds={{ list: "portals-desktop", empty: "portals-empty", row: "portal-row" }}
    />
  );
}
