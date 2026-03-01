"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PromotionForm } from "@/components/promotions/promotion-form";
import {
  Promotion,
  PromotionFormData,
  PromotionType,
  PromotionRewardType,
  PromotionBenefitValueType,
  PromotionTierFormData,
  PromotionBenefitFormData,
  PromotionRestrictionsData,
  PromotionRestrictionsFormData,
  EMPTY_RESTRICTIONS,
} from "@/lib/types";

function toDateInputValue(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toISOString().split("T")[0];
}

function mapApiRestrictionsToForm(
  r: PromotionRestrictionsData | null | undefined
): PromotionRestrictionsFormData {
  if (!r) return { ...EMPTY_RESTRICTIONS };
  return {
    minSpend: r.minSpend ? String(r.minSpend) : "",
    minNightsRequired: r.minNightsRequired ? String(r.minNightsRequired) : "",
    nightsStackable: r.nightsStackable ?? false,
    spanStays: r.spanStays ?? false,
    maxStayCount: r.maxStayCount ? String(r.maxStayCount) : "",
    maxRewardCount: r.maxRewardCount ? String(r.maxRewardCount) : "",
    maxRedemptionValue: r.maxRedemptionValue ? String(r.maxRedemptionValue) : "",
    maxTotalBonusPoints: r.maxTotalBonusPoints ? String(r.maxTotalBonusPoints) : "",
    oncePerSubBrand: r.oncePerSubBrand ?? false,
    bookByDate: toDateInputValue(r.bookByDate),
    registrationDeadline: toDateInputValue(r.registrationDeadline),
    validDaysAfterRegistration: r.validDaysAfterRegistration
      ? String(r.validDaysAfterRegistration)
      : "",
    registrationDate: "",
    tieInRequiresPayment: r.tieInRequiresPayment ?? false,
    allowedPaymentTypes: r.allowedPaymentTypes ?? [],
    prerequisiteStayCount: r.prerequisiteStayCount ? String(r.prerequisiteStayCount) : "",
    prerequisiteNightCount: r.prerequisiteNightCount ? String(r.prerequisiteNightCount) : "",
    subBrandIncludeIds: (r.subBrandRestrictions ?? [])
      .filter((s) => s.mode === "include")
      .map((s) => s.hotelChainSubBrandId),
    subBrandExcludeIds: (r.subBrandRestrictions ?? [])
      .filter((s) => s.mode === "exclude")
      .map((s) => s.hotelChainSubBrandId),
    tieInCreditCardIds: (r.tieInCards ?? []).map((c) => c.creditCardId),
  };
}

function mapApiBenefitToForm(
  b: Promotion["benefits"][number],
  i: number
): PromotionBenefitFormData {
  return {
    rewardType: b.rewardType as PromotionRewardType,
    valueType: b.valueType as PromotionBenefitValueType,
    value: parseFloat(String(b.value)),
    certType: b.certType,
    pointsMultiplierBasis: b.pointsMultiplierBasis,
    sortOrder: b.sortOrder ?? i,
    restrictions: b.restrictions ? mapApiRestrictionsToForm(b.restrictions) : null,
  };
}

export default function EditPromotionPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [initialData, setInitialData] = useState<Partial<PromotionFormData> | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!id) return;

    fetch(`/api/promotions/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch promotion");
        return res.json();
      })
      .then((promo: Promotion) => {
        const restrictionsForm = mapApiRestrictionsToForm(promo.restrictions);
        // registrationDate lives in userPromotions, not in restrictions
        restrictionsForm.registrationDate = toDateInputValue(
          promo.userPromotions?.[0]?.registrationDate || null
        );

        setInitialData({
          name: promo.name,
          type: promo.type as PromotionType,
          benefits: (promo.benefits || []).map((b, i) => mapApiBenefitToForm(b, i)),
          tiers: (promo.tiers || []).map(
            (tier): PromotionTierFormData => ({
              minStays: tier.minStays,
              maxStays: tier.maxStays,
              minNights: tier.minNights,
              maxNights: tier.maxNights,
              benefits: (tier.benefits || []).map((b, i) => mapApiBenefitToForm(b, i)),
            })
          ),
          hotelChainId: promo.hotelChainId,
          creditCardId: promo.creditCardId,
          shoppingPortalId: promo.shoppingPortalId,
          startDate: toDateInputValue(promo.startDate),
          endDate: toDateInputValue(promo.endDate),
          isActive: promo.isActive,
          restrictions: restrictionsForm,
        });
        setLoading(false);
      })
      .catch((error) => {
        console.error("Failed to fetch promotion:", error);
        setLoading(false);
      });
  }, [id]);

  const handleSubmit = async (data: PromotionFormData) => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/promotions/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        router.push("/promotions");
      } else {
        console.error("Failed to update promotion");
        setSubmitting(false);
      }
    } catch (error) {
      console.error("Failed to update promotion:", error);
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground text-sm">Loading promotion...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Edit Promotion</h1>
      <PromotionForm
        initialData={initialData || undefined}
        onSubmit={handleSubmit}
        submitting={submitting}
        title="Edit Promotion"
        description="Update the details of this promotion."
        submitLabel="Save Changes"
      />
    </div>
  );
}
