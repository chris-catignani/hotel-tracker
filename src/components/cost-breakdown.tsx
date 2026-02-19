"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface CostBreakdownProps {
  totalCost: number;
  pointsRedeemedValue: number;
  certsValue: number;
  promotionSavings: number;
  portalCashback: number;
  cardReward: number;
  loyaltyPointsValue: number;
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
  pointsRedeemedValue,
  certsValue,
  promotionSavings,
  portalCashback,
  cardReward,
  loyaltyPointsValue,
  netCost,
}: CostBreakdownProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Cost Breakdown</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span>Cash Cost</span>
          <span>{formatDollars(totalCost)}</span>
        </div>
        {pointsRedeemedValue > 0 && (
          <div className="flex items-center justify-between text-sm">
            <span>Award Points (value)</span>
            <span>+{formatDollars(pointsRedeemedValue)}</span>
          </div>
        )}
        {certsValue > 0 && (
          <div className="flex items-center justify-between text-sm">
            <span>Certificates (value)</span>
            <span>+{formatDollars(certsValue)}</span>
          </div>
        )}
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
        <div className="flex items-center justify-between text-sm">
          <span>Loyalty Points Value</span>
          <span className="text-green-600">-{formatDollars(loyaltyPointsValue)}</span>
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
