"use client";

import { AlertCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorBannerProps {
  error: string | null;
  onDismiss: () => void;
}

export function ErrorBanner({ error, onDismiss }: ErrorBannerProps) {
  if (!error) return null;

  return (
    <div
      data-testid="error-banner"
      className="rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 shrink-0 text-red-500" />
        <div className="flex-1">
          <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed">{error}</pre>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="-mr-2 -mt-2 h-8 w-8 text-red-500 hover:bg-red-100 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-900 dark:hover:text-red-200"
          onClick={onDismiss}
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Dismiss</span>
        </Button>
      </div>
    </div>
  );
}
