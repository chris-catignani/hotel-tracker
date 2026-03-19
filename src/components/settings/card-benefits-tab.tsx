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
import { extractApiError } from "@/lib/client-error";
import {
  CardBenefit,
  CreditCard,
  HotelChain,
  BenefitPeriod,
  CardBenefitFormData,
} from "@/lib/types";
import { ErrorBanner } from "@/components/ui/error-banner";
import { EmptyState } from "@/components/ui/empty-state";
import { Gift } from "lucide-react";

const PERIOD_OPTIONS = [
  { label: "Monthly", value: "monthly" },
  { label: "Quarterly", value: "quarterly" },
  { label: "Semi-Annual", value: "semi_annual" },
  { label: "Annual", value: "annual" },
];

const PERIOD_LABELS: Record<BenefitPeriod, string> = {
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

function BenefitFormFields({
  value,
  onChange,
  prefix,
  cardProductOptions,
  hotelChainOptions,
}: {
  value: CardBenefitFormData & { creditCardId?: string };
  onChange: (updates: Partial<CardBenefitFormData & { creditCardId?: string }>) => void;
  prefix: string;
  cardProductOptions: { label: string; value: string }[];
  hotelChainOptions: { label: string; value: string }[];
}) {
  return (
    <div className="space-y-4 py-2">
      <div className="space-y-2">
        <Label htmlFor={`${prefix}-card`}>Credit Card *</Label>
        <AppSelect
          value={value.creditCardId ?? ""}
          onValueChange={(v) => onChange({ creditCardId: v })}
          options={cardProductOptions}
          placeholder="Select a card..."
          data-testid={`${prefix}-card-select`}
        />
      </div>
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

function formatValue(value: string | number): string {
  const n = Number(value);
  return `$${n.toFixed(2)}`;
}

export function CardBenefitsTab() {
  const [benefits, setBenefits] = useState<CardBenefit[]>([]);
  const [creditCards, setCreditCards] = useState<CreditCard[]>([]);
  const [hotelChains, setHotelChains] = useState<HotelChain[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<CardBenefitFormData & { creditCardId: string }>({
    ...EMPTY_FORM,
    creditCardId: "",
  });
  const [error, setError] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editBenefit, setEditBenefit] = useState<CardBenefit | null>(null);
  const [editForm, setEditForm] = useState<CardBenefitFormData & { creditCardId: string }>({
    ...EMPTY_FORM,
    creditCardId: "",
  });

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [benefitToDelete, setBenefitToDelete] = useState<CardBenefit | null>(null);

  const fetchBenefits = useCallback(async () => {
    const res = await fetch("/api/card-benefits");
    if (res.ok) setBenefits(await res.json());
    else setError(await extractApiError(res, "Failed to load card benefits."));
  }, []);

  const fetchCreditCards = useCallback(async () => {
    const res = await fetch("/api/credit-cards");
    if (res.ok) setCreditCards(await res.json());
  }, []);

  const fetchHotelChains = useCallback(async () => {
    const res = await fetch("/api/hotel-chains");
    if (res.ok) setHotelChains(await res.json());
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchBenefits();
    fetchCreditCards();
    fetchHotelChains();
  }, [fetchBenefits, fetchCreditCards, fetchHotelChains]);

  const handleSubmit = async () => {
    setError(null);
    const res = await fetch("/api/card-benefits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        creditCardId: form.creditCardId,
        description: form.description,
        value: Number(form.value),
        period: form.period,
        hotelChainId: form.hotelChainId || null,
        isActive: form.isActive,
      }),
    });
    if (res.ok) {
      setForm({ ...EMPTY_FORM, creditCardId: "" });
      setOpen(false);
      fetchBenefits();
    } else {
      setError(await extractApiError(res, "Failed to add card benefit."));
    }
  };

  const handleEdit = (benefit: CardBenefit) => {
    setEditBenefit(benefit);
    setEditForm({
      creditCardId: benefit.creditCardId,
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
        creditCardId: editForm.creditCardId,
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
      fetchBenefits();
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
      fetchBenefits();
    } else {
      setError(await extractApiError(res, "Failed to delete card benefit."));
    }
  };

  const cardProductOptions = creditCards.map((c) => ({ label: c.name, value: c.id }));
  const hotelChainOptions = hotelChains.map((h) => ({ label: h.name, value: h.id }));

  const cardNameById = Object.fromEntries(creditCards.map((c) => [c.id, c.name]));

  const isFormValid = (f: CardBenefitFormData & { creditCardId: string }) =>
    f.creditCardId && f.description.trim() && f.value !== "" && Number(f.value) > 0 && f.period;

  return (
    <div className="flex flex-col flex-1 min-h-0 space-y-4">
      <ErrorBanner error={error} onDismiss={() => setError(null)} />
      <div className="flex items-center justify-between shrink-0">
        <h2 className="text-lg font-semibold">Card Benefits</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="add-card-benefit-button">Add Benefit</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Card Benefit</DialogTitle>
              <DialogDescription>
                Define a recurring credit for a credit card product (e.g. $50/quarter Hilton
                credit).
              </DialogDescription>
            </DialogHeader>
            <BenefitFormFields
              value={form}
              onChange={(updates) => setForm((prev) => ({ ...prev, ...updates }))}
              prefix="add"
              cardProductOptions={cardProductOptions}
              hotelChainOptions={hotelChainOptions}
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

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Card Benefit</DialogTitle>
            <DialogDescription>Update card benefit details.</DialogDescription>
          </DialogHeader>
          <BenefitFormFields
            value={editForm}
            onChange={(updates) => setEditForm((prev) => ({ ...prev, ...updates }))}
            prefix="edit"
            cardProductOptions={cardProductOptions}
            hotelChainOptions={hotelChainOptions}
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

      {benefits.length === 0 ? (
        <EmptyState
          icon={Gift}
          title="No card benefits"
          description="Add recurring credits for your credit cards (e.g. $50/quarter Hilton credit)."
          action={{
            label: "Add Benefit",
            onClick: () => setOpen(true),
          }}
          data-testid="card-benefits-empty"
        />
      ) : (
        <>
          {/* Mobile View */}
          <div className="grid grid-cols-1 gap-4 md:hidden" data-testid="card-benefits-mobile">
            {benefits.map((benefit) => (
              <Card key={benefit.id} data-testid="card-benefit-card">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold" data-testid="card-benefit-description">
                      {benefit.description}
                    </h4>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${benefit.isActive ? "bg-green-100 text-green-800" : "bg-muted text-muted-foreground"}`}
                    >
                      {benefit.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {cardNameById[benefit.creditCardId] ?? benefit.creditCardId}
                  </p>
                  <p className="text-sm">
                    {formatValue(benefit.value)} / {PERIOD_LABELS[benefit.period]}
                    {benefit.hotelChain && ` · ${benefit.hotelChain.name} only`}
                  </p>
                  <div className="flex gap-2 pt-2">
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
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Desktop View */}
          <div
            className="hidden md:flex md:flex-col md:flex-1 md:min-h-0 md:overflow-auto"
            data-testid="card-benefits-desktop"
          >
            <Table containerClassName="overflow-visible">
              <TableHeader className="sticky top-0 bg-background z-20">
                <TableRow>
                  <TableHead>Credit Card</TableHead>
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
                    <TableCell>
                      {cardNameById[benefit.creditCardId] ?? benefit.creditCardId}
                    </TableCell>
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
    </div>
  );
}
