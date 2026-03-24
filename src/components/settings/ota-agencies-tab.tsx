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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { apiFetch } from "@/lib/api-fetch";
import { logger } from "@/lib/logger";
import { OtaAgency } from "@/lib/types";
import { ErrorBanner } from "@/components/ui/error-banner";
import { EmptyState } from "@/components/ui/empty-state";
import { ScrollText } from "lucide-react";
import { toast } from "sonner";

export function OtaAgenciesTab() {
  const [agencies, setAgencies] = useState<OtaAgency[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editAgency, setEditAgency] = useState<OtaAgency | null>(null);
  const [editName, setEditName] = useState("");

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [agencyToDelete, setAgencyToDelete] = useState<OtaAgency | null>(null);

  const fetchAgencies = useCallback(async () => {
    const result = await apiFetch<OtaAgency[]>("/api/ota-agencies");
    if (result.ok) setAgencies(result.data);
    else setError(result.error.message);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAgencies();
  }, [fetchAgencies]);

  const handleSubmit = async () => {
    const result = await apiFetch("/api/ota-agencies", {
      method: "POST",
      body: { name },
    });
    if (result.ok) {
      setName("");
      setOpen(false);
      fetchAgencies();
    } else {
      logger.error("Failed to add OTA agency", result.error, { status: result.status });
      toast.error("Failed to add OTA agency. Please try again.");
    }
  };

  const handleEdit = (agency: OtaAgency) => {
    setEditAgency(agency);
    setEditName(agency.name);
    setEditOpen(true);
  };

  const handleEditSubmit = async () => {
    if (!editAgency) return;
    const result = await apiFetch(`/api/ota-agencies/${editAgency.id}`, {
      method: "PUT",
      body: { name: editName },
    });
    if (result.ok) {
      setEditOpen(false);
      setEditAgency(null);
      fetchAgencies();
    } else {
      logger.error("Failed to update OTA agency", result.error, { status: result.status });
      toast.error("Failed to update OTA agency. Please try again.");
    }
  };

  const handleDeleteClick = (agency: OtaAgency) => {
    setAgencyToDelete(agency);
    setDeleteOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!agencyToDelete) return;
    setDeleteOpen(false);
    const result = await apiFetch(`/api/ota-agencies/${agencyToDelete.id}`, { method: "DELETE" });
    if (result.ok) {
      setAgencyToDelete(null);
      fetchAgencies();
    } else if (result.status === 409) {
      toast.error("Cannot delete: this agency is referenced by existing bookings.");
    } else {
      logger.error("Failed to delete OTA agency", result.error, { status: result.status });
      toast.error("Failed to delete OTA agency. Please try again.");
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 space-y-4">
      <ErrorBanner error={error} onDismiss={() => setError(null)} />
      <div className="flex items-center justify-between shrink-0">
        <h2 className="text-lg font-semibold">OTA Agencies</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="add-agency-button">Add Agency</Button>
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

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete OTA Agency?"
        description={
          agencyToDelete
            ? `Are you sure you want to delete "${agencyToDelete.name}"? This cannot be undone.`
            : ""
        }
        onConfirm={handleDeleteConfirm}
      />

      {agencies.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="No OTA agencies"
          description="Add agencies like Expedia or Chase Travel to track where you book."
          action={{
            label: "Add Agency",
            onClick: () => setOpen(true),
          }}
          data-testid="ota-agencies-empty"
        />
      ) : (
        <>
          {/* Mobile View: Cards */}
          <div className="grid grid-cols-1 gap-4 md:hidden" data-testid="agencies-mobile">
            {agencies.map((agency) => (
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
                      onClick={() => handleEdit(agency)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-destructive"
                      onClick={() => handleDeleteClick(agency)}
                    >
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Desktop View: Table */}
          <div
            className="hidden md:flex md:flex-col md:flex-1 md:min-h-0 md:overflow-auto"
            data-testid="agencies-desktop"
          >
            <Table containerClassName="overflow-visible">
              <TableHeader className="sticky top-0 bg-background z-20">
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agencies.map((agency) => (
                  <TableRow key={agency.id} data-testid="agency-row">
                    <TableCell data-testid="agency-name">{agency.name}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(agency)}>
                          Edit
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteClick(agency)}>
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
