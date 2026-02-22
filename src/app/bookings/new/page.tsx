"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BookingForm } from "@/components/bookings/booking-form";
import { BookingFormData } from "@/lib/types";
import { ErrorBanner } from "@/components/ui/error-banner";
import { extractApiError } from "@/lib/client-error";

export default function NewBookingPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (data: BookingFormData) => {
    setError(null);
    setSubmitting(true);
    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      router.push("/bookings");
    } else {
      setSubmitting(false);
      setError(await extractApiError(res, "Failed to create booking."));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">New Booking</h1>
      </div>

      <ErrorBanner error={error} onDismiss={() => setError(null)} />

      <BookingForm
        onSubmit={handleSubmit}
        onCancel={() => router.push("/bookings")}
        submitting={submitting}
        submitLabel="Create Booking"
        title="Booking Details"
      />
    </div>
  );
}
