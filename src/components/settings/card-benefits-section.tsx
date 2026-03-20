"use client";

import { useState } from "react";
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
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { AppSelect } from "@/components/ui/app-select";
import { ErrorBanner } from "@/components/ui/error-banner";
import { extractApiError } from "@/lib/client-error";
import { CardBenefit, CardBenefitFormData, HotelChain, BenefitPeriod } from "@/lib/types";
import { Plus } from "lucide-react";

const PERIOD_OPTIONS = [
  { label: "Monthly", value: "monthly" },
  { label: "Quarterly", value: "quarterly" },
  { label: "Semi-Annual", value: "semi_annual" },
  { label: "Annual", value: "annual" },
];

export const PERIOD_LABELS: Record<BenefitPeriod, string> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  semi_annual: "Semi-Annual",
  annual: "Annual",
};

const EMPTY_FORM: CardBenefitFormData = {
  description: "",
  value: "",
  period: "quarterly",
  hotelChainId: null,
  isActive: true,
};

function formatValue(value: string | number): string {
  return `$${Number(value).toFixed(2)}`;
}

function BenefitForm({
  value,
  onChange,
  hotelChainOptions,
  prefix,
}: {
  value: CardBenefitFormData;
  onChange: (updates: Partial<CardBenefitFormData>) => void;
  hotelChainOptions: { label: string; value: string }[];
  prefix: string;
}) {
  return (
    <div className="space-y-4 py-2">
      <div className="space-y-2">
        <Label htmlFor={`${prefix}-description`}>Description *</Label>
        <Input
          id={`${prefix}-description`}
          value={value.description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder='e.g. "Hilton quarterly credit"'
          data-testid={`${prefix}-description-input`}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor={`${prefix}-value`}>Credit Amount ($) *</Label>
          <Input
            id={`${prefix}-value`}
            type="number"
            min="0"
            step="0.01"
            value={value.value}
            onChange={(e) => onChange({ value: e.target.value })}
            placeholder="50"
            data-testid={`${prefix}-value-input`}
          />
        </div>
        <div className="space-y-2">
          <Label>Period *</Label>
          <AppSelect
            value={value.period}
            onValueChange={(v) => onChange({ period: v as BenefitPeriod })}
            options={PERIOD_OPTIONS}
            placeholder="Select period..."
            data-testid={`${prefix}-period-select`}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Hotel Chain (optional)</Label>
        <AppSelect
          value={value.hotelChainId ?? ""}
          onValueChange={(v) => onChange({ hotelChainId: v || null })}
          options={[{ label: "Any hotel", value: "" }, ...hotelChainOptions]}
          placeholder="Any hotel"
          data-testid={`${prefix}-chain-select`}
        />
      </div>
      <div className="flex items-center gap-2">
        <Switch
          id={`${prefix}-active`}
          checked={value.isActive}
          onCheckedChange={(checked) => onChange({ isActive: checked })}
          data-testid={`${prefix}-active-switch`}
        />
        <Label htmlFor={`${prefix}-active`}>Active</Label>
      </div>
    </div>
  );
}

export function CardBenefitsSection({
  creditCardId,
  benefits,
  hotelChains,
  onRefetch,
}: {
  creditCardId: string;
  benefits: CardBenefit[];
  hotelChains: HotelChain[];
  onRefetch: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<CardBenefitFormData>(EMPTY_FORM);

  const [editOpen, setEditOpen] = useState(false);
  const [editBenefit, setEditBenefit] = useState<CardBenefit | null>(null);
  const [editForm, setEditForm] = useState<CardBenefitFormData>(EMPTY_FORM);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [benefitToDelete, setBenefitToDelete] = useState<CardBenefit | null>(null);

  const [error, setError] = useState<string | null>(null);

  const hotelChainOptions = hotelChains.map((h) => ({ label: h.name, value: h.id }));

  const isFormValid = (f: CardBenefitFormData) =>
    f.description.trim() && f.value !== "" && Number(f.value) > 0 && f.period;

  const handleSubmit = async () => {
    setError(null);
    const res = await fetch("/api/card-benefits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        creditCardId,
        description: form.description,
        value: Number(form.value),
        period: form.period,
        hotelChainId: form.hotelChainId || null,
        isActive: form.isActive,
      }),
    });
    if (res.ok) {
      setForm(EMPTY_FORM);
      setOpen(false);
      onRefetch();
    } else {
      setError(await extractApiError(res, "Failed to add card benefit."));
    }
  };

  const handleEdit = (benefit: CardBenefit) => {
    setEditBenefit(benefit);
    setEditForm({
      description: benefit.description,
      value: String(Number(benefit.value)),
      period: benefit.period,
      hotelChainId: benefit.hotelChainId,
      isActive: benefit.isActive,
    });
    setEditOpen(true);
  };

  const handleEditSubmit = async () => {
    if (!editBenefit) return;
    setError(null);
    const res = await fetch(`/api/card-benefits/${editBenefit.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        creditCardId,
        description: editForm.description,
        value: Number(editForm.value),
        period: editForm.period,
        hotelChainId: editForm.hotelChainId || null,
        isActive: editForm.isActive,
      }),
    });
    if (res.ok) {
      setEditOpen(false);
      setEditBenefit(null);
      onRefetch();
    } else {
      setError(await extractApiError(res, "Failed to update card benefit."));
    }
  };

  const handleDeleteClick = (benefit: CardBenefit) => {
    setBenefitToDelete(benefit);
    setDeleteOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!benefitToDelete) return;
    setDeleteOpen(false);
    setError(null);
    const res = await fetch(`/api/card-benefits/${benefitToDelete.id}`, { method: "DELETE" });
    if (res.ok) {
      setBenefitToDelete(null);
      onRefetch();
    } else {
      setError(await extractApiError(res, "Failed to delete card benefit."));
    }
  };

  return (
    <div className="p-4 space-y-3 bg-muted/20 border-t">
      <ErrorBanner error={error} onDismiss={() => setError(null)} />

      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Benefits
        </span>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" data-testid="add-card-benefit-button">
              <Plus className="mr-1 size-3" />
              Add Benefit
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Card Benefit</DialogTitle>
              <DialogDescription>
                Define a recurring credit for this card (e.g. $50/quarter Hilton credit).
              </DialogDescription>
            </DialogHeader>
            <BenefitForm
              value={form}
              onChange={(updates) => setForm((prev) => ({ ...prev, ...updates }))}
              hotelChainOptions={hotelChainOptions}
              prefix="add"
            />
            <DialogFooter>
              <Button
                onClick={handleSubmit}
                disabled={!isFormValid(form)}
                data-testid="add-card-benefit-save"
              >
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {benefits.length === 0 ? (
        <p className="text-xs text-muted-foreground italic text-center py-1">
          No benefits defined.
        </p>
      ) : (
        <>
          {/* Mobile */}
          <div className="space-y-2 md:hidden">
            {benefits.map((benefit) => (
              <div
                key={benefit.id}
                className="rounded-lg border p-3 bg-background space-y-1"
                data-testid="card-benefit-card"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm" data-testid="card-benefit-description">
                    {benefit.description}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${benefit.isActive ? "bg-green-100 text-green-800" : "bg-muted text-muted-foreground"}`}
                  >
                    {benefit.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatValue(benefit.value)} / {PERIOD_LABELS[benefit.period]}
                  {benefit.hotelChain && ` · ${benefit.hotelChain.name} only`}
                </p>
                <div className="flex gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleEdit(benefit)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-destructive"
                    onClick={() => handleDeleteClick(benefit)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Hotel Chain</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {benefits.map((benefit) => (
                  <TableRow key={benefit.id} data-testid="card-benefit-row">
                    <TableCell data-testid="card-benefit-description">
                      {benefit.description}
                    </TableCell>
                    <TableCell>{formatValue(benefit.value)}</TableCell>
                    <TableCell>{PERIOD_LABELS[benefit.period]}</TableCell>
                    <TableCell>{benefit.hotelChain?.name ?? "Any"}</TableCell>
                    <TableCell>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${benefit.isActive ? "bg-green-100 text-green-800" : "bg-muted text-muted-foreground"}`}
                      >
                        {benefit.isActive ? "Active" : "Inactive"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(benefit)}>
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteClick(benefit)}
                        >
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

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Card Benefit</DialogTitle>
            <DialogDescription>Update card benefit details.</DialogDescription>
          </DialogHeader>
          <BenefitForm
            value={editForm}
            onChange={(updates) => setEditForm((prev) => ({ ...prev, ...updates }))}
            hotelChainOptions={hotelChainOptions}
            prefix="edit"
          />
          <DialogFooter>
            <Button
              onClick={handleEditSubmit}
              disabled={!isFormValid(editForm)}
              data-testid="edit-card-benefit-save"
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Card Benefit?"
        description={
          benefitToDelete
            ? `Are you sure you want to delete "${benefitToDelete.description}"? This cannot be undone.`
            : ""
        }
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
