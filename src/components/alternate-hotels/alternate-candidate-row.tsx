"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye } from "lucide-react";

export interface AlternateCandidateRowProps {
  propertyId: string;
  name: string;
  distanceMiles: number | null;
  chainCategories: string[];
  onWatchClick: () => void;
  watchDisabled?: boolean;
  watchDisabledReason?: string;
}

export function AlternateCandidateRow(props: AlternateCandidateRowProps) {
  const distanceLabel =
    props.distanceMiles === null ? "Same country" : `${props.distanceMiles.toFixed(1)} mi away`;
  return (
    <div
      className="flex items-center justify-between gap-3 py-2 border-b last:border-b-0"
      data-testid="alternate-candidate-row"
    >
      <div className="min-w-0">
        <p className="font-medium text-sm truncate">{props.name}</p>
        <p className="text-xs text-muted-foreground">{distanceLabel}</p>
        {props.chainCategories.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {props.chainCategories.map((c) => (
              <Badge key={c} variant="outline" className="text-xs">
                {c}
              </Badge>
            ))}
          </div>
        )}
      </div>
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
    </div>
  );
}
