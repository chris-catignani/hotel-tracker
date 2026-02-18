"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Hotel {
  id: number;
  name: string;
  loyaltyProgram: string | null;
  basePointRate: number | null;
  elitePointRate: number | null;
  pointValue: number | null;
}

interface CreditCard {
  id: number;
  name: string;
  rewardType: string;
  rewardRate: number;
  pointValue: number;
}

interface ShoppingPortal {
  id: number;
  name: string;
}

interface Booking {
  id: number;
  hotelId: number;
  propertyName: string;
  checkIn: string;
  checkOut: string;
  numNights: number;
  pretaxCost: string | number;
  taxAmount: string | number;
  totalCost: string | number;
  creditCardId: number | null;
  shoppingPortalId: number | null;
  portalCashbackRate: string | number | null;
  loyaltyPointsEarned: number | null;
  notes: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function diffDays(checkIn: string, checkOut: string): number {
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  const diff = end.getTime() - start.getTime();
  return Math.max(0, Math.round(diff / (1000 * 60 * 60 * 24)));
}

function toDateInputValue(dateStr: string): string {
  const date = new Date(dateStr);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// ---------------------------------------------------------------------------
// Edit Booking Page
// ---------------------------------------------------------------------------

export default function EditBookingPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();

  // Reference data
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [creditCards, setCreditCards] = useState<CreditCard[]>([]);
  const [portals, setPortals] = useState<ShoppingPortal[]>([]);

  // Form fields
  const [hotelId, setHotelId] = useState("");
  const [propertyName, setPropertyName] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [numNights, setNumNights] = useState("");
  const [pretaxCost, setPretaxCost] = useState("");
  const [taxAmount, setTaxAmount] = useState("");
  const [totalCost, setTotalCost] = useState("");
  const [creditCardId, setCreditCardId] = useState("none");
  const [shoppingPortalId, setShoppingPortalId] = useState("none");
  const [portalCashbackRate, setPortalCashbackRate] = useState("");
  const [loyaltyPointsEarned, setLoyaltyPointsEarned] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);

