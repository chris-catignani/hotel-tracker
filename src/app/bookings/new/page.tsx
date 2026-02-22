"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BookingForm } from "@/components/bookings/booking-form";
import { BookingFormData } from "@/lib/types";

export default function NewBookingPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (data: BookingFormData) => {
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
      alert("Failed to create booking. Please check your inputs.");
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">New Booking</h1>
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
