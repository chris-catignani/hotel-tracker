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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppSelect } from "@/components/ui/app-select";
import { apiFetch } from "@/lib/api-fetch";
import { logger } from "@/lib/logger";
import { CardBenefit, CreditCard, HotelChain, OtaAgency, PointType } from "@/lib/types";
import { ErrorBanner } from "@/components/ui/error-banner";
import { EmptyState } from "@/components/ui/empty-state";
import { CreditCard as CreditCardIcon } from "lucide-react";
import { CreditCardAccordionItem } from "./credit-card-accordion-item";
import { toast } from "sonner";
import { PageSpinner } from "@/components/ui/page-spinner";

export function CreditCardsTab() {
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [pointTypes, setPointTypes] = useState<PointType[]>([]);
  const [hotelChains, setHotelChains] = useState<HotelChain[]>([]);
  const [otaAgencies, setOtaAgencies] = useState<OtaAgency[]>([]);
  const [benefits, setBenefits] = useState<CardBenefit[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [rewardType, setRewardType] = useState("points");
  const [rewardRate, setRewardRate] = useState("");
  const [pointTypeId, setPointTypeId] = useState("none");
  const [initialLoading, setInitialLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [cardsResult, ptResult, hcResult, otaResult, benefitsResult] = await Promise.all([
        apiFetch<CreditCard[]>("/api/credit-cards"),
        apiFetch<PointType[]>("/api/point-types"),
        apiFetch<HotelChain[]>("/api/hotel-chains"),
        apiFetch<OtaAgency[]>("/api/ota-agencies"),
        apiFetch<CardBenefit[]>("/api/card-benefits"),
      ]);
      if (cardsResult.ok) setCards(cardsResult.data);
      else setError(cardsResult.error.message);
      if (ptResult.ok) setPointTypes(ptResult.data);
      if (hcResult.ok) setHotelChains(hcResult.data);
      if (otaResult.ok) setOtaAgencies(otaResult.data);
      if (benefitsResult.ok) setBenefits(benefitsResult.data);
    } finally {
      setInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  const handleSubmit = async () => {
    const result = await apiFetch("/api/credit-cards", {
      method: "POST",
      body: {
        name,
        rewardType,
        rewardRate: Number(rewardRate),
        pointTypeId: pointTypeId !== "none" ? pointTypeId : null,
        rewardRules: [],
      },
    });
    if (result.ok) {
      setName("");
      setRewardType("points");
      setRewardRate("");
      setPointTypeId("none");
      setOpen(false);
      fetchData();
    } else {
      logger.error("Failed to add credit card", result.error, { status: result.status });
      toast.error("Failed to add credit card. Please try again.");
    }
  };

  if (initialLoading) return <PageSpinner />;

  return (
    <div className="flex flex-col flex-1 min-h-0 space-y-4">
      <ErrorBanner error={error} onDismiss={() => setError(null)} />

      <div className="flex items-center justify-between shrink-0">
        <h2 className="text-lg font-semibold">Credit Cards</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="add-credit-card-button">Add Credit Card</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Credit Card</DialogTitle>
              <DialogDescription>
                Add a credit card. You can configure earning rules and benefits after.
              </DialogDescription>
            </DialogHeader>
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
                <Label>Reward Type</Label>
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
                <Label htmlFor="card-reward-rate">Base Rate</Label>
                <Input
                  id="card-reward-rate"
                  type="number"
                  step="0.01"
                  value={rewardRate}
                  onChange={(e) => setRewardRate(e.target.value)}
                  placeholder="e.g. 1.5"
                />
              </div>
              <div className="space-y-2">
                <Label>Point Type</Label>
                <AppSelect
                  value={pointTypeId}
                  onValueChange={setPointTypeId}
                  options={[
                    { label: "None", value: "none" },
                    ...pointTypes.map((pt) => ({ label: pt.name, value: pt.id })),
                  ]}
                  placeholder="Select point type..."
                  data-testid="card-point-type-select"
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleSubmit} disabled={!name.trim() || !rewardRate}>
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

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
        <div className="space-y-3 overflow-auto flex-1 min-h-0" data-testid="credit-cards-list">
          {cards.map((card) => (
            <CreditCardAccordionItem
              key={card.id}
              card={card}
              benefits={benefits.filter((b) => b.creditCardId === card.id)}
              hotelChains={hotelChains}
              otaAgencies={otaAgencies}
              pointTypes={pointTypes}
              onRefetch={fetchData}
            />
          ))}
        </div>
      )}
    </div>
  );
}
