"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { BookingForm } from "@/components/bookings/booking-form";
import { BookingPriceWatch } from "@/components/price-watch/booking-price-watch";
import { Booking, BookingFormData } from "@/lib/types";
import { ErrorBanner } from "@/components/ui/error-banner";
import { PageSpinner } from "@/components/ui/page-spinner";
import { useApiQuery } from "@/hooks/use-api-query";
import { apiFetch } from "@/lib/api-fetch";
import { logger } from "@/lib/logger";
import { toast } from "sonner";

export default function EditBookingPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();

  const [submitting, setSubmitting] = useState(false);
  const [formAccommodationType, setFormAccommodationType] = useState("hotel");

  const {
    data: booking,
    loading,
    error: fetchError,
    clearError,
  } = useApiQuery<Booking>(`/api/bookings/${id}`, {
    onError: (err) =>
      logger.error("Failed to fetch booking", err.error, { bookingId: id, status: err.status }),
  });

  const handleSubmit = async (data: BookingFormData) => {
    setSubmitting(true);
    const result = await apiFetch<Booking>(`/api/bookings/${id}`, {
      method: "PUT",
      body: data,
    });
    setSubmitting(false);
    if (!result.ok) {
      logger.error("Failed to update booking", result.error, {
        bookingId: id,
        status: result.status,
      });
      toast.error("Failed to save booking. Please try again.");
      return;
    }
    router.push(`/bookings/${id}`);
  };

  if (loading && !booking) {
    return <PageSpinner />;
  }

  const today = new Date().toISOString().split("T")[0];
  const isFutureBooking = booking ? booking.checkIn.slice(0, 10) > today : false;

  return (
    <div className="w-full mx-auto max-w-4xl space-y-6 pb-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Edit Booking</h1>
      </div>

      <ErrorBanner
        error={fetchError ? "Failed to load booking. Please try again." : null}
        onDismiss={clearError}
      />

      {booking ? (
        <>
          <BookingForm
            initialData={booking}
            onSubmit={handleSubmit}
            onCancel={() => router.push(`/bookings/${id}`)}
            onAccommodationTypeChange={setFormAccommodationType}
            submitting={submitting}
            submitLabel="Save Changes"
            title="Booking Details"
          />
          {formAccommodationType === "hotel" &&
            booking.hotelChainId &&
            isFutureBooking &&
            booking.propertyId && (
              <BookingPriceWatch
                bookingId={booking.id}
                propertyId={booking.propertyId}
                propertyName={booking.property?.name ?? ""}
                hotelChainId={booking.hotelChainId ?? undefined}
                checkIn={booking.checkIn}
                checkOut={booking.checkOut}
                totalCost={booking.totalCost}
                currency={booking.currency}
                pointsRedeemed={booking.pointsRedeemed}
                initialWatchBooking={booking.priceWatchBookings?.[0] ?? null}
              />
            )}
        </>
      ) : (
        <p className="text-muted-foreground">Booking not found.</p>
      )}
    </div>
  );
}
