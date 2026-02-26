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
import { AppSelect } from "@/components/ui/app-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { extractApiError } from "@/lib/client-error";
import {
  CreditCard,
  CreditCardRewardRuleFormData,
  HotelChain,
  OtaAgency,
  PointType,
  CreditCardRewardRuleType,
} from "@/lib/types";
import { ErrorBanner } from "@/components/ui/error-banner";
import { EmptyState } from "@/components/ui/empty-state";
import { CreditCard as CreditCardIcon, Plus, Trash2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";

export function CreditCardsTab() {
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [pointTypes, setPointTypes] = useState<PointType[]>([]);
  const [hotelChains, setHotelChains] = useState<HotelChain[]>([]);
  const [otaAgencies, setOtaAgencies] = useState<OtaAgency[]>([]);

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [rewardType, setRewardType] = useState("points");
  const [rewardRate, setRewardRate] = useState("");
  const [pointTypeId, setPointTypeId] = useState("none");
  const [rewardRules, setRewardRules] = useState<CreditCardRewardRuleFormData[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editCard, setEditCard] = useState<CreditCard | null>(null);
  const [editName, setEditName] = useState("");
  const [editRewardType, setEditRewardType] = useState("points");
  const [editRewardRate, setEditRewardRate] = useState("");
  const [editPointTypeId, setEditPointTypeId] = useState("none");
  const [editRewardRules, setEditRewardRules] = useState<CreditCardRewardRuleFormData[]>([]);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [cardToDelete, setCardToDelete] = useState<CreditCard | null>(null);

  const fetchData = useCallback(async () => {
    const [cardsRes, ptRes, hcRes, otaRes] = await Promise.all([
      fetch("/api/credit-cards"),
      fetch("/api/point-types"),
      fetch("/api/hotel-chains"),
      fetch("/api/ota-agencies"),
    ]);
    if (cardsRes.ok) setCards(await cardsRes.json());
    else setError(await extractApiError(cardsRes, "Failed to load credit cards."));

    if (ptRes.ok) setPointTypes(await ptRes.json());
    if (hcRes.ok) setHotelChains(await hcRes.json());
    if (otaRes.ok) setOtaAgencies(await otaRes.json());
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  const handleSubmit = async () => {
    setError(null);
    const res = await fetch("/api/credit-cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        rewardType,
        rewardRate: Number(rewardRate),
        pointTypeId: pointTypeId !== "none" ? pointTypeId : null,
        rewardRules,
      }),
    });
    if (res.ok) {
      setName("");
      setRewardType("points");
      setRewardRate("");
      setPointTypeId("none");
      setRewardRules([]);
      setOpen(false);
      fetchData();
    } else {
      setError(await extractApiError(res, "Failed to add credit card."));
    }
  };

  const handleEdit = (card: CreditCard) => {
    setEditCard(card);
    setEditName(card.name);
    setEditRewardType(card.rewardType);
    setEditRewardRate(String(card.rewardRate));
    setEditPointTypeId(card.pointTypeId != null ? card.pointTypeId : "none");
    setEditRewardRules(
      (card.rewardRules || []).map((r) => ({
        id: r.id,
        hotelChainId: r.hotelChainId,
        otaAgencyId: r.otaAgencyId,
        rewardType: r.rewardType,
        rewardValue: Number(r.rewardValue),
      }))
    );
    setEditOpen(true);
  };

  const handleEditSubmit = async () => {
    if (!editCard) return;
    setError(null);
    const res = await fetch(`/api/credit-cards/${editCard.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editName,
        rewardType: editRewardType,
        rewardRate: Number(editRewardRate),
        pointTypeId: editPointTypeId !== "none" ? editPointTypeId : null,
        rewardRules: editRewardRules,
      }),
    });
    if (res.ok) {
      setEditOpen(false);
      setEditCard(null);
      fetchData();
    } else {
      setError(await extractApiError(res, "Failed to update credit card."));
    }
  };

  const handleDeleteClick = (card: CreditCard) => {
    setCardToDelete(card);
    setDeleteOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!cardToDelete) return;
    setDeleteOpen(false);
    setError(null);
    const res = await fetch(`/api/credit-cards/${cardToDelete.id}`, { method: "DELETE" });
    if (res.ok) {
      setCardToDelete(null);
      fetchData();
    } else {
      setError(await extractApiError(res, "Failed to delete credit card."));
    }
  };

  return (
    <div className="space-y-4">
      <ErrorBanner error={error} onDismiss={() => setError(null)} />
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Credit Cards</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="add-credit-card-button">Add Credit Card</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md max-h-[90vh] flex flex-col p-0">
            <DialogHeader className="p-6 pb-2">
              <DialogTitle>Add Credit Card</DialogTitle>
              <DialogDescription>Add a credit card to track rewards.</DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto px-6 py-2 space-y-4 custom-scrollbar">
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="card-name">Name</Label>
                  <Input
                    id="card-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Card name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="card-reward-type">Reward Type</Label>
                  <AppSelect
                    value={rewardType}
                    onValueChange={setRewardType}
                    options={[
                      { label: "Points", value: "points" },
                      { label: "Cashback", value: "cashback" },
                    ]}
                    placeholder="Select reward type"
                    data-testid="card-reward-type-select"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="card-reward-rate">Reward Rate</Label>
                  <Input
                    id="card-reward-rate"
                    type="number"
                    step="0.01"
                    value={rewardRate}
                    onChange={(e) => setRewardRate(e.target.value)}
                    placeholder="e.g. 3"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="card-point-type">Point Type</Label>
                  <AppSelect
                    value={pointTypeId}
                    onValueChange={setPointTypeId}
                    options={[
                      { label: "None", value: "none" },
                      ...pointTypes.map((pt) => ({
                        label: pt.name,
                        value: pt.id,
                      })),
                    ]}
                    placeholder="Select point type..."
                    data-testid="card-point-type-select"
                  />
                </div>

                <Separator />

                <RewardRulesSection
                  rules={rewardRules}
                  setRules={setRewardRules}
                  hotelChains={hotelChains}
                  otaAgencies={otaAgencies}
                />
              </div>
            </div>

            <DialogFooter className="p-6 pt-2 border-t">
              <Button onClick={handleSubmit} disabled={!name.trim() || !rewardRate}>
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle>Edit Credit Card</DialogTitle>
            <DialogDescription>Update credit card details and reward rate.</DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-2 space-y-4 custom-scrollbar">
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="edit-card-name">Name</Label>
                <Input
                  id="edit-card-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Card name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-card-reward-type">Reward Type</Label>
                <AppSelect
                  value={editRewardType}
                  onValueChange={setEditRewardType}
                  options={[
                    { label: "Points", value: "points" },
                    { label: "Cashback", value: "cashback" },
                  ]}
                  placeholder="Select reward type"
                  data-testid="edit-card-reward-type-select"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-card-reward-rate">Reward Rate</Label>
                <Input
                  id="edit-card-reward-rate"
                  type="number"
                  step="0.01"
                  value={editRewardRate}
                  onChange={(e) => setEditRewardRate(e.target.value)}
                  placeholder="e.g. 3"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-card-point-type">Point Type</Label>
                <AppSelect
                  value={editPointTypeId}
                  onValueChange={setEditPointTypeId}
                  options={[
                    { label: "None", value: "none" },
                    ...pointTypes.map((pt) => ({
                      label: pt.name,
                      value: pt.id,
                    })),
                  ]}
                  placeholder="Select point type..."
                  data-testid="edit-card-point-type-select"
                />
              </div>

              <Separator />

              <RewardRulesSection
                rules={editRewardRules}
                setRules={setEditRewardRules}
                hotelChains={hotelChains}
                otaAgencies={otaAgencies}
              />
            </div>
          </div>

          <DialogFooter className="p-6 pt-2 border-t">
            <Button onClick={handleEditSubmit} disabled={!editName.trim() || !editRewardRate}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Credit Card?"
        description={
          cardToDelete
            ? `Are you sure you want to delete "${cardToDelete.name}"? This cannot be undone.`
            : ""
        }
        onConfirm={handleDeleteConfirm}
      />

      {cards.length === 0 ? (
        <EmptyState
          icon={CreditCardIcon}
          title="No credit cards"
          description="Add credit cards to track rewards and cashback on your bookings."
          action={{
            label: "Add Credit Card",
            onClick: () => setOpen(true),
          }}
          data-testid="credit-cards-empty"
        />
      ) : (
        <>
          {/* Mobile View: Cards */}
          <div className="grid grid-cols-1 gap-4 md:hidden" data-testid="credit-cards-mobile">
            {cards.map((card) => (
              <Card key={card.id} data-testid="credit-card-card">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold" data-testid="credit-card-card-name">
                        {card.name}
                      </h3>
                      <p className="text-sm text-muted-foreground capitalize">{card.rewardType}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">Rate</p>
                      <div className="flex flex-col items-end">
                        <p className="text-lg font-bold">{card.rewardRate}x</p>
                        {card.rewardRules && card.rewardRules.length > 0 && (
                          <span className="text-[10px] font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full mt-0.5">
                            {card.rewardRules.length === 1 ? (
                              <>
                                {card.rewardRules[0].rewardType === "multiplier"
                                  ? `(${card.rewardRules[0].rewardValue}x at `
                                  : `(+ ${Number(card.rewardRules[0].rewardValue).toLocaleString()} pts `}
                                {card.rewardRules[0].hotelChain?.name ||
                                  card.rewardRules[0].otaAgency?.name ||
                                  ""}
                                )
                              </>
                            ) : (
                              `+ ${card.rewardRules.length} rules`
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Point Type</span>
                    <span className="font-medium">{card.pointType?.name ?? "—"}</span>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleEdit(card)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-destructive"
                      data-testid="delete-credit-card-button"
                      onClick={() => handleDeleteClick(card)}
                    >
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Desktop View: Table */}
          <div className="hidden md:block" data-testid="credit-cards-desktop">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Reward Type</TableHead>
                  <TableHead>Reward Rate</TableHead>
                  <TableHead>Point Type</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cards.map((card) => (
                  <TableRow key={card.id} data-testid="credit-card-table-row">
                    <TableCell className="font-medium" data-testid="credit-card-table-name">
                      {card.name}
                    </TableCell>
                    <TableCell className="capitalize">{card.rewardType}</TableCell>
                    <TableCell>
                      {card.rewardRate}x
                      {card.rewardRules && card.rewardRules.length > 0 && (
                        <div className="text-[10px] font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full inline-flex ml-1.5 align-middle">
                          {card.rewardRules.length === 1 ? (
                            <>
                              {card.rewardRules[0].rewardType === "multiplier"
                                ? `(${card.rewardRules[0].rewardValue}x at `
                                : `(+ ${Number(card.rewardRules[0].rewardValue).toLocaleString()} pts `}
                              {card.rewardRules[0].hotelChain?.name ||
                                card.rewardRules[0].otaAgency?.name ||
                                ""}
                              {card.rewardRules[0].rewardType === "multiplier" ? ")" : ")"}
                            </>
                          ) : (
                            `+ ${card.rewardRules.length} rules`
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{card.pointType?.name ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(card)}>
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          data-testid="delete-credit-card-button"
                          onClick={() => handleDeleteClick(card)}
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

function RewardRulesSection({
  rules,
  setRules,
  hotelChains,
  otaAgencies,
}: {
  rules: CreditCardRewardRuleFormData[];
  setRules: React.Dispatch<React.SetStateAction<CreditCardRewardRuleFormData[]>>;
  hotelChains: HotelChain[];
  otaAgencies: OtaAgency[];
}) {
  const addRule = () => {
    setRules([
      ...rules,
      {
        hotelChainId: null,
        otaAgencyId: null,
        rewardType: "multiplier",
        rewardValue: "", // Start empty for placeholder
      },
    ]);
  };

  const removeRule = (index: number) => {
    setRules(rules.filter((_, i) => i !== index));
  };

  const updateRule = (index: number, updates: Partial<CreditCardRewardRuleFormData>) => {
    setRules(rules.map((r, i) => (i === index ? { ...r, ...updates } : r)));
  };

  return (
    <div className="space-y-4 pt-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
          Boosted Rates / Rules
        </Label>
        <Button type="button" variant="outline" size="sm" onClick={addRule}>
          <Plus className="mr-1 size-3" />
          Add Rule
        </Button>
      </div>

      {rules.length === 0 ? (
        <p className="py-2 text-center text-xs text-muted-foreground italic">
          No custom rules defined. Card uses base rate everywhere.
        </p>
      ) : (
        <div className="space-y-4">
          {rules.map((rule, index) => (
            <div key={index} className="space-y-3 rounded-lg border p-3 bg-muted/30">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold">Rule #{index + 1}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-destructive hover:bg-destructive/10"
                  onClick={() => removeRule(index)}
                >
                  <Trash2 className="size-3" />
                </Button>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase">Link To</Label>
                  <AppSelect
                    value={
                      rule.hotelChainId
                        ? `hc:${rule.hotelChainId}`
                        : rule.otaAgencyId
                          ? `ota:${rule.otaAgencyId}`
                          : "none"
                    }
                    onValueChange={(val) => {
                      if (val === "none") {
                        updateRule(index, { hotelChainId: null, otaAgencyId: null });
                      } else if (val.startsWith("hc:")) {
                        updateRule(index, {
                          hotelChainId: val.replace("hc:", ""),
                          otaAgencyId: null,
                        });
                      } else if (val.startsWith("ota:")) {
                        updateRule(index, {
                          otaAgencyId: val.replace("ota:", ""),
                          hotelChainId: null,
                        });
                      }
                    }}
                    options={[
                      { label: "None", value: "none" },
                      ...hotelChains.map((hc) => ({
                        label: `Hotel: ${hc.name}`,
                        value: `hc:${hc.id}`,
                      })),
                      ...otaAgencies.map((ota) => ({
                        label: `OTA: ${ota.name}`,
                        value: `ota:${ota.id}`,
                      })),
                    ]}
                    placeholder="Select target..."
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase">Reward Type</Label>
                  <AppSelect
                    value={rule.rewardType}
                    onValueChange={(val) =>
                      updateRule(index, {
                        rewardType: val as CreditCardRewardRuleType,
                      })
                    }
                    options={[
                      { label: "Multiplier (x)", value: "multiplier" },
                      { label: "Fixed Bonus (pts)", value: "fixed" },
                    ]}
                  />
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-[10px] uppercase">
                    Value {rule.rewardType === "multiplier" ? "(e.g. 4 for 4x)" : "(points)"}
                  </Label>
                  <Input
                    type="number"
                    value={rule.rewardValue}
                    onChange={(e) =>
                      updateRule(index, {
                        rewardValue: e.target.value === "" ? "" : Number(e.target.value),
                      })
                    }
                    placeholder={rule.rewardType === "multiplier" ? "4" : "1000"}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
