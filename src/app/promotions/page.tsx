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
import { EmptyState } from "@/components/ui/empty-state";
import { Plus, Tag } from "lucide-react";
import { certTypeShortLabel } from "@/lib/cert-types";

interface PromotionBenefit {
  rewardType: string;
  valueType: string;
  value: string;
  certType: string | null;
}

interface Promotion {
  id: string;
  name: string;
  type: "credit_card" | "portal" | "loyalty";
  benefits: PromotionBenefit[];
  hotelChainId: string | null;
  creditCardId: string | null;
  shoppingPortalId: string | null;
  minSpend: string | null;
  startDate: string | null;
  endDate: string | null;
  isActive: boolean;
  createdAt: string;
  hotelChain: { id: string; name: string } | null;
  creditCard: { id: string; name: string } | null;
  shoppingPortal: { id: string; name: string } | null;
}

function formatBenefit(benefit: PromotionBenefit): string {
  const num = parseFloat(benefit.value);
  switch (benefit.rewardType) {
    case "cashback":
      return benefit.valueType === "percentage"
        ? `${num}% cashback`
        : `$${num.toFixed(2)} cashback`;
    case "points":
      return benefit.valueType === "multiplier" ? `${num}x points` : `${num.toLocaleString()} pts`;
    case "certificate":
      const label = benefit.certType ? certTypeShortLabel(benefit.certType) : "";
      return `${num} ${label} cert${num !== 1 ? "s" : ""}`.replace(/\s+/g, " ");
    case "eqn":
      return `${num} EQN${num !== 1 ? "s" : ""}`;
    default:
      return String(num);
  }
}

function formatBenefits(benefits: PromotionBenefit[]): string {
  if (!benefits || benefits.length === 0) return "—";
  return benefits.map(formatBenefit).join(", ");
}

function formatDateRange(startDate: string | null, endDate: string | null): string {
  if (!startDate && !endDate) return "Always";
  const start = startDate
    ? new Date(startDate).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "...";
  const end = endDate
    ? new Date(endDate).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "...";
  return `${start} - ${end}`;
}

function getLinkedName(promo: Promotion): string {
  if (promo.hotelChain) return promo.hotelChain.name;
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

  const handleDelete = async (id: string) => {
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
    activeTab === "all" ? promotions : promotions.filter((p) => p.type === activeTab);

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
            <p className="text-muted-foreground py-8 text-center text-sm">Loading promotions...</p>
          ) : filteredPromotions.length === 0 ? (
            <EmptyState
              icon={Tag}
              title="No promotions found"
              description={
                activeTab === "all"
                  ? "Track extra savings and rewards by adding your first promotion."
                  : `No ${typeLabel(activeTab).toLowerCase()} promotions found.`
              }
              action={
                activeTab === "all"
                  ? {
                      label: "Add Promotion",
                      href: "/promotions/new",
                    }
                  : undefined
              }
              data-testid="promotions-empty"
            />
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
                      <Badge variant={typeBadgeVariant(promo.type)}>{typeLabel(promo.type)}</Badge>
                    </TableCell>
                    <TableCell>{formatBenefits(promo.benefits)}</TableCell>
                    <TableCell>{getLinkedName(promo)}</TableCell>
                    <TableCell>{formatDateRange(promo.startDate, promo.endDate)}</TableCell>
                    <TableCell>
                      <Badge variant={promo.isActive ? "default" : "secondary"}>
                        {promo.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/promotions/${promo.id}/edit`}>Edit</Link>
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
