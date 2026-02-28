"use client";

import { useState } from "react";
import { InfoIcon, ChevronDown, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { NetCostBreakdown, CalculationDetail } from "@/lib/net-cost";
import { formatCurrency } from "@/lib/utils";

interface CostBreakdownProps {
  breakdown: NetCostBreakdown;
}

function CalculationInfo({ calc }: { calc: CalculationDetail | undefined }) {
  if (!calc) return null;

  const content = (
    <div className="space-y-6">
      <div>
        <h4 className="font-semibold text-sm mb-1 hidden md:block">{calc.label}</h4>
        {calc.description && (
          <p className="text-xs text-muted-foreground leading-relaxed">{calc.description}</p>
        )}
      </div>

      <div className="space-y-6">
        {calc.groups.map((group, groupIdx) => (
          <div key={group.name || groupIdx} className="space-y-3">
            {(group.name || group.description) && (
              <div className="space-y-1">
                {group.name && (
                  <h5 className="text-[10px] font-bold text-foreground uppercase tracking-tight bg-muted/40 px-1.5 py-0.5 rounded w-fit">
                    {group.name}
                  </h5>
                )}
                {group.description && (
                  <p className="text-[11px] text-muted-foreground leading-relaxed pl-0.5">
                    {group.description}
                  </p>
                )}
              </div>
            )}

            <div className="space-y-3 pl-2 border-l-2 border-muted/50 ml-1">
              {group.segments.map((segment) => (
                <div key={segment.label} className="space-y-1.5">
                  <div className="flex justify-between items-start gap-4">
                    <span className="text-xs font-semibold">{segment.label}</span>
                    <span className="text-xs font-mono font-bold whitespace-nowrap text-foreground/80">
                      {formatCurrency(segment.value)}
                    </span>
                  </div>
                  {segment.description && (
                    <p className="text-[11px] text-muted-foreground leading-relaxed pl-0.5 italic">
                      {segment.description}
                    </p>
                  )}
                  {segment.formula && (
                    <div className="rounded bg-muted/30 px-1.5 py-1 font-mono text-[9px] text-muted-foreground border border-muted-foreground/5">
                      {segment.formula}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="border-t pt-2 flex justify-between items-center bg-muted/30 px-2 py-1.5 rounded">
          <span className="text-[10px] font-bold uppercase">Total {calc.label}</span>
          <span className="text-xs font-bold font-mono">{formatCurrency(calc.appliedValue)}</span>
        </div>
      </div>
    </div>
  );

  const testId = `calc-info-${calc.label.toLowerCase().replace(/\s+/g, "-")}`;

  return (
    <>
      {/* Desktop: Popover */}
      <div className="hidden md:block">
        <Popover>
          <PopoverTrigger asChild>
            <button
              data-testid={`${testId}-desktop`}
              className="inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground hover:text-foreground transition-colors cursor-help"
            >
              <InfoIcon className="h-3 w-3" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-96 max-h-[80vh] overflow-y-auto">{content}</PopoverContent>
        </Popover>
      </div>

      {/* Mobile: Bottom Sheet */}
      <div className="md:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <button
              data-testid={`${testId}-mobile`}
              className="inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground hover:text-foreground transition-colors cursor-help"
            >
              <InfoIcon className="h-3 w-3" />
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-xl p-6 max-h-[90vh] overflow-y-auto">
            <SheetHeader className="text-left border-b pb-3 mb-4">
              <SheetTitle>{calc.label}</SheetTitle>
            </SheetHeader>
            {content}
          </SheetContent>
        </Sheet>
      </div>
    </>
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
          <span data-testid="breakdown-cash-cost">{formatCurrency(totalCost)}</span>
        </div>

        {pointsRedeemedValue > 0 && (
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-1.5">
              <span>Award Points (value)</span>
              <CalculationInfo calc={pointsRedeemedCalc} />
            </div>
            <span data-testid="breakdown-points-value">+{formatCurrency(pointsRedeemedValue)}</span>
          </div>
        )}

        {certsValue > 0 && (
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-1.5">
              <span>Certificates (value)</span>
              <CalculationInfo calc={certsCalc} />
            </div>
            <span data-testid="breakdown-certs-value">+{formatCurrency(certsValue)}</span>
          </div>
        )}

        {portalCashback > 0 && (
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-1.5">
              <span>Portal Cashback</span>
              <CalculationInfo calc={portalCashbackCalc} />
            </div>
            <span data-testid="breakdown-portal-cashback" className="text-green-600">
              -{formatCurrency(portalCashback)}
            </span>
          </div>
        )}

        {cardReward > 0 && (
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-1.5">
              <span>Card Reward</span>
              <CalculationInfo calc={cardRewardCalc} />
            </div>
            <span data-testid="breakdown-card-reward" className="text-green-600">
              -{formatCurrency(cardReward)}
            </span>
          </div>
        )}

        {loyaltyPointsValue > 0 && (
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-1.5">
              <span>Loyalty Points Value</span>
              <CalculationInfo calc={loyaltyPointsCalc} />
            </div>
            <span data-testid="breakdown-loyalty-value" className="text-green-600">
              -{formatCurrency(loyaltyPointsValue)}
            </span>
          </div>
        )}

        {promotions.length > 0 && (
          <div className="space-y-2">
            <button
              className="flex w-full items-center justify-between text-sm hover:bg-muted/50 py-0.5 rounded transition-colors group"
              onClick={() => setIsPromosExpanded(!isPromosExpanded)}
              data-testid="breakdown-promos-toggle"
            >
              <div className="flex items-center gap-1.5">
                <span>Promotion Savings</span>
                {isPromosExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </div>
              <span data-testid="breakdown-promo-savings" className="text-green-600">
                -{formatCurrency(promoSavings)}
              </span>
            </button>

            {isPromosExpanded && (
              <div
                className="ml-5 space-y-2 border-l pl-3 py-1"
                data-testid="breakdown-promos-list"
              >
                {promotions.map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="text-muted-foreground">{p.name}</span>
                      <CalculationInfo calc={p} />
                    </div>
                    <span data-testid={`breakdown-promo-item-${p.id}`} className="text-green-600">
                      -{formatCurrency(p.appliedValue)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <Separator />
        <div className="flex items-center justify-between font-bold">
          <span>Net Cost</span>
          <span data-testid="breakdown-net-cost">{formatCurrency(netCost)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
