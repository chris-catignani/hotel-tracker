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
import { Checkbox } from "@/components/ui/checkbox";
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
import { apiFetch } from "@/lib/api-fetch";
import { logger } from "@/lib/logger";
import { toast } from "sonner";
import {
  CardBenefit,
  CardBenefitFormData,
  HotelChain,
  OtaAgency,
  BenefitPeriod,
} from "@/lib/types";
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
  maxValuePerBooking: null,
  period: "quarterly",
  hotelChainId: null,
  otaAgencyIds: [],
  isActive: true,
  startDate: null,
  endDate: null,
};

function formatValue(value: string | number): string {
  return `$${Number(value).toFixed(2)}`;
}

function BenefitForm({
  value,
  onChange,
  hotelChainOptions,
  otaAgencies,
  prefix,
}: {
  value: CardBenefitFormData;
  onChange: (updates: Partial<CardBenefitFormData>) => void;
  hotelChainOptions: { label: string; value: string }[];
  otaAgencies: OtaAgency[];
  prefix: string;
}) {
  const toggleOta = (otaId: string) => {
    const current = value.otaAgencyIds;
    const next = current.includes(otaId)
      ? current.filter((id) => id !== otaId)
      : [...current, otaId];
    onChange({ otaAgencyIds: next });
  };

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
          <Label htmlFor={`${prefix}-value`}>Total Amount ($) *</Label>
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
        <Label htmlFor={`${prefix}-max-per-booking`}>
          Max per Booking ($) <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <Input
          id={`${prefix}-max-per-booking`}
          type="number"
          min="0"
          step="0.01"
          value={value.maxValuePerBooking ?? ""}
          onChange={(e) => onChange({ maxValuePerBooking: e.target.value || null })}
          placeholder="e.g. 250"
          data-testid={`${prefix}-max-per-booking-input`}
        />
      </div>

      <div className="space-y-2">
        <Label>
          Hotel Chain <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <AppSelect
          value={value.hotelChainId ?? ""}
          onValueChange={(v) => onChange({ hotelChainId: v || null })}
          options={[{ label: "Any hotel", value: "" }, ...hotelChainOptions]}
          placeholder="Any hotel"
          data-testid={`${prefix}-chain-select`}
        />
      </div>

      {otaAgencies.length > 0 && (
        <div className="space-y-2">
          <Label>
            OTA Restriction{" "}
            <span className="text-muted-foreground font-normal">
              (optional — leave unchecked for any)
            </span>
          </Label>
          <div className="max-h-32 overflow-y-auto space-y-1 rounded-md border p-2">
            {otaAgencies.map((ota) => (
              <div key={ota.id} className="flex items-center gap-2">
                <Checkbox
                  id={`${prefix}-ota-${ota.id}`}
                  checked={value.otaAgencyIds.includes(ota.id)}
                  onCheckedChange={() => toggleOta(ota.id)}
                  data-testid={`${prefix}-ota-checkbox-${ota.id}`}
                />
                <label htmlFor={`${prefix}-ota-${ota.id}`} className="text-sm cursor-pointer">
                  {ota.name}
                </label>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor={`${prefix}-start-date`}>
            Start Date <span className="text-muted-foreground font-normal">(optional)</span>
          </Label>
          <Input
            id={`${prefix}-start-date`}
            type="date"
            value={value.startDate ?? ""}
            onChange={(e) => onChange({ startDate: e.target.value || null })}
            data-testid={`${prefix}-start-date-input`}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${prefix}-end-date`}>
            End Date <span className="text-muted-foreground font-normal">(optional)</span>
          </Label>
          <Input
            id={`${prefix}-end-date`}
            type="date"
            value={value.endDate ?? ""}
            onChange={(e) => onChange({ endDate: e.target.value || null })}
            data-testid={`${prefix}-end-date-input`}
          />
        </div>
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

function benefitSubtitle(benefit: CardBenefit): string {
  const parts: string[] = [];
  if (benefit.hotelChain) parts.push(benefit.hotelChain.name);
  if (benefit.otaAgencies.length > 0)
    parts.push(benefit.otaAgencies.map((o) => o.otaAgency.name).join(", "));
  return parts.length > 0 ? parts.join(" · ") : "Any booking";
}

export function CardBenefitsSection({
  creditCardId,
  benefits,
  hotelChains,
  otaAgencies,
  onRefetch,
}: {
  creditCardId: string;
  benefits: CardBenefit[];
  hotelChains: HotelChain[];
  otaAgencies: OtaAgency[];
  onRefetch: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<CardBenefitFormData>(EMPTY_FORM);

  const [editOpen, setEditOpen] = useState(false);
  const [editBenefit, setEditBenefit] = useState<CardBenefit | null>(null);
  const [editForm, setEditForm] = useState<CardBenefitFormData>(EMPTY_FORM);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [benefitToDelete, setBenefitToDelete] = useState<CardBenefit | null>(null);

  const hotelChainOptions = hotelChains.map((h) => ({ label: h.name, value: h.id }));

  const isFormValid = (f: CardBenefitFormData) =>
    f.description.trim() && f.value !== "" && Number(f.value) > 0 && f.period;

  const buildBody = (f: CardBenefitFormData) => ({
    description: f.description,
    value: Number(f.value),
    maxValuePerBooking:
      f.maxValuePerBooking != null && f.maxValuePerBooking !== ""
        ? Number(f.maxValuePerBooking)
        : null,
    period: f.period,
    hotelChainId: f.hotelChainId || null,
    otaAgencyIds: f.otaAgencyIds,
    isActive: f.isActive,
    startDate: f.startDate || null,
    endDate: f.endDate || null,
  });

  const handleSubmit = async () => {
    const result = await apiFetch("/api/card-benefits", {
      method: "POST",
      body: { creditCardId, ...buildBody(form) },
    });
    if (result.ok) {
      setForm(EMPTY_FORM);
      setOpen(false);
      onRefetch();
    } else {
      logger.error("Failed to add card benefit", result.error, { status: result.status });
      toast.error("Failed to add card benefit. Please try again.");
    }
  };

  const handleEdit = (benefit: CardBenefit) => {
    setEditBenefit(benefit);
    setEditForm({
      description: benefit.description,
      value: String(Number(benefit.value)),
      maxValuePerBooking:
        benefit.maxValuePerBooking != null ? String(Number(benefit.maxValuePerBooking)) : null,
      period: benefit.period,
      hotelChainId: benefit.hotelChainId,
      otaAgencyIds: benefit.otaAgencies.map((o) => o.otaAgencyId),
      isActive: benefit.isActive,
      startDate: benefit.startDate ? benefit.startDate.slice(0, 10) : null,
      endDate: benefit.endDate ? benefit.endDate.slice(0, 10) : null,
    });
    setEditOpen(true);
  };

  const handleEditSubmit = async () => {
    if (!editBenefit) return;
    const result = await apiFetch(`/api/card-benefits/${editBenefit.id}`, {
      method: "PUT",
      body: { creditCardId, ...buildBody(editForm) },
    });
    if (result.ok) {
      setEditOpen(false);
      setEditBenefit(null);
      onRefetch();
    } else {
      logger.error("Failed to update card benefit", result.error, { status: result.status });
      toast.error("Failed to update card benefit. Please try again.");
    }
  };

  const handleDeleteClick = (benefit: CardBenefit) => {
    setBenefitToDelete(benefit);
    setDeleteOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!benefitToDelete) return;
    setDeleteOpen(false);
    const result = await apiFetch(`/api/card-benefits/${benefitToDelete.id}`, {
      method: "DELETE",
    });
    if (result.ok) {
      setBenefitToDelete(null);
      onRefetch();
    } else {
      logger.error("Failed to delete card benefit", result.error, { status: result.status });
      toast.error("Failed to delete card benefit. Please try again.");
    }
  };

  return (
    <div className="p-4 space-y-3 bg-muted/20 border-t">
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
          <DialogContent className="max-h-[90vh] overflow-y-auto">
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
              otaAgencies={otaAgencies}
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
                  {formatValue(benefit.value)}
                  {benefit.maxValuePerBooking != null &&
                    ` (${formatValue(benefit.maxValuePerBooking)}/booking)`}
                  {" / "}
                  {PERIOD_LABELS[benefit.period]}
                </p>
                <p className="text-xs text-muted-foreground">{benefitSubtitle(benefit)}</p>
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
                  <TableHead>Applies To</TableHead>
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
                    <TableCell>
                      {formatValue(benefit.value)}
                      {benefit.maxValuePerBooking != null && (
                        <span className="text-xs text-muted-foreground block">
                          {formatValue(benefit.maxValuePerBooking)}/booking max
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{PERIOD_LABELS[benefit.period]}</TableCell>
                    <TableCell>{benefitSubtitle(benefit)}</TableCell>
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
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Card Benefit</DialogTitle>
            <DialogDescription>Update card benefit details.</DialogDescription>
          </DialogHeader>
          <BenefitForm
            value={editForm}
            onChange={(updates) => setEditForm((prev) => ({ ...prev, ...updates }))}
            hotelChainOptions={hotelChainOptions}
            otaAgencies={otaAgencies}
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
