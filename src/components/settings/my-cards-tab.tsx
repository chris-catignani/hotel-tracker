// src/components/settings/my-cards-tab.tsx
"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AppSelect } from "@/components/ui/app-select";
import { DatePicker } from "@/components/ui/date-picker";
import { apiFetch } from "@/lib/api-fetch";
import { logger } from "@/lib/logger";
import { CreditCard, UserCreditCard } from "@/lib/types";
import { CreditCard as CreditCardIcon } from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { SettingsCrudTab, ColumnDef, CrudActions } from "./settings-crud-tab";

interface CardFormState {
  creditCardId: string;
  nickname: string;
  openedDate: string;
  closedDate: string;
}

const EMPTY_FORM: CardFormState = {
  creditCardId: "",
  nickname: "",
  openedDate: "",
  closedDate: "",
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  try {
    return format(parseISO(dateStr), "MMM d, yyyy");
  } catch {
    return dateStr;
  }
}

function cardLabel(card: UserCreditCard): string {
  return card.nickname ? `${card.creditCard.name} (${card.nickname})` : card.creditCard.name;
}

function CardFormFields({
  value,
  onChange,
  prefix,
  cardProductOptions,
}: {
  value: CardFormState;
  onChange: (updates: Partial<CardFormState>) => void;
  prefix: string;
  cardProductOptions: { label: string; value: string }[];
}) {
  return (
    <div className="space-y-4 py-2">
      <div className="space-y-2">
        <Label htmlFor={`${prefix}-card`}>Credit Card *</Label>
        <AppSelect
          value={value.creditCardId}
          onValueChange={(v) => onChange({ creditCardId: v })}
          options={cardProductOptions}
          placeholder="Select a card product..."
          data-testid={`${prefix}-card-select`}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${prefix}-nickname`}>Nickname</Label>
        <Input
          id={`${prefix}-nickname`}
          value={value.nickname}
          onChange={(e) => onChange({ nickname: e.target.value })}
          placeholder='e.g. "AMEX Biz Plat #1"'
          data-testid={`${prefix}-nickname-input`}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Opened Date</Label>
          <DatePicker
            date={value.openedDate ? parseISO(value.openedDate) : undefined}
            setDate={(d) => onChange({ openedDate: d ? format(d, "yyyy-MM-dd") : "" })}
            placeholder="Select date"
          />
        </div>
        <div className="space-y-2">
          <Label>Closed Date</Label>
          <DatePicker
            date={value.closedDate ? parseISO(value.closedDate) : undefined}
            setDate={(d) => onChange({ closedDate: d ? format(d, "yyyy-MM-dd") : "" })}
            placeholder="Select date"
          />
        </div>
      </div>
    </div>
  );
}

export function MyCardsTab() {
  const [creditCardProducts, setCreditCardProducts] = useState<CreditCard[]>([]);
  const [form, setForm] = useState<CardFormState>(EMPTY_FORM);
  const [editCard, setEditCard] = useState<UserCreditCard | null>(null);
  const [editForm, setEditForm] = useState<CardFormState>(EMPTY_FORM);
  const [cardToDelete, setCardToDelete] = useState<UserCreditCard | null>(null);

  const fetchDependencies = async () => {
    const result = await apiFetch<CreditCard[]>("/api/credit-cards");
    if (result.ok) setCreditCardProducts(result.data);
  };

  const fetchItems = async () => {
    const result = await apiFetch<UserCreditCard[]>("/api/user-credit-cards");
    if (!result.ok) throw new Error(result.error.message);
    return [...result.data].sort((a, b) => a.creditCard.name.localeCompare(b.creditCard.name));
  };

  const handleAddSubmit = async () => {
    const result = await apiFetch("/api/user-credit-cards", {
      method: "POST",
      body: {
        creditCardId: form.creditCardId,
        nickname: form.nickname || null,
        openedDate: form.openedDate || null,
        closedDate: form.closedDate || null,
      },
    });
    if (result.ok) {
      setForm(EMPTY_FORM);
      return true;
    }
    logger.error("Failed to add card", result.error, { status: result.status });
    toast.error("Failed to add card. Please try again.");
    return false;
  };

  const handleEditSubmit = async () => {
    if (!editCard) return false;
    const result = await apiFetch(`/api/user-credit-cards/${editCard.id}`, {
      method: "PUT",
      body: {
        creditCardId: editForm.creditCardId,
        nickname: editForm.nickname || null,
        openedDate: editForm.openedDate || null,
        closedDate: editForm.closedDate || null,
      },
    });
    if (result.ok) {
      setEditCard(null);
      return true;
    }
    logger.error("Failed to update card", result.error, { status: result.status });
    toast.error("Failed to update card. Please try again.");
    return false;
  };

  const handleDeleteConfirm = async () => {
    if (!cardToDelete) return;
    const result = await apiFetch(`/api/user-credit-cards/${cardToDelete.id}`, {
      method: "DELETE",
    });
    if (!result.ok) {
      if (result.status === 409) {
        toast.error("Cannot delete: this card instance is referenced by existing bookings.");
      } else {
        logger.error("Failed to delete card", result.error, { status: result.status });
        toast.error("Failed to delete card. Please try again.");
      }
    }
  };

  const cardProductOptions = creditCardProducts.map((c) => ({ label: c.name, value: c.id }));

  const columns: ColumnDef<UserCreditCard>[] = [
    {
      header: "Card",
      render: (card) => <span data-testid="my-card-name">{card.creditCard.name}</span>,
    },
    { header: "Nickname", render: (card) => card.nickname || "—" },
    { header: "Opened", render: (card) => formatDate(card.openedDate) },
    { header: "Closed", render: (card) => formatDate(card.closedDate) },
    {
      header: "Status",
      render: (card) => (
        <span
          className={`text-xs px-2 py-0.5 rounded-full ${!card.closedDate ? "bg-green-100 text-green-800" : "bg-muted text-muted-foreground"}`}
        >
          {!card.closedDate ? "Active" : "Closed"}
        </span>
      ),
    },
  ];

  const renderMobileCard = (card: UserCreditCard, actions: CrudActions<UserCreditCard>) => (
    <Card key={card.id} data-testid="my-card-card">
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="font-bold" data-testid="my-card-name">
            {cardLabel(card)}
          </h4>
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${!card.closedDate ? "bg-green-100 text-green-800" : "bg-muted text-muted-foreground"}`}
          >
            {!card.closedDate ? "Active" : "Closed"}
          </span>
        </div>
        {(card.openedDate || card.closedDate) && (
          <p className="text-sm text-muted-foreground">
            {card.openedDate && `Opened: ${formatDate(card.openedDate)}`}
            {card.openedDate && card.closedDate && " · "}
            {card.closedDate && `Closed: ${formatDate(card.closedDate)}`}
          </p>
        )}
        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => actions.onEdit(card)}
          >
            Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-destructive"
            onClick={() => actions.onDelete(card)}
          >
            Delete
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <SettingsCrudTab<UserCreditCard>
      title="My Cards"
      addButtonLabel="Add Card"
      addButtonTestId="add-my-card-button"
      fetchItems={fetchItems}
      fetchDependencies={fetchDependencies}
      columns={columns}
      renderMobileCard={renderMobileCard}
      addDialog={{
        title: "Add Card Instance",
        description:
          "Track a specific card you hold. Add multiple instances for the same card product (e.g. two AMEX Platinum cards).",
        renderFields: () => (
          <CardFormFields
            value={form}
            onChange={(updates) => setForm((prev) => ({ ...prev, ...updates }))}
            prefix="add"
            cardProductOptions={cardProductOptions}
          />
        ),
        onSubmit: handleAddSubmit,
        isValid: form.creditCardId.length > 0,
      }}
      editDialog={{
        title: "Edit Card Instance",
        description: "Update card details.",
        renderFields: () => (
          <CardFormFields
            value={editForm}
            onChange={(updates) => setEditForm((prev) => ({ ...prev, ...updates }))}
            prefix="edit"
            cardProductOptions={cardProductOptions}
          />
        ),
        onSubmit: handleEditSubmit,
        isValid: editForm.creditCardId.length > 0,
        onOpen: (card) => {
          setEditCard(card);
          setEditForm({
            creditCardId: card.creditCardId,
            nickname: card.nickname || "",
            openedDate: card.openedDate ? card.openedDate.split("T")[0] : "",
            closedDate: card.closedDate ? card.closedDate.split("T")[0] : "",
          });
        },
      }}
      deleteDialog={{
        getTitle: () => "Delete Card Instance?",
        getDescription: (card) =>
          `Are you sure you want to delete "${cardLabel(card)}"? This cannot be undone.`,
        onConfirm: handleDeleteConfirm,
        onOpen: setCardToDelete,
      }}
      emptyState={{
        icon: CreditCardIcon,
        title: "No card instances",
        description: "Add the credit cards you hold to track which card you used for each booking.",
      }}
      testIds={{ list: "my-cards-desktop", empty: "my-cards-empty" }}
    />
  );
}
