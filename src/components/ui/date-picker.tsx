"use client";

import * as React from "react";
import { format, isValid, parse } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { InputMask } from "@react-input/mask";

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
  error?: string;
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

function parseDateInput(value: string): Date | undefined {
  if (value.length !== 8) return undefined;
  const parsed = parse(value, "MM/dd/yy", new Date());
  return isValid(parsed) && parsed.getFullYear() > 1000 ? parsed : undefined;
}

export function DatePicker({
  date,
  setDate,
  placeholder = "Pick a date",
  className,
  id,
  error,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [inputValue, setInputValue] = React.useState("");

  React.useEffect(() => {
    if (date) {
      setInputValue(format(date, "MM/dd/yy"));
    } else {
      setInputValue("");
    }
  }, [date]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setInputValue(raw);
    setDate(parseDateInput(raw));
  };

  const desktopTrigger = (
    <div className="relative w-full">
      <InputMask
        component={Input}
        mask="mm/dd/yy"
        replacement={{ m: /\d/, d: /\d/, y: /\d/ }}
        id={id}
        value={inputValue}
        onChange={handleInputChange}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        placeholder="MM/DD/YY"
        aria-invalid={!!error}
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
      aria-invalid={!!error}
      className={cn(
        "w-full justify-start text-left font-normal h-11 md:h-9 text-base md:text-sm",
        !date && "text-muted-foreground",
        error && "border-destructive ring-destructive/20 focus-visible:ring-destructive/50",
        className
      )}
    >
      <CalendarIcon className="mr-2 h-4 w-4" />
      {date ? format(date, "MM/dd/yy") : <span>{placeholder}</span>}
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

  return (
    <div className="w-full space-y-1">
      {isDesktop ? (
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
      ) : (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>{mobileTrigger}</SheetTrigger>
          <SheetContent side="bottom" className="p-0">
            <SheetHeader className="px-4 pt-4 pb-4 pr-12 border-b">
              <SheetTitle>{placeholder}</SheetTitle>
            </SheetHeader>
            <div className="flex justify-center px-4 pt-4 pb-8">{calendar}</div>
          </SheetContent>
        </Sheet>
      )}
      {error && <p className="text-xs font-medium text-destructive">{error}</p>}
    </div>
  );
}
