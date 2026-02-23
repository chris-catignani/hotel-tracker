"use client";

import { useEffect, useState } from "react";
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
import { DatePicker } from "@/components/ui/date-picker";
import { format, parseISO } from "date-fns";

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

export interface PromotionFormData {
  name: string;
  type: string;
  valueType: string;
  value: number;
  hotelChainId?: number | null;
  hotelChainSubBrandId?: number | null;
  creditCardId?: number | null;
  shoppingPortalId?: number | null;
  minSpend?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  isActive: boolean;
}

interface PromotionFormProps {
  initialData?: Partial<PromotionFormData>;
  onSubmit: (data: PromotionFormData) => Promise<void>;
  submitting: boolean;
  title: string;
  description: string;
  submitLabel: string;
}

export function PromotionForm({
  initialData,
  onSubmit,
  submitting,
  title,
  description,
  submitLabel,
}: PromotionFormProps) {
  const [name, setName] = useState(initialData?.name || "");
  const [type, setType] = useState<string>(initialData?.type || "loyalty");
  const [valueType, setValueType] = useState<string>(initialData?.valueType || "fixed");
  const [value, setValue] = useState(initialData?.value ? String(initialData.value) : "");
  const [hotelChainId, setHotelChainId] = useState<string>(
    initialData?.hotelChainId ? String(initialData.hotelChainId) : ""
  );
  const [hotelChainSubBrandId, setHotelChainSubBrandId] = useState<string>(
    initialData?.hotelChainSubBrandId ? String(initialData.hotelChainSubBrandId) : ""
  );
  const [creditCardId, setCreditCardId] = useState<string>(
    initialData?.creditCardId ? String(initialData.creditCardId) : ""
  );
  const [shoppingPortalId, setShoppingPortalId] = useState<string>(
    initialData?.shoppingPortalId ? String(initialData.shoppingPortalId) : ""
  );
  const [minSpend, setMinSpend] = useState(
    initialData?.minSpend ? String(initialData.minSpend) : ""
  );
  const [startDate, setStartDate] = useState(initialData?.startDate || "");
  const [endDate, setEndDate] = useState(initialData?.endDate || "");
  const [isActive, setIsActive] = useState(initialData?.isActive ?? true);

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

  // Update form if initialData changes (for Edit mode after fetch)
  useEffect(() => {
    if (initialData) {
      if (initialData.name !== undefined) setName(initialData.name);
      if (initialData.type !== undefined) setType(initialData.type);
      if (initialData.valueType !== undefined) setValueType(initialData.valueType);
      if (initialData.value !== undefined) setValue(String(initialData.value));
      if (initialData.hotelChainId !== undefined)
        setHotelChainId(initialData.hotelChainId ? String(initialData.hotelChainId) : "");
      if (initialData.hotelChainSubBrandId !== undefined)
        setHotelChainSubBrandId(
          initialData.hotelChainSubBrandId ? String(initialData.hotelChainSubBrandId) : ""
        );
      if (initialData.creditCardId !== undefined)
        setCreditCardId(initialData.creditCardId ? String(initialData.creditCardId) : "");
      if (initialData.shoppingPortalId !== undefined)
        setShoppingPortalId(initialData.shoppingPortalId ? String(initialData.shoppingPortalId) : "");
      if (initialData.minSpend !== undefined)
        setMinSpend(initialData.minSpend ? String(initialData.minSpend) : "");
      if (initialData.startDate !== undefined) setStartDate(initialData.startDate || "");
      if (initialData.endDate !== undefined) setEndDate(initialData.endDate || "");
      if (initialData.isActive !== undefined) setIsActive(initialData.isActive);
    }
  }, [initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const body: PromotionFormData = {
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

    await onSubmit(body);
  };

  const startDateObj = startDate ? parseISO(startDate) : undefined;
  const endDateObj = endDate ? parseISO(endDate) : undefined;

  const handleStartDateChange = (date?: Date) => {
    setStartDate(date ? format(date, "yyyy-MM-dd") : "");
  };

  const handleEndDateChange = (date?: Date) => {
    setEndDate(date ? format(date, "yyyy-MM-dd") : "");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
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

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <DatePicker
                id="startDate"
                date={startDateObj}
                setDate={handleStartDateChange}
                placeholder="Select start date"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <DatePicker
                id="endDate"
                date={endDateObj}
                setDate={handleEndDateChange}
                placeholder="Select end date"
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

          {/* Actions */}
          <div className="sticky bottom-0 bg-background/95 backdrop-blur-sm p-4 -mx-6 -mb-6 border-t md:static md:bg-transparent md:p-0 md:m-0 md:border-none flex gap-4 z-10">
            <Button
              type="submit"
              disabled={submitting}
              className="flex-1 md:flex-none"
              data-testid="promotion-form-submit"
            >
              {submitting ? "Saving..." : submitLabel}
            </Button>
            <Button
              type="button"
              variant="outline"
              asChild
              className="flex-1 md:flex-none"
              data-testid="promotion-form-cancel"
            >
              <Link href="/promotions">Cancel</Link>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
