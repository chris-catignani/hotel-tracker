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
import { extractApiError } from "@/lib/client-error";
import { OtaAgency } from "@/lib/types";
import { ErrorBanner } from "@/components/ui/error-banner";

export function OtaAgenciesTab() {
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

      {/* Mobile View: Cards */}
      <div className="grid grid-cols-1 gap-4 md:hidden" data-testid="agencies-mobile">
        {agencies.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No OTA agencies added yet.</p>
        ) : (
          agencies.map((agency) => (
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
                    onClick={() => handleDelete(agency)}
                  >
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Desktop View: Table */}
      <div className="hidden md:block" data-testid="agencies-desktop">
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
                <TableRow key={agency.id} data-testid="agency-row">
                  <TableCell data-testid="agency-name">{agency.name}</TableCell>
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
    </div>
  );
}
