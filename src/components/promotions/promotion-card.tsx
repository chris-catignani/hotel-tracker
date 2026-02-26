"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarDays, Tag, Link2 } from "lucide-react";
import { Promotion } from "@/lib/types";
import {
  formatBenefits,
  formatDateRange,
  getLinkedName,
  typeBadgeVariant,
  typeLabel,
} from "@/lib/promotion-utils";

interface PromotionCardProps {
  promotion: Promotion;
  onDelete?: (id: string) => void;
}

export function PromotionCard({ promotion, onDelete }: PromotionCardProps) {
  return (
    <Card className="overflow-hidden" data-testid={`promotion-card-${promotion.id}`}>
      <CardContent className="p-0">
        <div className="p-4 space-y-3">
          {/* Header: Name & Type Badge */}
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1">
              <div className="font-bold line-clamp-1 text-base" data-testid="promotion-card-name">
                {promotion.name}
              </div>
              <div className="flex gap-1.5 items-center">
                <Badge
                  variant={typeBadgeVariant(promotion.type)}
                  className="font-normal px-1.5 py-0"
                >
                  {typeLabel(promotion.type)}
                </Badge>
                <Badge
                  variant={promotion.isActive ? "default" : "secondary"}
                  className="font-normal px-1.5 py-0"
                >
                  {promotion.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
            </div>
          </div>

          {/* Details Grid (2 columns like BookingCard) */}
          <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm">
            <div className="flex items-center gap-2">
              <Link2 className="size-3.5 text-muted-foreground shrink-0" />
              <div className="leading-tight">
                <span className="text-[10px] text-muted-foreground block uppercase font-semibold">
                  Linked To
                </span>
                <span className="font-medium line-clamp-1">{getLinkedName(promotion)}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <CalendarDays className="size-3.5 text-muted-foreground shrink-0" />
              <div className="leading-tight">
                <span className="text-[10px] text-muted-foreground block uppercase font-semibold">
                  Dates
                </span>
                <span className="font-medium line-clamp-1 whitespace-nowrap">
                  {formatDateRange(promotion.startDate, promotion.endDate)}
                </span>
              </div>
            </div>
          </div>

          {/* Benefits Section (Full width because it can be long) */}
          <div className="flex items-start gap-2 pt-1 border-t mt-2">
            <Tag className="size-3.5 text-muted-foreground shrink-0 mt-1" />
            <div className="leading-tight">
              <span className="text-[10px] text-muted-foreground block uppercase font-semibold">
                Benefits
              </span>
              <span
                className="font-medium text-xs text-primary"
                data-testid="promotion-card-benefits"
              >
                {formatBenefits(promotion.benefits, promotion.tiers)}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-2 flex gap-2">
            <Button variant="outline" size="sm" className="flex-1" asChild>
              <Link href={`/promotions/${promotion.id}/edit`}>Edit</Link>
            </Button>
            {onDelete && (
              <Button
                variant="destructive"
                size="sm"
                className="flex-1"
                onClick={() => onDelete(promotion.id)}
                data-testid="promotion-card-delete"
              >
                Delete
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
