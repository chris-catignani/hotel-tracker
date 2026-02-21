"use client";

import { useState } from "react";
import { InfoIcon, ChevronDown, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from "@/components/ui/popover";
import { NetCostBreakdown, CalculationDetail } from "@/lib/net-cost";

interface CostBreakdownProps {
  breakdown: NetCostBreakdown;
}

function formatDollars(amount: number) {
  return `$${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function CalculationInfo({ calc }: { calc: CalculationDetail | undefined }) {
  if (!calc) return null;
  
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground hover:text-foreground transition-colors cursor-help">
          <InfoIcon className="h-3 w-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="space-y-3">
          <div>
            <h4 className="font-semibold text-sm mb-1">{calc.label}</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {calc.description}
            </p>
          </div>
          <div className="rounded-md bg-muted p-2 font-mono text-[10px] break-all">
            {calc.formula}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function CostBreakdown({ breakdown }: CostBreakdownProps) {
  const [isPromosExpanded, setIsPromosExpanded] = useState(false);

  const {
    totalCost,
    pointsRedeemedValue,
    pointsRedeemedCalc,
    certsValue,
    certsCalc,
    promotions,
    promoSavings,
    portalCashback,
    portalCashbackCalc,
    cardReward,
    cardRewardCalc,
    loyaltyPointsValue,
    loyaltyPointsCalc,
    netCost,
  } = breakdown;

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
            <div className="flex items-center gap-1.5">
              <span>Award Points (value)</span>
              <CalculationInfo calc={pointsRedeemedCalc} />
            </div>
            <span>+{formatDollars(pointsRedeemedValue)}</span>
          </div>
        )}
        
        {certsValue > 0 && (
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-1.5">
              <span>Certificates (value)</span>
              <CalculationInfo calc={certsCalc} />
            </div>
            <span>+{formatDollars(certsValue)}</span>
          </div>
        )}

        {portalCashback > 0 && (
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-1.5">
              <span>Portal Cashback</span>
              <CalculationInfo calc={portalCashbackCalc} />
            </div>
            <span className="text-green-600">-{formatDollars(portalCashback)}</span>
          </div>
        )}

        {cardReward > 0 && (
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-1.5">
              <span>Card Reward</span>
              <CalculationInfo calc={cardRewardCalc} />
            </div>
            <span className="text-green-600">-{formatDollars(cardReward)}</span>
          </div>
        )}

        {loyaltyPointsValue > 0 && (
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-1.5">
              <span>Loyalty Points Value</span>
              <CalculationInfo calc={loyaltyPointsCalc} />
            </div>
            <span className="text-green-600">-{formatDollars(loyaltyPointsValue)}</span>
          </div>
        )}

        {promotions.length > 0 && (
          <div className="space-y-2">
            <button 
              className="flex w-full items-center justify-between text-sm hover:bg-muted/50 py-0.5 rounded transition-colors group"
              onClick={() => setIsPromosExpanded(!isPromosExpanded)}
            >
              <div className="flex items-center gap-1.5">
                <span>Promotion Savings</span>
                {isPromosExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </div>
              <span className="text-green-600">-{formatDollars(promoSavings)}</span>
            </button>
            
            {isPromosExpanded && (
              <div className="ml-5 space-y-2 border-l pl-3 py-1">
                {promotions.map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="text-muted-foreground">{p.name}</span>
                      <CalculationInfo calc={p} />
                    </div>
                    <span className="text-green-600">-{formatDollars(p.appliedValue)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <Separator />
        <div className="flex items-center justify-between font-bold">
          <span>Net Cost</span>
          <span>{formatDollars(netCost)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
