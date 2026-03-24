"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { logger } from "@/lib/logger";
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
import { ErrorBanner } from "@/components/ui/error-banner";
import { Plus, Tag } from "lucide-react";
import { PromotionCard } from "@/components/promotions/promotion-card";
import { Promotion } from "@/lib/types";
import {
  formatBenefits,
  formatDateRange,
  getLinkedName,
  typeBadgeVariant,
  typeLabel,
} from "@/lib/promotion-utils";
import { useApiQuery } from "@/hooks/use-api-query";
import { apiFetch } from "@/lib/api-fetch";
import { toast } from "sonner";

export default function PromotionsPage() {
  const {
    data: promotionsData,
    loading,
    error: fetchError,
    clearError,
    refetch: refetchPromotions,
  } = useApiQuery<Promotion[]>("/api/promotions", {
    onError: (err) => logger.error("Failed to fetch promotions", err.error, { status: err.status }),
  });
  const promotions = useMemo(() => promotionsData ?? [], [promotionsData]);

  const [activeTab, setActiveTab] = useState("all");

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this promotion?")) return;
    const result = await apiFetch(`/api/promotions/${id}`, { method: "DELETE" });
    if (!result.ok) {
      logger.error("Failed to delete promotion", result.error, {
        promotionId: id,
        status: result.status,
      });
      toast.error("Failed to delete promotion. Please try again.");
      return;
    }
    refetchPromotions();
  };

  const filteredPromotions =
    activeTab === "all" ? promotions : promotions.filter((p) => p.type === activeTab);

  return (
    <div className="flex flex-col flex-1 min-h-0 space-y-6">
      <div className="flex items-center justify-between shrink-0">
        <h1 className="text-2xl font-semibold tracking-tight">Promotions</h1>
        <Button asChild>
          <Link href="/promotions/new">
            <Plus className="size-4" />
            Add Promotion
          </Link>
        </Button>
      </div>

      <ErrorBanner
        error={fetchError ? "Failed to load promotions. Please try again." : null}
        onDismiss={clearError}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 min-h-0">
        <TabsList className="shrink-0">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="credit_card">Credit Card</TabsTrigger>
          <TabsTrigger value="portal">Portal</TabsTrigger>
          <TabsTrigger value="loyalty">Loyalty</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="min-h-0 flex flex-col">
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
            <>
              {/* Mobile View: Cards */}
              <div className="flex flex-col gap-4 md:hidden" data-testid="promotions-list-mobile">
                {filteredPromotions.map((promo) => (
                  <PromotionCard key={promo.id} promotion={promo} onDelete={handleDelete} />
                ))}
              </div>

              {/* Desktop View: Table */}
              <div
                className="hidden md:flex md:flex-col md:flex-1 md:min-h-0 md:overflow-auto"
                data-testid="promotions-list-desktop"
              >
                <Table containerClassName="overflow-visible">
                  <TableHeader className="sticky top-0 bg-background z-20">
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Value</TableHead>
                      <TableHead>Linked To</TableHead>
                      <TableHead>Dates</TableHead>
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
                        <TableCell>{formatBenefits(promo.benefits, promo.tiers)}</TableCell>
                        <TableCell>{getLinkedName(promo)}</TableCell>
                        <TableCell>{formatDateRange(promo.startDate, promo.endDate)}</TableCell>
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
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
