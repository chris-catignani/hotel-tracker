"use client";

import * as React from "react";
import { format, isValid, parse } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";

interface DatePickerProps {
  date?: Date;
  setDate: (date?: Date) => void;
  placeholder?: string;
  className?: string;
  id?: string;
}

function useMediaQuery(query: string) {
  const [value, setValue] = React.useState(false);

  React.useEffect(() => {
    const result = window.matchMedia(query);
    setValue(result.matches);

    function onChange(event: MediaQueryListEvent) {
      setValue(event.matches);
    }

    result.addEventListener("change", onChange);
    return () => result.removeEventListener("change", onChange);
  }, [query]);

  return value;
}

/**
 * Auto-formats numeric input into MM/DD/YYYY.
 * e.g. "022426" -> "02/24/26", "02242026" -> "02/24/2026"
 */
function formatInputString(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  let formatted = digits;
  if (digits.length >= 3 && digits.length <= 4) {
    formatted = `${digits.slice(0, 2)}/${digits.slice(2)}`;
  } else if (digits.length >= 5) {
    formatted = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
  }
  return formatted;
}

/**
 * Tries parsing several potential input formats.
 */
function parseDateInput(value: string, allowShortYear = false): Date | undefined {
  const formats = allowShortYear ? ["MM/dd/yyyy", "MM/dd/yy"] : ["MM/dd/yyyy"];
  // Only parse if it looks like a full date (8 chars for MM/DD/YY or 10 chars for MM/DD/YYYY)
  if (value.length !== 10 && !(allowShortYear && value.length === 8)) {
    return undefined;
  }

  for (const f of formats) {
    const parsed = parse(value, f, new Date());
    if (isValid(parsed)) {
      if (parsed.getFullYear() > 1000) {
        return parsed;
      }
    }
  }
  return undefined;
}

export function DatePicker({
  date,
  setDate,
  placeholder = "Pick a date",
  className,
  id,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [inputValue, setInputValue] = React.useState("");

  // Sync state with prop
  React.useEffect(() => {
    if (date) {
      setInputValue(format(date, "MM/dd/yyyy"));
    } else {
      setInputValue("");
    }
  }, [date]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const formatted = formatInputString(raw);
    setInputValue(formatted);

    if (!formatted) {
      setDate(undefined);
      return;
    }

    // Only parse MMDDYYYY while typing (length 10)
    const parsedDate = parseDateInput(formatted, false);
    if (parsedDate) {
      setDate(parsedDate);
    }
  };

  const handleBlur = () => {
    // On blur, allow parsing MMDDYY (length 8)
    const parsedDate = parseDateInput(inputValue, true);
    if (parsedDate) {
      setDate(parsedDate);
    }
  };

  const desktopTrigger = (
    <div className="relative w-full">
      <Input
        id={id}
        value={inputValue}
        onChange={handleInputChange}
        onBlur={handleBlur}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        placeholder="MM/DD/YYYY"
        className={cn(
          "w-full justify-start text-left font-normal h-11 md:h-9 text-base md:text-sm pl-9",
          !date && "text-muted-foreground",
          className
        )}
        data-testid={id ? `date-picker-input-${id}` : "date-picker-input"}
      />
      <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-50 pointer-events-none" />
    </div>
  );

  const mobileTrigger = (
    <Button
      id={id}
      variant={"outline"}
      data-testid={id ? `date-picker-trigger-${id}` : "date-picker-trigger"}
      className={cn(
        "w-full justify-start text-left font-normal h-11 md:h-9 text-base md:text-sm",
        !date && "text-muted-foreground",
        className
      )}
    >
      <CalendarIcon className="mr-2 h-4 w-4" />
      {date ? format(date, "PPP") : <span>{placeholder}</span>}
    </Button>
  );

  const calendar = (
    <Calendar
      mode="single"
      selected={date}
      onSelect={(newDate) => {
        setDate(newDate);
        setOpen(false);
      }}
      defaultMonth={date}
      initialFocus={!isDesktop}
    />
  );

  if (isDesktop) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverAnchor asChild>{desktopTrigger}</PopoverAnchor>
        <PopoverContent
          className="w-auto p-0"
          align="start"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {calendar}
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{mobileTrigger}</SheetTrigger>
      <SheetContent side="bottom" className="p-0">
        <SheetHeader className="px-4 pt-4 pb-2 border-b">
          <SheetTitle>{placeholder}</SheetTitle>
        </SheetHeader>
        <div className="flex justify-center p-4 pb-8">{calendar}</div>
      </SheetContent>
    </Sheet>
  );
}
