// src/components/settings/ota-agencies-tab.tsx
"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { apiFetch } from "@/lib/api-fetch";
import { logger } from "@/lib/logger";
import { OtaAgency } from "@/lib/types";
import { ScrollText } from "lucide-react";
import { toast } from "sonner";
import { SettingsCrudTab, ColumnDef, CrudActions } from "./settings-crud-tab";

export function OtaAgenciesTab() {
  const [name, setName] = useState("");
  const [editAgency, setEditAgency] = useState<OtaAgency | null>(null);
  const [editName, setEditName] = useState("");
  const [agencyToDelete, setAgencyToDelete] = useState<OtaAgency | null>(null);

  const fetchItems = async () => {
    const result = await apiFetch<OtaAgency[]>("/api/ota-agencies");
    if (!result.ok) throw new Error(result.error.message);
    return result.data;
  };

  const handleAddSubmit = async () => {
    const result = await apiFetch("/api/ota-agencies", {
      method: "POST",
      body: { name },
    });
    if (result.ok) {
      setName("");
      return true;
    }
    logger.error("Failed to add OTA agency", result.error, { status: result.status });
    toast.error("Failed to add OTA agency. Please try again.");
    return false;
  };

  const handleEditSubmit = async () => {
    if (!editAgency) return false;
    const result = await apiFetch(`/api/ota-agencies/${editAgency.id}`, {
      method: "PUT",
      body: { name: editName },
    });
    if (result.ok) {
      setEditAgency(null);
      return true;
    }
    logger.error("Failed to update OTA agency", result.error, { status: result.status });
    toast.error("Failed to update OTA agency. Please try again.");
    return false;
  };

  const handleDeleteConfirm = async () => {
    if (!agencyToDelete) return;
    const result = await apiFetch(`/api/ota-agencies/${agencyToDelete.id}`, { method: "DELETE" });
    if (!result.ok) {
      if (result.status === 409) {
        toast.error("Cannot delete: this agency is referenced by existing bookings.");
      } else {
        logger.error("Failed to delete OTA agency", result.error, { status: result.status });
        toast.error("Failed to delete OTA agency. Please try again.");
      }
    }
  };

  const columns: ColumnDef<OtaAgency>[] = [
    {
      header: "Name",
      render: (agency) => <span data-testid="agency-name">{agency.name}</span>,
    },
  ];

  const renderMobileCard = (agency: OtaAgency, actions: CrudActions<OtaAgency>) => (
    <Card key={agency.id} data-testid="agency-card">
      <CardContent className="p-4 space-y-3">
        <h4 className="font-bold" data-testid="agency-name">
          {agency.name}
        </h4>
        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => actions.onEdit(agency)}
          >
            Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-destructive"
            onClick={() => actions.onDelete(agency)}
          >
            Delete
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <SettingsCrudTab<OtaAgency>
      title="OTA Agencies"
      addButtonLabel="Add Agency"
      addButtonTestId="add-agency-button"
      fetchItems={fetchItems}
      columns={columns}
      renderMobileCard={renderMobileCard}
      addDialog={{
        title: "Add OTA Agency",
        description: "Add an online travel agency to track bookings made through it.",
        renderFields: () => (
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
        ),
        onSubmit: handleAddSubmit,
        isValid: name.trim().length > 0,
      }}
      editDialog={{
        title: "Edit OTA Agency",
        description: "Update agency name.",
        renderFields: () => (
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
        ),
        onSubmit: handleEditSubmit,
        isValid: editName.trim().length > 0,
        onOpen: (agency) => {
          setEditAgency(agency);
          setEditName(agency.name);
        },
      }}
      deleteDialog={{
        getTitle: () => "Delete OTA Agency?",
        getDescription: (agency) =>
          `Are you sure you want to delete "${agency.name}"? This cannot be undone.`,
        onConfirm: handleDeleteConfirm,
        onOpen: setAgencyToDelete,
      }}
      emptyState={{
        icon: ScrollText,
        title: "No OTA agencies",
        description: "Add agencies like Expedia or Chase Travel to track where you book.",
      }}
      testIds={{ list: "agencies-desktop", empty: "ota-agencies-empty" }}
    />
  );
}
