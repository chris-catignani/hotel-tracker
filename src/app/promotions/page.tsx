"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { logger } from "@/lib/logger";
import { PageSpinner } from "@/components/ui/page-spinner";
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
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
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
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

type StatusFilter = "all" | "ongoing" | "expired" | "upcoming";

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
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ongoing");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [promoToDelete, setPromoToDelete] = useState<string | null>(null);

  const handleDeleteClick = (id: string) => {
    setPromoToDelete(id);
    setDeleteOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!promoToDelete) return;
    setDeleteOpen(false);
    const result = await apiFetch(`/api/promotions/${promoToDelete}`, { method: "DELETE" });
    if (!result.ok) {
      logger.error("Failed to delete promotion", result.error, {
        promotionId: promoToDelete,
        status: result.status,
      });
      toast.error("Failed to delete promotion. Please try again.");
      return;
    }
    setPromoToDelete(null);
    refetchPromotions();
  };

  const today = new Date().toLocaleDateString("en-CA");

  const typeFilteredPromotions =
    activeTab === "all" ? promotions : promotions.filter((p) => p.type === activeTab);

  const filteredPromotions =
    statusFilter === "all"
      ? typeFilteredPromotions
      : typeFilteredPromotions.filter((p) => {
          if (p.endDate && p.endDate < today) return statusFilter === "expired";
          if (p.startDate && p.startDate > today) return statusFilter === "upcoming";
          return statusFilter === "ongoing";
        });

  return (
    <div className="flex flex-col flex-1 min-h-0 space-y-6">
      {/* Mobile layout — hidden on sm+ */}
      <div className="sm:hidden space-y-2 shrink-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold">Promotions</h1>
            <p className="text-muted-foreground">
              Track loyalty, credit card, and portal promotions.
            </p>
          </div>
          <Button asChild>
            <Link href="/promotions/new">
              <Plus className="size-4" />
              Add Promotion
            </Link>
          </Button>
        </div>
        <div className="flex gap-2">
          <Select
            value={statusFilter}
            onValueChange={(val) => setStatusFilter(val as StatusFilter)}
          >
            <SelectTrigger
              className="flex-1"
              data-testid="status-filter-select"
              aria-label="Filter by status"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="upcoming">Upcoming</SelectItem>
              <SelectItem value="ongoing">Ongoing</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
            </SelectContent>
          </Select>
          <Select value={activeTab} onValueChange={setActiveTab}>
            <SelectTrigger
              className="flex-1"
              data-testid="type-filter-select"
              aria-label="Filter by promotion type"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="credit_card">Credit Card</SelectItem>
              <SelectItem value="portal">Portal</SelectItem>
              <SelectItem value="loyalty">Loyalty</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Desktop layout — hidden below sm */}
      <div className="hidden sm:flex flex-wrap items-start justify-between shrink-0 gap-2">
        <div>
          <h1 className="text-2xl font-bold">Promotions</h1>
          <p className="text-muted-foreground">
            Track loyalty, credit card, and portal promotions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="flex shrink-0 rounded-lg border p-0.5 gap-0.5"
            data-testid="status-filter"
          >
            {(["all", "upcoming", "ongoing", "expired"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  "px-3 py-1.5 text-sm rounded-md transition-colors",
                  statusFilter === s
                    ? "bg-background shadow-sm font-medium"
                    : "text-muted-foreground hover:text-foreground"
                )}
                data-testid={`status-filter-${s}`}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
          <Button asChild>
            <Link href="/promotions/new">
              <Plus className="size-4" />
              Add Promotion
            </Link>
          </Button>
        </div>
      </div>

      <ErrorBanner
        error={fetchError ? "Failed to load promotions. Please try again." : null}
        onDismiss={clearError}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Promotion?"
        description="Are you sure you want to delete this promotion? This cannot be undone."
        onConfirm={handleDeleteConfirm}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 min-h-0">
        <TabsList className="hidden sm:flex shrink-0">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="credit_card">Credit Card</TabsTrigger>
          <TabsTrigger value="portal">Portal</TabsTrigger>
          <TabsTrigger value="loyalty">Loyalty</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="min-h-0 flex flex-col">
          {loading ? (
            <PageSpinner />
          ) : filteredPromotions.length === 0 ? (
            <EmptyState
              icon={Tag}
              title="No promotions found"
              description={
                activeTab === "all" && statusFilter === "all"
                  ? "Track extra savings and rewards by adding your first promotion."
                  : `No ${statusFilter !== "all" ? statusFilter + " " : ""}${activeTab !== "all" ? typeLabel(activeTab).toLowerCase() + " " : ""}promotions found.`
              }
              action={
                activeTab === "all" && statusFilter === "all"
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
                  <PromotionCard key={promo.id} promotion={promo} onDelete={handleDeleteClick} />
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
                        <TableCell className="font-medium">
                          <Link href={`/promotions/${promo.id}`} className="hover:underline">
                            {promo.name}
                          </Link>
                        </TableCell>
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
                              <Link href={`/promotions/${promo.id}`}>View</Link>
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDeleteClick(promo.id)}
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
