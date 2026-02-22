"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { BookingForm } from "@/components/bookings/booking-form";
import { Booking, BookingFormData } from "@/lib/types";

export default function EditBookingPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/bookings/${id}`);
    if (res.ok) {
      setBooking(await res.json());
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  const handleSubmit = async (data: BookingFormData) => {
    setSubmitting(true);
    const res = await fetch(`/api/bookings/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      router.push(`/bookings/${id}`);
    } else {
      setSubmitting(false);
      alert("Failed to update booking. Please check your inputs.");
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Edit Booking</h1>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Edit Booking</h1>
        <p className="text-muted-foreground">Booking not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Edit Booking</h1>
      <BookingForm
        initialData={booking}
        onSubmit={handleSubmit}
        onCancel={() => router.push(`/bookings/${id}`)}
        submitting={submitting}
        submitLabel="Save Changes"
        title="Booking Details"
      />
    </div>
  );
}
