"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { logger } from "@/lib/logger";
import { PromotionForm } from "@/components/promotions/promotion-form";
import { PromotionFormData } from "@/lib/types";
import { ErrorBanner } from "@/components/ui/error-banner";
import { apiFetch } from "@/lib/api-fetch";

export default function NewPromotionPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (data: PromotionFormData) => {
    setError(null);
    setSubmitting(true);
    const result = await apiFetch("/api/promotions", {
      method: "POST",
      body: data,
    });
    setSubmitting(false);
    if (!result.ok) {
      logger.error("Failed to create promotion", result.error, { status: result.status });
      setError("Failed to create promotion. Please try again.");
      return;
    }
    router.push("/promotions");
  };

  return (
    <div className="w-full mx-auto max-w-4xl space-y-6 pb-8">
      <h1 className="text-2xl font-bold">Add Promotion</h1>

      <ErrorBanner error={error} onDismiss={() => setError(null)} />

      <PromotionForm
        onSubmit={handleSubmit}
        submitting={submitting}
        title="New Promotion"
        description="Create a new promotion to track discounts and bonus offers."
        submitLabel="Create Promotion"
      />
    </div>
  );
}
