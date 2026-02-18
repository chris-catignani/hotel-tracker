"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

interface Promotion {
  id: number;
  name: string;
  type: "credit_card" | "portal" | "loyalty";
  valueType: "fixed" | "percentage" | "points_multiplier";
  value: string;
  hotelId: number | null;
  creditCardId: number | null;
  shoppingPortalId: number | null;
  minSpend: string | null;
  startDate: string | null;
  endDate: string | null;
  isActive: boolean;
  createdAt: string;
  hotel: { id: number; name: string } | null;
  creditCard: { id: number; name: string } | null;
  shoppingPortal: { id: number; name: string } | null;
}

function formatValue(valueType: string, value: string): string {
  const num = parseFloat(value);
  switch (valueType) {
    case "fixed":
      return `$${num.toFixed(2)}`;
    case "percentage":
      return `${num}%`;
    case "points_multiplier":
      return `${num}x`;
    default:
      return String(num);
  }
}

function formatDateRange(startDate: string | null, endDate: string | null): string {
  if (!startDate && !endDate) return "Always";
  const start = startDate
    ? new Date(startDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "...";
  const end = endDate
    ? new Date(endDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "...";
  return `${start} - ${end}`;
}

function getLinkedName(promo: Promotion): string {
  if (promo.hotel) return promo.hotel.name;
  if (promo.creditCard) return promo.creditCard.name;
  if (promo.shoppingPortal) return promo.shoppingPortal.name;
  return "-";
}

function typeBadgeVariant(type: string): "default" | "secondary" | "outline" | "destructive" {
  switch (type) {
    case "credit_card":
      return "secondary";
    case "portal":
      return "outline";
    case "loyalty":
      return "default";
    default:
      return "secondary";
  }
}

function typeLabel(type: string): string {
  switch (type) {
    case "credit_card":
      return "Credit Card";
    case "portal":
      return "Portal";
    case "loyalty":
      return "Loyalty";
    default:
      return type;
  }
}

export default function PromotionsPage() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");

  const fetchPromotions = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/promotions");
      if (res.ok) {
        const data = await res.json();
        setPromotions(data);
      }
    } catch (error) {
      console.error("Failed to fetch promotions:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPromotions();
  }, []);

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this promotion?")) return;
    try {
      const res = await fetch(`/api/promotions/${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchPromotions();
      }
    } catch (error) {
      console.error("Failed to delete promotion:", error);
    }
  };

  const filteredPromotions =
    activeTab === "all"
      ? promotions
      : promotions.filter((p) => p.type === activeTab);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Promotions</h1>
        <Button asChild>
          <Link href="/promotions/new">
            <Plus className="size-4" />
            Add Promotion
          </Link>
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="credit_card">Credit Card</TabsTrigger>
          <TabsTrigger value="portal">Portal</TabsTrigger>
          <TabsTrigger value="loyalty">Loyalty</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab}>
          {loading ? (
            <p className="text-muted-foreground py-8 text-center text-sm">
              Loading promotions...
            </p>
          ) : filteredPromotions.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">
              No promotions found.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Linked To</TableHead>
                  <TableHead>Date Range</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPromotions.map((promo) => (
                  <TableRow key={promo.id}>
                    <TableCell className="font-medium">{promo.name}</TableCell>
                    <TableCell>
                      <Badge variant={typeBadgeVariant(promo.type)}>
                        {typeLabel(promo.type)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {formatValue(promo.valueType, promo.value)}
                    </TableCell>
                    <TableCell>{getLinkedName(promo)}</TableCell>
                    <TableCell>
                      {formatDateRange(promo.startDate, promo.endDate)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={promo.isActive ? "default" : "secondary"}
                      >
                        {promo.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/promotions/${promo.id}/edit`}>
                            Edit
                          </Link>
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(promo.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
