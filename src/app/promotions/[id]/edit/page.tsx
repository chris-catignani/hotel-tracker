"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { logger } from "@/lib/logger";
import { PromotionForm } from "@/components/promotions/promotion-form";
import { ErrorBanner } from "@/components/ui/error-banner";
import { useApiQuery } from "@/hooks/use-api-query";
import { apiFetch } from "@/lib/api-fetch";
import { toast } from "sonner";
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
    allowedBookingSources: r.allowedBookingSources ?? [],
    allowedCountryCodes: r.allowedCountryCodes ?? [],
    allowedAccommodationTypes: (r.allowedAccommodationTypes ??
      []) as import("@/lib/types").AccommodationType[],
    hotelChainId: r.hotelChainId ?? "",
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

function mapPromoToFormData(promo: Promotion): Partial<PromotionFormData> {
  const restrictionsForm = mapApiRestrictionsToForm(promo.restrictions);
  // registrationDate lives in userPromotions, not in restrictions
  restrictionsForm.registrationDate = toDateInputValue(
    promo.userPromotions?.[0]?.registrationDate || null
  );

  const promoTiers = promo.tiers || [];
  const tierRequirementType = promoTiers.some((t) => t.minNights != null || t.maxNights != null)
    ? "nights"
    : "stays";

  return {
    name: promo.name,
    type: promo.type as PromotionType,
    benefits: (promo.benefits || []).map((b, i) => mapApiBenefitToForm(b, i)),
    tiers: promoTiers.map(
      (tier): PromotionTierFormData => ({
        minStays: tier.minStays,
        maxStays: tier.maxStays,
        minNights: tier.minNights,
        maxNights: tier.maxNights,
        benefits: (tier.benefits || []).map((b, i) => mapApiBenefitToForm(b, i)),
      })
    ),
    tierRequirementType,
    hotelChainId: promo.hotelChainId,
    creditCardId: promo.creditCardId,
    shoppingPortalId: promo.shoppingPortalId,
    startDate: toDateInputValue(promo.startDate),
    endDate: toDateInputValue(promo.endDate),
    restrictions: restrictionsForm,
  };
}

export default function EditPromotionPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [submitting, setSubmitting] = useState(false);

  const {
    data: promo,
    loading,
    error: fetchError,
    clearError,
  } = useApiQuery<Promotion>(`/api/promotions/${id}`, {
    onError: (err) =>
      logger.error("Failed to fetch promotion", err.error, { id, status: err.status }),
  });

  const initialData = promo ? mapPromoToFormData(promo) : null;

  const handleSubmit = async (data: PromotionFormData) => {
    setSubmitting(true);
    const result = await apiFetch<Promotion>(`/api/promotions/${id}`, {
      method: "PUT",
      body: data,
    });
    setSubmitting(false);
    if (!result.ok) {
      logger.error("Failed to update promotion", result.error, {
        id,
        status: result.status,
      });
      toast.error("Failed to save promotion. Please try again.");
      return;
    }
    router.push("/promotions");
  };

  if (loading && !promo) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground text-sm">Loading promotion...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Edit Promotion</h1>

      <ErrorBanner
        error={fetchError ? "Failed to load promotion. Please try again." : null}
        onDismiss={clearError}
      />

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
