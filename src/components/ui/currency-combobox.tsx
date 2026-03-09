"use client";

import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CURRENCY_OPTIONS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown } from "lucide-react";

interface CurrencyComboboxProps {
  value: string;
  onValueChange: (value: string) => void;
  "data-testid"?: string;
}

export function CurrencyCombobox({
  value,
  onValueChange,
  "data-testid": testId,
}: CurrencyComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = CURRENCY_OPTIONS.filter(
    (c) =>
      c.code.toLowerCase().includes(search.toLowerCase()) ||
      c.name.toLowerCase().includes(search.toLowerCase())
  );

  const selected = CURRENCY_OPTIONS.find((c) => c.code === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
          data-testid={testId}
        >
          {selected ? `${selected.code} — ${selected.name}` : "Select currency"}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-2" align="start">
        <Input
          placeholder="Search currency or country..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-2 h-8"
          autoFocus
        />
        <div className="max-h-60 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground px-2 py-1">No results.</p>
          ) : (
            filtered.map((c) => (
              <button
                key={c.code}
                className={cn(
                  "flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground cursor-pointer text-left",
                  value === c.code && "bg-accent text-accent-foreground"
                )}
                onClick={() => {
                  onValueChange(c.code);
                  setSearch("");
                  setOpen(false);
                }}
              >
                <Check
                  className={cn("h-4 w-4 shrink-0", value === c.code ? "opacity-100" : "opacity-0")}
                />
                <span className="font-mono text-xs w-8 shrink-0">{c.code}</span>
                <span className="text-muted-foreground truncate">{c.name}</span>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
