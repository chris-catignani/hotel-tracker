// src/components/settings/settings-crud-tab.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ErrorBanner } from "@/components/ui/error-banner";
import { EmptyState } from "@/components/ui/empty-state";
import { LucideIcon } from "lucide-react";
import { ReactNode } from "react";

export interface ColumnDef<T> {
  header: string;
  render: (item: T) => ReactNode;
}

export type CrudActions<T> = {
  onEdit: (item: T) => void;
  onDelete: (item: T) => void;
};

interface SettingsCrudTabProps<T extends { id: string }> {
  title: string;
  addButtonLabel: string;
  addButtonTestId?: string;
  fetchItems: () => Promise<T[]>;
  fetchDependencies?: () => Promise<void>;
  columns: ColumnDef<T>[];
  renderMobileCard: (item: T, actions: CrudActions<T>) => ReactNode;
  addDialog: {
    title: string;
    description?: string;
    renderFields: () => ReactNode;
    onSubmit: () => Promise<boolean>;
    isValid: boolean;
    onClose?: () => void;
  };
  editDialog?: {
    title: string;
    description?: string;
    renderFields: () => ReactNode;
    onSubmit: () => Promise<boolean>;
    isValid: boolean;
    onOpen: (item: T) => void;
    onClose?: () => void;
  };
  deleteDialog?: {
    getTitle: (item: T) => string;
    getDescription: (item: T) => string;
    onConfirm: () => Promise<void>;
    onOpen: (item: T) => void;
  };
  extraDialogs?: ReactNode;
  emptyState: { icon: LucideIcon; title: string; description: string };
  testIds?: { list?: string; empty?: string };
}

export function SettingsCrudTab<T extends { id: string }>({
  title,
  addButtonLabel,
  addButtonTestId,
  fetchItems,
  fetchDependencies,
  columns,
  renderMobileCard,
  addDialog,
  editDialog,
  deleteDialog,
  extraDialogs,
  emptyState,
  testIds,
}: SettingsCrudTabProps<T>) {
  const [items, setItems] = useState<T[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<T | null>(null);

  const refresh = useCallback(async () => {
    try {
      if (fetchDependencies) await fetchDependencies();
      const data = await fetchItems();
      setItems(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load data");
    }
  }, [fetchItems, fetchDependencies]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  const handleAddSubmit = async () => {
    const success = await addDialog.onSubmit();
    if (success) {
      setOpen(false);
      refresh();
    }
  };

  const handleEditSubmit = async () => {
    if (!editDialog) return;
    const success = await editDialog.onSubmit();
    if (success) {
      setEditOpen(false);
      setSelectedItem(null);
      refresh();
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteDialog) return;
    setDeleteOpen(false);
    await deleteDialog.onConfirm();
    setSelectedItem(null);
    refresh();
  };

  const handleEditClick = (item: T) => {
    setSelectedItem(item);
    editDialog?.onOpen(item);
    setEditOpen(true);
  };

  const handleDeleteClick = (item: T) => {
    setSelectedItem(item);
    deleteDialog?.onOpen(item);
    setDeleteOpen(true);
  };

  const actions: CrudActions<T> = {
    onEdit: handleEditClick,
    onDelete: handleDeleteClick,
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 space-y-4">
      <ErrorBanner error={error} onDismiss={() => setError(null)} />
      <div className="flex items-center justify-between shrink-0">
        <h2 className="text-lg font-semibold">{title}</h2>
        {!open && (
          <Button data-testid={addButtonTestId} onClick={() => setOpen(true)}>
            {addButtonLabel}
          </Button>
        )}
      </div>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) addDialog.onClose?.();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{addDialog.title}</DialogTitle>
            {addDialog.description && (
              <DialogDescription>{addDialog.description}</DialogDescription>
            )}
          </DialogHeader>
          {addDialog.renderFields()}
          <DialogFooter>
            <Button onClick={handleAddSubmit} disabled={!addDialog.isValid}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {editDialog && (
        <Dialog
          open={editOpen}
          onOpenChange={(o) => {
            setEditOpen(o);
            if (!o) editDialog.onClose?.();
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editDialog.title}</DialogTitle>
              {editDialog.description && (
                <DialogDescription>{editDialog.description}</DialogDescription>
              )}
            </DialogHeader>
            {editDialog.renderFields()}
            <DialogFooter>
              <Button onClick={handleEditSubmit} disabled={!editDialog.isValid}>
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {deleteDialog && selectedItem && (
        <ConfirmDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          title={deleteDialog.getTitle(selectedItem)}
          description={deleteDialog.getDescription(selectedItem)}
          onConfirm={handleDeleteConfirm}
        />
      )}

      {extraDialogs}

      {items.length === 0 ? (
        <EmptyState
          icon={emptyState.icon}
          title={emptyState.title}
          description={emptyState.description}
          data-testid={testIds?.empty}
        />
      ) : (
        <>
          {/* Mobile View */}
          <div className="grid grid-cols-1 gap-4 md:hidden">
            {items.map((item) => renderMobileCard(item, actions))}
          </div>

          {/* Desktop View */}
          <div
            className="hidden md:flex md:flex-col md:flex-1 md:min-h-0 md:overflow-auto"
            data-testid={testIds?.list}
          >
            <Table containerClassName="overflow-visible">
              <TableHeader className="sticky top-0 bg-background z-20">
                <TableRow>
                  {columns.map((col) => (
                    <TableHead key={col.header}>{col.header}</TableHead>
                  ))}
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    {columns.map((col) => (
                      <TableCell key={col.header}>{col.render(item)}</TableCell>
                    ))}
                    <TableCell>
                      <div className="flex gap-2">
                        {editDialog && (
                          <Button variant="ghost" size="sm" onClick={() => handleEditClick(item)}>
                            Edit
                          </Button>
                        )}
                        {deleteDialog && (
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteClick(item)}>
                            Delete
                          </Button>
                        )}
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
