"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface CostBreakdownProps {
  totalCost: number;
  promotionSavings: number;
  portalCashback: number;
  cardReward: number;
  netCost: number;
}

function formatDollars(amount: number) {
  return `$${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function CostBreakdown({
  totalCost,
  promotionSavings,
  portalCashback,
  cardReward,
  netCost,
}: CostBreakdownProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Cost Breakdown</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span>Total Cost</span>
          <span>{formatDollars(totalCost)}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span>Promotion Savings</span>
          <span className="text-green-600">-{formatDollars(promotionSavings)}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span>Portal Cashback</span>
          <span className="text-green-600">-{formatDollars(portalCashback)}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span>Card Reward</span>
          <span className="text-green-600">-{formatDollars(cardReward)}</span>
        </div>
        <Separator />
        <div className="flex items-center justify-between font-bold">
          <span>Net Cost</span>
          <span>{formatDollars(netCost)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
