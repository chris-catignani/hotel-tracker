import * as React from "react";

import { cn } from "@/lib/utils";

function Textarea({
  className,
  error,
  ...props
}: React.ComponentProps<"textarea"> & { error?: string }) {
  return (
    <div className="w-full space-y-1">
      <textarea
        data-slot="textarea"
        aria-invalid={!!error || props["aria-invalid"]}
        className={cn(
          "placeholder:text-muted-foreground dark:bg-input/30 border-input flex min-h-[80px] w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
          "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
          className
        )}
        {...props}
      />
      {error && <p className="text-xs font-medium text-destructive">{error}</p>}
    </div>
  );
}

export { Textarea };
