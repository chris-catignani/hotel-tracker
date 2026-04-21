"use client";

import { Button } from "@/components/ui/button";
import { Eye, CheckCircle2, X } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export interface AlternateCandidateRowProps {
  propertyId: string;
  name: string;
  hotelChainName: string | null;
  distanceMiles: number | null;
  isWatched: boolean;
  priceWatchId: string | null;
  cashThreshold: number | null;
  awardThreshold: number | null;
  currency: string;
  onWatchClick: () => void;
  onUnwatchClick: () => void;
  watchDisabled?: boolean;
  watchDisabledReason?: string;
}

export function AlternateCandidateRow(props: AlternateCandidateRowProps) {
  const distanceLabel =
    props.distanceMiles !== null ? `${props.distanceMiles.toFixed(1)} mi away` : null;

  const thresholdParts: string[] = [];
  if (props.cashThreshold !== null)
    thresholdParts.push(`< ${formatCurrency(props.cashThreshold, props.currency)}`);
  if (props.awardThreshold !== null)
    thresholdParts.push(`< ${props.awardThreshold.toLocaleString()} pts`);
  const thresholdLabel = thresholdParts.length > 0 ? thresholdParts.join(" · ") : null;

  return (
    <div
      className="flex items-center justify-between gap-3 py-2 border-b last:border-b-0"
      data-testid="alternate-candidate-row"
    >
      <div className="min-w-0">
        <p className="font-medium text-sm truncate">{props.name}</p>
        <p className="text-xs text-muted-foreground">
          {props.hotelChainName && (
            <span className="mr-1">
              {props.hotelChainName}
              {distanceLabel || thresholdLabel ? " ·" : ""}
            </span>
          )}
          {distanceLabel}
          {distanceLabel && thresholdLabel && " · "}
          {thresholdLabel && <span className="text-green-700">{thresholdLabel}</span>}
        </p>
      </div>
      {props.isWatched ? (
        <div className="flex items-center gap-1 shrink-0">
          <span
            className="flex items-center text-xs text-green-700 font-medium"
            data-testid="watching-label"
          >
            <CheckCircle2 className="h-3 w-3 mr-1" /> Watching
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
            onClick={props.onUnwatchClick}
            title="Remove watch"
            data-testid="unwatch-alternate-button"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <Button
          size="sm"
          variant="outline"
          onClick={props.onWatchClick}
          disabled={props.watchDisabled}
          title={props.watchDisabledReason}
          data-testid="watch-alternate-button"
        >
          <Eye className="h-3 w-3 mr-1" /> Watch
        </Button>
      )}
    </div>
  );
}
