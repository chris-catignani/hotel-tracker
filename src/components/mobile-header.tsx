"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { NavItemsList } from "@/components/nav-items-list";

export function MobileHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="flex h-14 items-center border-b px-4 lg:hidden bg-card sticky top-0 z-40">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="mr-2">
            <Menu className="size-5" />
            <span className="sr-only">Toggle navigation menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-60 p-0">
          <SheetHeader className="h-14 border-b px-6 flex items-center justify-center">
            <SheetTitle className="text-lg font-semibold text-left w-full">Hotel Tracker</SheetTitle>
          </SheetHeader>
          <div className="p-4">
            <NavItemsList onItemClick={() => setOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>
      <div className="flex-1 flex justify-center lg:justify-start">
        <h1 className="text-lg font-semibold">Hotel Tracker</h1>
      </div>
      <div className="w-9" /> {/* Spacer for centering title on mobile */}
    </header>
  );
}
