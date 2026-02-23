"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PromotionForm } from "@/components/promotions/promotion-form";
import { PromotionFormData } from "@/lib/types";

export default function NewPromotionPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (data: PromotionFormData) => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/promotions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        router.push("/promotions");
      } else {
        console.error("Failed to create promotion");
        setSubmitting(false);
      }
    } catch (error) {
      console.error("Failed to create promotion:", error);
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Add Promotion</h1>
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
