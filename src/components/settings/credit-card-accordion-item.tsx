"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppSelect } from "@/components/ui/app-select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { apiFetch } from "@/lib/api-fetch";
import { logger } from "@/lib/logger";
import { toast } from "sonner";
import {
  CreditCard,
  CreditCardRewardRule,
  CreditCardRewardRuleFormData,
  CreditCardRewardRuleType,
  HotelChain,
  OtaAgency,
  PointType,
  CardBenefit,
} from "@/lib/types";
import { ChevronDown, ChevronRight, Check, Pencil, Plus } from "lucide-react";
import { CardBenefitsSection } from "./card-benefits-section";

// ---------------------------------------------------------------------------
// Rule form helpers
// ---------------------------------------------------------------------------

type RuleFormState = {
  hotelChainId: string | null;
  otaAgencyId: string | null;
  rewardType: CreditCardRewardRuleType;
  rewardValue: string;
};

const EMPTY_RULE: RuleFormState = {
  hotelChainId: null,
  otaAgencyId: null,
  rewardType: "multiplier",
  rewardValue: "",
};

function RuleFormContent({
  form,
  onChange,
  hotelChains,
  otaAgencies,
}: {
  form: RuleFormState;
  onChange: (updates: Partial<RuleFormState>) => void;
  hotelChains: HotelChain[];
  otaAgencies: OtaAgency[];
}) {
  const targetValue = form.hotelChainId
    ? `hc:${form.hotelChainId}`
    : form.otaAgencyId
      ? `ota:${form.otaAgencyId}`
      : "none";

  return (
    <div className="space-y-4 py-2">
      <div className="space-y-2">
        <Label>Target (optional)</Label>
        <AppSelect
          value={targetValue}
          onValueChange={(val) => {
            if (val === "none") onChange({ hotelChainId: null, otaAgencyId: null });
            else if (val.startsWith("hc:"))
              onChange({ hotelChainId: val.replace("hc:", ""), otaAgencyId: null });
            else if (val.startsWith("ota:"))
              onChange({ otaAgencyId: val.replace("ota:", ""), hotelChainId: null });
          }}
          options={[
            { label: "All bookings", value: "none" },
            ...hotelChains.map((hc) => ({ label: `Hotel: ${hc.name}`, value: `hc:${hc.id}` })),
            ...otaAgencies.map((ota) => ({
              label: `OTA: ${ota.name}`,
              value: `ota:${ota.id}`,
            })),
          ]}
          placeholder="All bookings"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Type</Label>
          <AppSelect
            value={form.rewardType}
            onValueChange={(val) => onChange({ rewardType: val as CreditCardRewardRuleType })}
            options={[
              { label: "Multiplier (x)", value: "multiplier" },
              { label: "Fixed Bonus (pts)", value: "fixed" },
            ]}
          />
        </div>
        <div className="space-y-2">
          <Label>{form.rewardType === "multiplier" ? "Rate (e.g. 4)" : "Points"}</Label>
          <Input
            type="number"
            value={form.rewardValue}
            onChange={(e) => onChange({ rewardValue: e.target.value })}
            placeholder={form.rewardType === "multiplier" ? "4" : "1000"}
          />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Earning Rates section
// ---------------------------------------------------------------------------

function EarningRatesSection({
  card,
  hotelChains,
  otaAgencies,
  pointTypes,
  onRefetch,
}: {
  card: CreditCard;
  hotelChains: HotelChain[];
  otaAgencies: OtaAgency[];
  pointTypes: PointType[];
  onRefetch: () => void;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState<RuleFormState>(EMPTY_RULE);

  const [editOpen, setEditOpen] = useState(false);
  const [editRule, setEditRule] = useState<CreditCardRewardRule | null>(null);
  const [editForm, setEditForm] = useState<RuleFormState>(EMPTY_RULE);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [ruleToDelete, setRuleToDelete] = useState<CreditCardRewardRule | null>(null);

  const [baseOpen, setBaseOpen] = useState(false);
  const [baseRewardType, setBaseRewardType] = useState(card.rewardType);
  const [baseRewardRate, setBaseRewardRate] = useState(String(card.rewardRate));
  const [basePointTypeId, setBasePointTypeId] = useState(card.pointTypeId ?? "none");

  const existingRules = (card.rewardRules ?? []).map(
    (r): CreditCardRewardRuleFormData => ({
      id: r.id,
      hotelChainId: r.hotelChainId,
      otaAgencyId: r.otaAgencyId,
      rewardType: r.rewardType,
      rewardValue: Number(r.rewardValue),
    })
  );

  const putCard = async (body: Record<string, unknown>) => {
    const result = await apiFetch(`/api/credit-cards/${card.id}`, {
      method: "PUT",
      body,
    });
    if (result.ok) {
      onRefetch();
      return true;
    }
    logger.error("Failed to update card", result.error, { status: result.status });
    toast.error("Failed to update card. Please try again.");
    return false;
  };

  const handleSaveBase = async () => {
    const ok = await putCard({
      rewardType: baseRewardType,
      rewardRate: Number(baseRewardRate),
      pointTypeId: basePointTypeId !== "none" ? basePointTypeId : null,
    });
    if (ok) setBaseOpen(false);
  };

  const handleAddRule = async () => {
    const ok = await putCard({
      rewardRules: [
        ...existingRules,
        {
          hotelChainId: addForm.hotelChainId,
          otaAgencyId: addForm.otaAgencyId,
          rewardType: addForm.rewardType,
          rewardValue: Number(addForm.rewardValue),
        },
      ],
    });
    if (ok) {
      setAddForm(EMPTY_RULE);
      setAddOpen(false);
    }
  };

  const handleEditRule = async () => {
    if (!editRule) return;
    const ok = await putCard({
      rewardRules: existingRules.map((r) =>
        r.id === editRule.id
          ? {
              ...r,
              hotelChainId: editForm.hotelChainId,
              otaAgencyId: editForm.otaAgencyId,
              rewardType: editForm.rewardType,
              rewardValue: Number(editForm.rewardValue),
            }
          : r
      ),
    });
    if (ok) {
      setEditOpen(false);
      setEditRule(null);
    }
  };

  const handleDeleteRuleConfirm = async () => {
    if (!ruleToDelete) return;
    setDeleteOpen(false);
    await putCard({ rewardRules: existingRules.filter((r) => r.id !== ruleToDelete.id) });
  };

  const openEditRule = (rule: CreditCardRewardRule) => {
    setEditRule(rule);
    setEditForm({
      hotelChainId: rule.hotelChainId,
      otaAgencyId: rule.otaAgencyId,
      rewardType: rule.rewardType,
      rewardValue: String(Number(rule.rewardValue)),
    });
    setEditOpen(true);
  };

  const ruleTargetLabel = (rule: CreditCardRewardRule) =>
    rule.hotelChain?.name ?? rule.otaAgency?.name ?? "All bookings";

  const ruleValueLabel = (rule: CreditCardRewardRule) =>
    rule.rewardType === "multiplier"
      ? `${Number(rule.rewardValue)}x`
      : `+${Number(rule.rewardValue).toLocaleString()} pts`;

  const pointTypeName = pointTypes.find((pt) => pt.id === card.pointTypeId)?.name ?? "";
  const isAddValid = addForm.rewardValue !== "" && Number(addForm.rewardValue) > 0;
  const isEditValid = editForm.rewardValue !== "" && Number(editForm.rewardValue) > 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Earning Rates
        </span>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setAddForm(EMPTY_RULE);
            setAddOpen(true);
          }}
        >
          <Plus className="mr-1 size-3" />
          Add Rule
        </Button>
      </div>

      {/* Unified earning rates list: base rate + targeted rules */}
      <div className="divide-y border rounded-md">
        {/* Base rate row */}
        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-medium truncate">All bookings</span>
            <span className="text-xs text-muted-foreground shrink-0">base</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-sm font-medium">
              {card.rewardRate}x{pointTypeName ? ` ${pointTypeName}` : ""}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setBaseRewardType(card.rewardType);
                setBaseRewardRate(String(card.rewardRate));
                setBasePointTypeId(card.pointTypeId ?? "none");
                setBaseOpen(true);
              }}
            >
              Edit
            </Button>
          </div>
        </div>

        {/* Targeted rules */}
        {(card.rewardRules ?? []).map((rule) => (
          <div key={rule.id} className="flex items-center justify-between px-3 py-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-medium truncate">{ruleTargetLabel(rule)}</span>
              <span className="text-xs text-muted-foreground capitalize shrink-0">
                {rule.rewardType}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-sm font-medium">{ruleValueLabel(rule)}</span>
              <Button variant="ghost" size="sm" onClick={() => openEditRule(rule)}>
                Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setRuleToDelete(rule);
                  setDeleteOpen(true);
                }}
              >
                Delete
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Edit base rate dialog */}
      <Dialog open={baseOpen} onOpenChange={setBaseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Base Rate</DialogTitle>
            <DialogDescription>Set the default earning rate for all bookings.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Reward Type</Label>
              <AppSelect
                value={baseRewardType}
                onValueChange={setBaseRewardType}
                options={[
                  { label: "Points", value: "points" },
                  { label: "Cashback", value: "cashback" },
                ]}
              />
            </div>
            <div className="space-y-2">
              <Label>Rate</Label>
              <Input
                type="number"
                step="0.01"
                value={baseRewardRate}
                onChange={(e) => setBaseRewardRate(e.target.value)}
                placeholder="e.g. 1.5"
              />
            </div>
            <div className="space-y-2">
              <Label>Point Type</Label>
              <AppSelect
                value={basePointTypeId}
                onValueChange={setBasePointTypeId}
                options={[
                  { label: "None", value: "none" },
                  ...pointTypes.map((pt) => ({ label: pt.name, value: pt.id })),
                ]}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={handleSaveBase}
              disabled={!baseRewardRate || Number(baseRewardRate) <= 0}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add rule dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Earning Rule</DialogTitle>
            <DialogDescription>Define a boosted rate for a hotel chain or OTA.</DialogDescription>
          </DialogHeader>
          <RuleFormContent
            form={addForm}
            onChange={(u) => setAddForm((prev) => ({ ...prev, ...u }))}
            hotelChains={hotelChains}
            otaAgencies={otaAgencies}
          />
          <DialogFooter>
            <Button onClick={handleAddRule} disabled={!isAddValid}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit rule dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Earning Rule</DialogTitle>
            <DialogDescription>Update this boosted earning rule.</DialogDescription>
          </DialogHeader>
          <RuleFormContent
            form={editForm}
            onChange={(u) => setEditForm((prev) => ({ ...prev, ...u }))}
            hotelChains={hotelChains}
            otaAgencies={otaAgencies}
          />
          <DialogFooter>
            <Button onClick={handleEditRule} disabled={!isEditValid}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete rule confirm */}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Rule?"
        description={
          ruleToDelete ? `Remove the "${ruleTargetLabel(ruleToDelete)}" rule from this card?` : ""
        }
        onConfirm={handleDeleteRuleConfirm}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Accordion item (exported)
