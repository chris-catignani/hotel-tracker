"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PromotionForm, PromotionFormData } from "@/components/promotions/promotion-form";

interface Promotion {
  id: number;
  name: string;
  type: string;
  valueType: string;
  value: string;
  hotelChainId: number | null;
  hotelChainSubBrandId: number | null;
  creditCardId: number | null;
  shoppingPortalId: number | null;
  minSpend: string | null;
  startDate: string | null;
  endDate: string | null;
  isActive: boolean;
}

function toDateInputValue(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toISOString().split("T")[0];
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
        setInitialData({
          name: promo.name,
          type: promo.type,
          valueType: promo.valueType,
          value: parseFloat(promo.value),
          hotelChainId: promo.hotelChainId,
          hotelChainSubBrandId: promo.hotelChainSubBrandId,
          creditCardId: promo.creditCardId,
          shoppingPortalId: promo.shoppingPortalId,
          minSpend: promo.minSpend ? parseFloat(promo.minSpend) : null,
          startDate: toDateInputValue(promo.startDate),
          endDate: toDateInputValue(promo.endDate),
          isActive: promo.isActive,
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