  // Fetch reference data and existing booking
  const fetchData = useCallback(async () => {
    setLoading(true);
    const [hotelsRes, cardsRes, portalsRes, bookingRes] = await Promise.all([
      fetch("/api/hotels"),
      fetch("/api/credit-cards"),
      fetch("/api/portals"),
      fetch(`/api/bookings/${id}`),
    ]);

    if (hotelsRes.ok) setHotels(await hotelsRes.json());
    if (cardsRes.ok) setCreditCards(await cardsRes.json());
    if (portalsRes.ok) setPortals(await portalsRes.json());

    if (bookingRes.ok) {
      const booking: Booking = await bookingRes.json();
      setHotelId(String(booking.hotelId));
      setPropertyName(booking.propertyName);
      setCheckIn(toDateInputValue(booking.checkIn));
      setCheckOut(toDateInputValue(booking.checkOut));
      setNumNights(String(booking.numNights));
      setPretaxCost(String(Number(booking.pretaxCost)));
      setTaxAmount(String(Number(booking.taxAmount)));
      setTotalCost(String(Number(booking.totalCost)));
      setCreditCardId(
        booking.creditCardId ? String(booking.creditCardId) : "none"
      );
      setShoppingPortalId(
        booking.shoppingPortalId ? String(booking.shoppingPortalId) : "none"
      );
      setPortalCashbackRate(
        booking.portalCashbackRate
          ? String(Number(booking.portalCashbackRate) * 100)
          : ""
      );
      setLoyaltyPointsEarned(
        booking.loyaltyPointsEarned != null
          ? String(booking.loyaltyPointsEarned)
          : ""
      );
      setNotes(booking.notes || "");
      setInitialized(true);
    }

    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-calculate numNights when dates change (only after initial load)
  useEffect(() => {
    if (!initialized) return;
    if (checkIn && checkOut) {
      setNumNights(String(diffDays(checkIn, checkOut)));
    }
  }, [checkIn, checkOut, initialized]);

  // Auto-calculate taxAmount when pretaxCost/totalCost change (only after initial load)
  useEffect(() => {
    if (!initialized) return;
    if (pretaxCost && totalCost) {
      const tax = Number(totalCost) - Number(pretaxCost);
      setTaxAmount(tax.toFixed(2));
    }
  }, [pretaxCost, totalCost, initialized]);

  // Auto-calculate loyalty points when hotel or pretaxCost changes (only after initial load)
  useEffect(() => {
    if (!initialized) return;
    if (hotelId && pretaxCost) {
      const hotel = hotels.find((h) => h.id === Number(hotelId));
      if (hotel?.basePointRate != null) {
        const baseRate = Number(hotel.basePointRate);
        const eliteRate = Number(hotel.elitePointRate || 0);
        const points = Math.round(Number(pretaxCost) * (baseRate + eliteRate));
        setLoyaltyPointsEarned(String(points));
      }
    }
  }, [hotelId, pretaxCost, hotels, initialized]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const body = {
      hotelId: Number(hotelId),
      propertyName,
      checkIn,
      checkOut,
      numNights: Number(numNights),
      pretaxCost: Number(pretaxCost),
      taxAmount: Number(taxAmount),
      totalCost: Number(totalCost),
      creditCardId: creditCardId === "none" ? null : Number(creditCardId),
      shoppingPortalId:
        shoppingPortalId === "none" ? null : Number(shoppingPortalId),
      portalCashbackRate:
        shoppingPortalId !== "none" && portalCashbackRate
          ? Number(portalCashbackRate) / 100
          : null,
      loyaltyPointsEarned: loyaltyPointsEarned
        ? Number(loyaltyPointsEarned)
        : null,
      notes: notes || null,
    };

    const res = await fetch(`/api/bookings/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
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

  const isValid =
    hotelId &&
    propertyName.trim() &&
    checkIn &&
    checkOut &&
    numNights &&
    pretaxCost &&
    totalCost;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Edit Booking</h1>

      <Card>
        <CardHeader>
          <CardTitle>Booking Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Hotel Chain */}
            <div className="space-y-2">
              <Label htmlFor="hotelId">Hotel Chain *</Label>
              <Select value={hotelId} onValueChange={setHotelId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select hotel chain..." />
                </SelectTrigger>
                <SelectContent>
                  {hotels.map((hotel) => (
                    <SelectItem key={hotel.id} value={String(hotel.id)}>
                      {hotel.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Property Name */}
            <div className="space-y-2">
              <Label htmlFor="propertyName">Property Name *</Label>
              <Input
                id="propertyName"
                value={propertyName}
                onChange={(e) => setPropertyName(e.target.value)}
                placeholder="e.g. Marriott Downtown Chicago"
                required
              />
            </div>

            {/* Dates */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="checkIn">Check-in Date *</Label>
                <Input
                  id="checkIn"
                  type="date"
                  value={checkIn}
                  onChange={(e) => setCheckIn(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="checkOut">Check-out Date *</Label>
                <Input
                  id="checkOut"
                  type="date"
                  value={checkOut}
                  onChange={(e) => setCheckOut(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="numNights">Number of Nights</Label>
                <Input
                  id="numNights"
                  type="number"
                  min="1"
                  value={numNights}
                  onChange={(e) => setNumNights(e.target.value)}
                />
              </div>
            </div>

            {/* Costs */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="pretaxCost">Pre-tax Cost *</Label>
                <Input
                  id="pretaxCost"
                  type="number"
                  step="0.01"
                  min="0"
                  value={pretaxCost}
                  onChange={(e) => setPretaxCost(e.target.value)}
                  placeholder="0.00"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="totalCost">Total Cost *</Label>
                <Input
                  id="totalCost"
                  type="number"
                  step="0.01"
                  min="0"
                  value={totalCost}
                  onChange={(e) => setTotalCost(e.target.value)}
                  placeholder="0.00"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="taxAmount">Tax Amount</Label>
                <Input
                  id="taxAmount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={taxAmount}
                  placeholder="0.00"
                  readOnly
                  className="bg-muted text-muted-foreground"
                />
                <p className="text-xs text-muted-foreground">Auto-calculated</p>
              </div>
            </div>

            {/* Credit Card */}
            <div className="space-y-2">
              <Label htmlFor="creditCardId">Credit Card</Label>
              <Select value={creditCardId} onValueChange={setCreditCardId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select credit card..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {creditCards.map((card) => (
                    <SelectItem key={card.id} value={String(card.id)}>
                      {card.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Shopping Portal */}
            <div className="space-y-2">
              <Label htmlFor="shoppingPortalId">Shopping Portal</Label>
              <Select value={shoppingPortalId} onValueChange={setShoppingPortalId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select portal..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {portals.map((portal) => (
                    <SelectItem key={portal.id} value={String(portal.id)}>
                      {portal.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Portal Cashback Rate - shown when portal selected */}
            {shoppingPortalId !== "none" && (
              <div className="space-y-2">
                <Label htmlFor="portalCashbackRate">Portal Cashback Rate (%)</Label>
                <Input
                  id="portalCashbackRate"
                  type="number"
                  step="0.01"
                  min="0"
                  value={portalCashbackRate}
                  onChange={(e) => setPortalCashbackRate(e.target.value)}
                  placeholder="e.g. 6.75"
                />
              </div>
            )}

            {/* Loyalty Points Earned */}
            <div className="space-y-2">
              <Label htmlFor="loyaltyPointsEarned">Loyalty Points Earned</Label>
              <Input
                id="loyaltyPointsEarned"
                type="number"
                min="0"
                value={loyaltyPointsEarned}
                onChange={(e) => setLoyaltyPointsEarned(e.target.value)}
                placeholder="0"
              />
              {hotelId && pretaxCost && hotels.find((h) => h.id === Number(hotelId))?.basePointRate != null && (
                <p className="text-xs text-muted-foreground">
                  Auto-calculated from hotel chain rates. You can override this value.
                </p>
              )}
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any additional notes..."
                rows={3}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-4">
              <Button type="submit" disabled={!isValid || submitting}>
                {submitting ? "Saving..." : "Save Changes"}
              </Button>
              <Link href={`/bookings/${id}`}>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