// ---------------------------------------------------------------------------

export function CreditCardAccordionItem({
  card,
  benefits,
  hotelChains,
  otaAgencies,
  pointTypes,
  onRefetch,
}: {
  card: CreditCard;
  benefits: CardBenefit[];
  hotelChains: HotelChain[];
  otaAgencies: OtaAgency[];
  pointTypes: PointType[];
  onRefetch: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(card.name);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const startEditingName = (e: React.MouseEvent) => {
    e.stopPropagation();
    setNameValue(card.name);
    setEditingName(true);
  };

  const handleNameSaveClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    handleNameSave();
  };

  const handleNameSave = async () => {
    const trimmed = nameValue.trim();
    if (!trimmed || trimmed === card.name) {
      setNameValue(card.name);
      setEditingName(false);
      return;
    }
    const result = await apiFetch(`/api/credit-cards/${card.id}`, {
      method: "PUT",
      body: { name: trimmed },
    });
    if (result.ok) {
      setEditingName(false);
      onRefetch();
    } else {
      logger.error("Failed to update card name", result.error, { status: result.status });
      toast.error("Failed to update card name. Please try again.");
      setNameValue(card.name);
      setEditingName(false);
    }
  };

  const handleDeleteConfirm = async () => {
    setDeleteOpen(false);
    const result = await apiFetch(`/api/credit-cards/${card.id}`, { method: "DELETE" });
    if (result.ok) {
      onRefetch();
    } else {
      logger.error("Failed to delete credit card", result.error, { status: result.status });
      toast.error("Failed to delete credit card. Please try again.");
    }
  };

  return (
    <div className="border rounded-lg overflow-hidden" data-testid="credit-card-accordion">
      {/* Header */}
      <div
        className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/30 select-none"
        data-testid={`accordion-header-${card.id}`}
        onClick={() => !editingName && setExpanded((v) => !v)}
      >
        {expanded ? (
          <ChevronDown className="size-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="size-4 text-muted-foreground shrink-0" />
        )}

        {editingName ? (
          <>
            <input
              className="font-semibold text-base bg-transparent border-b border-primary focus:outline-none flex-1 min-w-0"
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleNameSave();
                if (e.key === "Escape") {
                  setNameValue(card.name);
                  setEditingName(false);
                }
              }}
              autoFocus
              onClick={(e) => e.stopPropagation()}
              data-testid="credit-card-name-input"
            />
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0 p-1 h-auto"
              onClick={handleNameSaveClick}
              data-testid="save-credit-card-name-button"
            >
              <Check className="size-4 text-green-600" />
            </Button>
          </>
        ) : (
          <>
            <span
              className="font-semibold text-base flex-1 min-w-0 truncate"
              data-testid="credit-card-card-name"
            >
              {card.name}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0 p-1 h-auto"
              onClick={startEditingName}
              data-testid="edit-credit-card-name-button"
            >
              <Pencil className="size-4 text-muted-foreground" />
            </Button>
          </>
        )}

        {!expanded && !editingName && (
          <span className="text-sm text-muted-foreground shrink-0 hidden sm:block">
            {card.rewardRate}x{card.pointType ? ` ${card.pointType.name}` : ""}
          </span>
        )}

        <div className="shrink-0 ml-1" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
            data-testid="delete-credit-card-button"
            onClick={() => setDeleteOpen(true)}
          >
            Delete
          </Button>
        </div>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div className="border-t divide-y">
          <div className="p-4">
            <EarningRatesSection
              card={card}
              hotelChains={hotelChains}
              otaAgencies={otaAgencies}
              pointTypes={pointTypes}
              onRefetch={onRefetch}
            />
          </div>
          <CardBenefitsSection
            creditCardId={card.id}
            benefits={benefits}
            hotelChains={hotelChains}
            otaAgencies={otaAgencies}
            onRefetch={onRefetch}
          />
        </div>
      )}

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Credit Card?"
        description={`Are you sure you want to delete "${card.name}"? This cannot be undone.`}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
