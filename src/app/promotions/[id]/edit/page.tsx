"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface HotelChainSubBrand {
  id: number;
  name: string;
}

interface HotelChain {
  id: number;
  name: string;
  hotelChainSubBrands: HotelChainSubBrand[];
}

interface CreditCard {
  id: number;
  name: string;
}

interface ShoppingPortal {
  id: number;
  name: string;
}

interface Promotion {
  id: number;
  name: string;
  type: "credit_card" | "portal" | "loyalty";
  valueType: "fixed" | "percentage" | "points_multiplier";
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
  const [name, setName] = useState("");
  const [type, setType] = useState<string>("loyalty");
  const [valueType, setValueType] = useState<string>("fixed");
  const [value, setValue] = useState("");
  const [hotelChainId, setHotelChainId] = useState<string>("");
  const [hotelChainSubBrandId, setHotelChainSubBrandId] = useState<string>("");
  const [creditCardId, setCreditCardId] = useState<string>("");
  const [shoppingPortalId, setShoppingPortalId] = useState<string>("");
  const [minSpend, setMinSpend] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [hotelChains, setHotelChains] = useState<HotelChain[]>([]);
  const [creditCards, setCreditCards] = useState<CreditCard[]>([]);
  const [portals, setPortals] = useState<ShoppingPortal[]>([]);

  useEffect(() => {
    fetch("/api/hotel-chains")
      .then((res) => res.json())
      .then(setHotelChains)
      .catch(console.error);
    fetch("/api/credit-cards")
      .then((res) => res.json())
      .then(setCreditCards)
      .catch(console.error);
    fetch("/api/portals")
      .then((res) => res.json())
      .then(setPortals)
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!id) return;

    fetch(`/api/promotions/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch promotion");
        return res.json();
      })
      .then((promo: Promotion) => {
        setName(promo.name);
        setType(promo.type);
        setValueType(promo.valueType);
        setValue(String(parseFloat(promo.value)));
        setHotelChainId(promo.hotelChainId ? String(promo.hotelChainId) : "");
        setHotelChainSubBrandId(
          promo.hotelChainSubBrandId ? String(promo.hotelChainSubBrandId) : ""
        );
        setCreditCardId(promo.creditCardId ? String(promo.creditCardId) : "");
        setShoppingPortalId(promo.shoppingPortalId ? String(promo.shoppingPortalId) : "");
        setMinSpend(promo.minSpend ? String(parseFloat(promo.minSpend)) : "");
        setStartDate(toDateInputValue(promo.startDate));
        setEndDate(toDateInputValue(promo.endDate));
        setIsActive(promo.isActive);
        setLoading(false);
      })
      .catch((error) => {
        console.error("Failed to fetch promotion:", error);
        setLoading(false);
      });
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const body: Record<string, unknown> = {
      name,
      type,
      valueType,
      value: parseFloat(value),
      isActive,
    };

    if (type === "loyalty" && hotelChainId) {
      body.hotelChainId = parseInt(hotelChainId);
      body.hotelChainSubBrandId = hotelChainSubBrandId ? parseInt(hotelChainSubBrandId) : null;
    } else {
      body.hotelChainId = null;
      body.hotelChainSubBrandId = null;
    }

    if (type === "credit_card" && creditCardId) {
      body.creditCardId = parseInt(creditCardId);
    } else {
      body.creditCardId = null;
    }

    if (type === "portal" && shoppingPortalId) {
      body.shoppingPortalId = parseInt(shoppingPortalId);
    } else {
      body.shoppingPortalId = null;
    }

    if (minSpend) {
      body.minSpend = parseFloat(minSpend);
    } else {
      body.minSpend = null;
    }

    body.startDate = startDate || null;
    body.endDate = endDate || null;

    try {
      const res = await fetch(`/api/promotions/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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

      <Card>
        <CardHeader>
          <CardTitle>Edit Promotion</CardTitle>
          <CardDescription>Update the details of this promotion.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Summer 20% Off"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select type..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="credit_card">Credit Card</SelectItem>
                    <SelectItem value="portal">Portal</SelectItem>
                    <SelectItem value="loyalty">Loyalty</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Value Type</Label>
                <Select value={valueType} onValueChange={setValueType}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select value type..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">Fixed ($)</SelectItem>
                    <SelectItem value="percentage">Percentage (%)</SelectItem>
                    <SelectItem value="points_multiplier">Points Multiplier (x)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="value">Value</Label>
              <Input
                id="value"
                type="number"
                step="any"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={
                  valueType === "fixed"
                    ? "e.g. 50"
                    : valueType === "percentage"
                      ? "e.g. 10"
                      : "e.g. 2"
                }
                required
              />
            </div>

            {type === "loyalty" && (
              <div className="space-y-2">
                <Label>Hotel Chain</Label>
                <Select
                  value={hotelChainId}
                  onValueChange={(v) => {
                    setHotelChainId(v);
                    setHotelChainSubBrandId("");
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select hotel chain..." />
                  </SelectTrigger>
                  <SelectContent>
                    {hotelChains.map((chain) => (
                      <SelectItem key={chain.id} value={String(chain.id)}>
                        {chain.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {type === "loyalty" &&
              hotelChainId &&
              (hotelChains.find((h) => h.id === Number(hotelChainId))?.hotelChainSubBrands.length ??
                0) > 0 && (
                <div className="space-y-2">
                  <Label>Sub-brand</Label>
                  <Select
                    value={hotelChainSubBrandId || "all"}
                    onValueChange={(v) => setHotelChainSubBrandId(v === "all" ? "" : v)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select sub-brand..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All sub-brands (no filter)</SelectItem>
                      {hotelChains
                        .find((h) => h.id === Number(hotelChainId))
                        ?.hotelChainSubBrands.map((sb) => (
                          <SelectItem key={sb.id} value={String(sb.id)}>
                            {sb.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

            {type === "credit_card" && (
              <div className="space-y-2">
                <Label>Credit Card</Label>
                <Select value={creditCardId} onValueChange={setCreditCardId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select credit card..." />
                  </SelectTrigger>
                  <SelectContent>
                    {creditCards.map((card) => (
                      <SelectItem key={card.id} value={String(card.id)}>
                        {card.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {type === "portal" && (
              <div className="space-y-2">
                <Label>Shopping Portal</Label>
                <Select value={shoppingPortalId} onValueChange={setShoppingPortalId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select portal..." />
                  </SelectTrigger>
                  <SelectContent>
                    {portals.map((portal) => (
                      <SelectItem key={portal.id} value={String(portal.id)}>
                        {portal.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="minSpend">Minimum Spend</Label>
              <Input
                id="minSpend"
                type="number"
                step="0.01"
                value={minSpend}
                onChange={(e) => setMinSpend(e.target.value)}
                placeholder="Optional"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                id="isActive"
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="size-4 rounded border-gray-300"
              />
              <Label htmlFor="isActive">Active</Label>
            </div>

            <div className="flex items-center gap-3">
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving..." : "Save Changes"}
              </Button>
              <Button variant="outline" asChild>
                <Link href="/promotions">Cancel</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
