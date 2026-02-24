"use client";

import { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  className?: string;
  "data-testid"?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  "data-testid": testId,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-12 px-4 text-center border-2 border-dashed rounded-lg bg-muted/30",
        className
      )}
      data-testid={testId || "empty-state"}
    >
      <div className="bg-muted p-4 rounded-full mb-4">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground max-w-xs mb-6 text-sm">{description}</p>
      {action && (
        <>
          {action.href ? (
            <Button asChild variant="outline" data-testid={`${testId || "empty-state"}-action`}>
              <Link href={action.href}>{action.label}</Link>
            </Button>
          ) : (
            <Button
              onClick={action.onClick}
              variant="outline"
              data-testid={`${testId || "empty-state"}-action`}
            >
              {action.label}
            </Button>
          )}
        </>
      )}
    </div>
  );
}
