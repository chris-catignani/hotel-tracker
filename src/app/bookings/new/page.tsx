"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BookingForm } from "@/components/bookings/booking-form";
import { BookingFormData } from "@/lib/types";
import { ErrorBanner } from "@/components/ui/error-banner";
import { apiFetch } from "@/lib/api-fetch";
import { logger } from "@/lib/logger";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye } from "lucide-react";

export default function NewBookingPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [priceWatchEnabled, setPriceWatchEnabled] = useState(false);
  const [cashThreshold, setCashThreshold] = useState("");
  const [awardThreshold, setAwardThreshold] = useState("");
  const [formCurrency, setFormCurrency] = useState("USD");
  const [formAccommodationType, setFormAccommodationType] = useState("hotel");

  const handleSubmit = async (data: BookingFormData) => {
    setError(null);
    setSubmitting(true);

    const result = await apiFetch<{ id: string; propertyId: string }>("/api/bookings", {
      method: "POST",
      body: data,
    });

    if (!result.ok) {
      setSubmitting(false);
      logger.error("Failed to create booking", result.error, { status: result.status });
      setError("Failed to create booking. Please try again.");
      return;
    }

    const booking = result.data;

    if (priceWatchEnabled) {
      const watchResult = await apiFetch("/api/price-watches", {
        method: "POST",
        body: {
          propertyId: booking.propertyId,
          isEnabled: true,
          bookingId: booking.id,
          cashThreshold: cashThreshold ? Number(cashThreshold) : null,
          awardThreshold: awardThreshold ? Number(awardThreshold) : null,
        },
      });
      if (!watchResult.ok) {
        // Price watch failure is non-fatal; booking already created
        logger.error("Failed to create price watch", watchResult.error, {
          bookingId: booking.id,
          propertyId: booking.propertyId,
          status: watchResult.status,
        });
      }
    }

    router.push(`/bookings/${booking.id}`);
  };

  return (
    <div className="w-full mx-auto max-w-4xl space-y-6 pb-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Add Booking</h1>
      </div>

      <ErrorBanner error={error} onDismiss={() => setError(null)} />

      <BookingForm
        onSubmit={handleSubmit}
        onCancel={() => router.push("/bookings")}
        onCurrencyChange={setFormCurrency}
        onAccommodationTypeChange={setFormAccommodationType}
        submitting={submitting}
        submitLabel="Create Booking"
        title="Booking Details"
      />

      {formAccommodationType === "hotel" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Eye className="h-4 w-4" />
              Price Watch
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Monitor prices for this stay</p>
                <p className="text-xs text-muted-foreground">
                  Get alerted when cash or award prices drop below your thresholds.
                </p>
              </div>
              <Switch
                checked={priceWatchEnabled}
                onCheckedChange={setPriceWatchEnabled}
                data-testid="new-booking-price-watch-toggle"
              />
            </div>

            {priceWatchEnabled && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Cash alert below ({formCurrency})</Label>
                  <Input
                    type="number"
                    placeholder="e.g. 300"
                    value={cashThreshold}
                    onChange={(e) => setCashThreshold(e.target.value)}
                    className="h-8 text-sm"
                    data-testid="new-booking-cash-threshold"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Award alert below (pts)</Label>
                  <Input
                    type="number"
                    placeholder="e.g. 25000"
                    value={awardThreshold}
                    onChange={(e) => setAwardThreshold(e.target.value)}
                    className="h-8 text-sm"
                    data-testid="new-booking-award-threshold"
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
