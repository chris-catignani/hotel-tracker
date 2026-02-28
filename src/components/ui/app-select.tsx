"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export interface AppSelectOption {
  label: string;
  value: string;
}

type AppSelectProps = React.ComponentPropsWithoutRef<typeof Button> & {
  options: AppSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  className?: string;
  error?: string;
} & (
    | {
        multiple?: false;
        value: string;
        onValueChange: (value: string) => void;
      }
    | {
        multiple: true;
        value: string[];
        onValueChange: (value: string[]) => void;
      }
  );

export function AppSelect({
  value,
  onValueChange,
  options,
  multiple = false,
  placeholder = "Select item...",
  searchPlaceholder = "Search...",
  emptyMessage = "No item found.",
  className,
  disabled,
  error,
  ...props
}: AppSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");

  // Sort options alphabetically, ignoring case, but keep special options at top
  const sortedOptions = React.useMemo(() => {
    const specialValues = ["none", "", "all"];
    const specialOptions = options.filter((opt) => specialValues.includes(opt.value));
    const regularOptions = options.filter((opt) => !specialValues.includes(opt.value));

    regularOptions.sort((a, b) =>
      a.label.localeCompare(b.label, undefined, { sensitivity: "base" })
    );

    return [...specialOptions, ...regularOptions];
  }, [options]);

  const filteredOptions = React.useMemo(() => {
    if (!searchQuery) return sortedOptions;
    const lowerQuery = searchQuery.toLowerCase();
    return sortedOptions.filter((opt) => opt.label.toLowerCase().includes(lowerQuery));
  }, [sortedOptions, searchQuery]);

  const selectedOptions = React.useMemo(() => {
    if (multiple && Array.isArray(value)) {
      return options.filter((opt) => value.includes(opt.value));
    }
    if (!multiple && typeof value === "string") {
      const found = options.find((opt) => opt.value === value);
      return found ? [found] : [];
    }
    return [];
  }, [options, value, multiple]);

  const showSearch = options.length > 10;

  const handleSelect = (optionValue: string) => {
    if (multiple && Array.isArray(value)) {
      const currentValues = value as string[];
      const newValues = currentValues.includes(optionValue)
        ? currentValues.filter((v) => v !== optionValue)
        : [...currentValues, optionValue];
      (onValueChange as (value: string[]) => void)(newValues);
    } else if (!multiple && typeof value === "string") {
      (onValueChange as (value: string) => void)(optionValue);
      setOpen(false);
      setSearchQuery("");
    }
  };

  const handleRemove = (e: React.MouseEvent, optionValue: string) => {
    e.stopPropagation();
    if (multiple && Array.isArray(value)) {
      const currentValues = value as string[];
      const newValues = currentValues.filter((v) => v !== optionValue);
      (onValueChange as (value: string[]) => void)(newValues);
    }
  };

  return (
    <div className="w-full space-y-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-invalid={!!error || props["aria-invalid"]}
            className={cn(
              "w-full justify-between font-normal min-h-10 h-auto py-2 px-3 transition-colors",
              (error || props["aria-invalid"]) &&
                "border-destructive ring-destructive/20 focus-visible:ring-destructive/50",
              className
            )}
            disabled={disabled}
            {...props}
          >
            <div className="flex flex-wrap gap-1 items-center overflow-hidden text-left">
              {selectedOptions.length > 0 ? (
                multiple ? (
                  selectedOptions.map((opt) => (
                    <Badge
                      key={opt.value}
                      variant="secondary"
                      className="mr-1 mb-1 font-normal"
                      onClick={(e) => handleRemove(e, opt.value)}
                    >
                      {opt.label}
                      <X className="ml-1 h-3 w-3 hover:text-destructive" />
                    </Badge>
                  ))
                ) : (
                  <span className="truncate">{selectedOptions[0].label}</span>
                )
              ) : (
                <span className="text-muted-foreground">{placeholder}</span>
              )}
            </div>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <div
            className="max-h-[300px] overflow-y-auto"
            onWheel={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {showSearch && (
              <div className="flex items-center border-b px-3 sticky top-0 bg-popover z-10">
                <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                <Input
                  placeholder={searchPlaceholder}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 border-0 focus-visible:ring-0 px-0 bg-transparent shadow-none"
                />
              </div>
            )}
            <div className="p-1">
              {filteredOptions.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">{emptyMessage}</div>
              ) : (
                filteredOptions.map((option) => {
                  const isSelected = multiple
                    ? (value as string[]).includes(option.value)
                    : value === option.value;
                  return (
                    <div
                      key={option.value}
                      role="option"
                      aria-selected={isSelected}
                      className={cn(
                        "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
                        isSelected && "bg-accent text-accent-foreground"
                      )}
                      onClick={() => handleSelect(option.value)}
                    >
                      <Check
                        className={cn("mr-2 h-4 w-4", isSelected ? "opacity-100" : "opacity-0")}
                      />
                      {option.label}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>
      {error && <p className="text-xs font-medium text-destructive">{error}</p>}
    </div>
  );
}
