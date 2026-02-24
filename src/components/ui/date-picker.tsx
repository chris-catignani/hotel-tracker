"use client";

import * as React from "react";
import { format, isValid, parse } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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

export function DatePicker({
  date,
  setDate,
  placeholder = "Pick a date",
  className,
  id,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [inputValue, setInputValue] = React.useState(date ? format(date, "MM/dd/yyyy") : "");

  React.useEffect(() => {
    if (date) {
      setInputValue(format(date, "MM/dd/yyyy"));
    } else {
      setInputValue("");
    }
  }, [date]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);

    if (!value) {
      setDate(undefined);
      return;
    }

    // Try parsing the date in MM/dd/yyyy format
    const parsedDate = parse(value, "MM/dd/yyyy", new Date());
    if (isValid(parsedDate)) {
      // Only set date if it's a reasonable year to avoid partial typing issues
      if (parsedDate.getFullYear() > 1000) {
        setDate(parsedDate);
      }
    }
  };

  const trigger = isDesktop ? (
    <div className="relative w-full">
      <Input
        id={id}
        value={inputValue}
        onChange={handleInputChange}
        onFocus={() => setOpen(true)}
        placeholder="MM/DD/YYYY"
        className={cn(
          "w-full justify-start text-left font-normal h-11 md:h-9 text-base md:text-sm pl-9",
          !date && "text-muted-foreground",
          className
        )}
        data-testid={id ? `date-picker-input-${id}` : "date-picker-input"}
      />
      <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-50" />
    </div>
  ) : (
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
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
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
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent side="bottom" className="p-0">
        <SheetHeader className="px-4 pt-4 pb-2 border-b">
          <SheetTitle>{placeholder}</SheetTitle>
        </SheetHeader>
        <div className="flex justify-center p-4 pb-8">{calendar}</div>
      </SheetContent>
    </Sheet>
  );
}
