"use client";

import { cn } from "@/lib/utils";
import { PostingStatus } from "@/lib/types";
import { statusColorClass, statusLabel } from "@/lib/posting-status-utils";

interface SingleItemCell {
  kind: "single";
  value: string;
  status: PostingStatus;
  onCycle: () => void;
  testId?: string;
}

interface MultiItemCell {
  kind: "multi";
  postedCount: number;
  total: number;
  worstStatus: PostingStatus; // "failed" > "pending" > "posted"
  isExpanded: boolean;
  onToggle: () => void;
  testId?: string;
}

interface EmptyCell {
  kind: "empty";
}

export type PostingStatusCellProps = SingleItemCell | MultiItemCell | EmptyCell;

export function PostingStatusCell(props: PostingStatusCellProps) {
  if (props.kind === "empty") {
    return <span className="text-muted-foreground">—</span>;
  }

  if (props.kind === "single") {
    return (
      <button
        onClick={props.onCycle}
        data-testid={props.testId}
        className={cn(
          "rounded px-2 py-0.5 text-xs font-medium cursor-pointer whitespace-nowrap",
          statusColorClass(props.status)
        )}
      >
        {props.value} · {statusLabel(props.status)}
      </button>
    );
  }

  // multi
  const allPosted = props.postedCount === props.total;
  const label = allPosted
    ? `✓ ${props.postedCount}/${props.total}`
    : props.worstStatus === "failed"
      ? `✗ ${props.postedCount}/${props.total}`
      : `⏳ ${props.postedCount}/${props.total}`;

  return (
    <button
      onClick={props.onToggle}
      data-testid={props.testId}
      className={cn(
        "rounded px-2 py-0.5 text-xs font-medium cursor-pointer whitespace-nowrap",
        allPosted
          ? statusColorClass("posted")
          : props.worstStatus === "failed"
            ? statusColorClass("failed")
            : statusColorClass("pending")
      )}
    >
      {label} {props.isExpanded ? "\u25B4" : "\u25BE"}
    </button>
  );
}
