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
import { AppSelect } from "@/components/ui/app-select";
import { DatePicker } from "@/components/ui/date-picker";
import { apiFetch } from "@/lib/api-fetch";
import { logger } from "@/lib/logger";
import { CreditCard, UserCreditCard } from "@/lib/types";
import { ErrorBanner } from "@/components/ui/error-banner";
import { EmptyState } from "@/components/ui/empty-state";
import { CreditCard as CreditCardIcon } from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";

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

function cardLabel(card: UserCreditCard): string {
  return card.nickname ? `${card.creditCard.name} (${card.nickname})` : card.creditCard.name;
}

export function MyCardsTab() {
  const [cards, setCards] = useState<UserCreditCard[]>([]);
  const [creditCardProducts, setCreditCardProducts] = useState<CreditCard[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<CardFormState>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editCard, setEditCard] = useState<UserCreditCard | null>(null);
  const [editForm, setEditForm] = useState<CardFormState>(EMPTY_FORM);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [cardToDelete, setCardToDelete] = useState<UserCreditCard | null>(null);

  const fetchCards = useCallback(async () => {
    const result = await apiFetch<UserCreditCard[]>("/api/user-credit-cards");
    if (result.ok) setCards(result.data);
    else setError(result.error.message);
  }, []);

  const fetchCreditCardProducts = useCallback(async () => {
    const result = await apiFetch<CreditCard[]>("/api/credit-cards");
    if (result.ok) setCreditCardProducts(result.data);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchCards();
    fetchCreditCardProducts();
  }, [fetchCards, fetchCreditCardProducts]);

  const handleSubmit = async () => {
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
      setOpen(false);
      fetchCards();
    } else {
      logger.error("Failed to add card", result.error, { status: result.status });
      toast.error("Failed to add card. Please try again.");
    }
  };

  const handleEdit = (card: UserCreditCard) => {
    setEditCard(card);
    setEditForm({
      creditCardId: card.creditCardId,
      nickname: card.nickname || "",
      openedDate: card.openedDate ? card.openedDate.split("T")[0] : "",
      closedDate: card.closedDate ? card.closedDate.split("T")[0] : "",
    });
    setEditOpen(true);
  };

  const handleEditSubmit = async () => {
    if (!editCard) return;
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
      setEditOpen(false);
      setEditCard(null);
      fetchCards();
    } else {
      logger.error("Failed to update card", result.error, { status: result.status });
      toast.error("Failed to update card. Please try again.");
    }
  };

  const handleDeleteClick = (card: UserCreditCard) => {
    setCardToDelete(card);
    setDeleteOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!cardToDelete) return;
    setDeleteOpen(false);
    const result = await apiFetch(`/api/user-credit-cards/${cardToDelete.id}`, {
      method: "DELETE",
    });
    if (result.ok) {
      setCardToDelete(null);
      fetchCards();
    } else if (result.status === 409) {
      toast.error("Cannot delete: this card instance is referenced by existing bookings.");
    } else {
      logger.error("Failed to delete card", result.error, { status: result.status });
      toast.error("Failed to delete card. Please try again.");
    }
  };

  const cardProductOptions = creditCardProducts.map((c) => ({ label: c.name, value: c.id }));
  const sortedCards = [...cards].sort((a, b) => a.creditCard.name.localeCompare(b.creditCard.name));

  return (
    <div className="flex flex-col flex-1 min-h-0 space-y-4">
      <ErrorBanner error={error} onDismiss={() => setError(null)} />
      <div className="flex items-center justify-between shrink-0">
        <h2 className="text-lg font-semibold">My Cards</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="add-my-card-button">Add Card</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Card Instance</DialogTitle>
              <DialogDescription>
                Track a specific card you hold. Add multiple instances for the same card product
                (e.g. two AMEX Platinum cards).
              </DialogDescription>
            </DialogHeader>
            <CardFormFields
              value={form}
              onChange={(updates) => setForm((prev) => ({ ...prev, ...updates }))}
              prefix="add"
              cardProductOptions={cardProductOptions}
            />
            <DialogFooter>
              <Button
                onClick={handleSubmit}
                disabled={!form.creditCardId}
                data-testid="add-my-card-save"
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
            <DialogTitle>Edit Card Instance</DialogTitle>
            <DialogDescription>Update card details.</DialogDescription>
          </DialogHeader>
          <CardFormFields
            value={editForm}
            onChange={(updates) => setEditForm((prev) => ({ ...prev, ...updates }))}
            prefix="edit"
            cardProductOptions={cardProductOptions}
          />
          <DialogFooter>
            <Button
              onClick={handleEditSubmit}
              disabled={!editForm.creditCardId}
              data-testid="edit-my-card-save"
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Card Instance?"
        description={
          cardToDelete
            ? `Are you sure you want to delete "${cardLabel(cardToDelete)}"? This cannot be undone.`
            : ""
        }
        onConfirm={handleDeleteConfirm}
      />

      {cards.length === 0 ? (
        <EmptyState
          icon={CreditCardIcon}
          title="No card instances"
          description="Add the credit cards you hold to track which card you used for each booking."
          action={{
            label: "Add Card",
            onClick: () => setOpen(true),
          }}
          data-testid="my-cards-empty"
        />
      ) : (
        <>
          {/* Mobile View: Cards */}
          <div className="grid grid-cols-1 gap-4 md:hidden" data-testid="my-cards-mobile">
            {sortedCards.map((card) => (
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
                      onClick={() => handleEdit(card)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-destructive"
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
          <div
            className="hidden md:flex md:flex-col md:flex-1 md:min-h-0 md:overflow-auto"
            data-testid="my-cards-desktop"
          >
            <Table containerClassName="overflow-visible">
              <TableHeader className="sticky top-0 bg-background z-20">
                <TableRow>
                  <TableHead>Card</TableHead>
                  <TableHead>Nickname</TableHead>
                  <TableHead>Opened</TableHead>
                  <TableHead>Closed</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedCards.map((card) => (
                  <TableRow key={card.id} data-testid="my-card-row">
                    <TableCell data-testid="my-card-name">{card.creditCard.name}</TableCell>
                    <TableCell>{card.nickname || "—"}</TableCell>
                    <TableCell>{formatDate(card.openedDate)}</TableCell>
                    <TableCell>{formatDate(card.closedDate)}</TableCell>
                    <TableCell>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${!card.closedDate ? "bg-green-100 text-green-800" : "bg-muted text-muted-foreground"}`}
                      >
                        {!card.closedDate ? "Active" : "Closed"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(card)}>
                          Edit
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteClick(card)}>
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
