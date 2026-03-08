"use client";

import { useState } from "react";
import { Menu, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { NavItemsList } from "@/components/nav-items-list";
import { signOut } from "next-auth/react";

export function MobileHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="flex h-14 items-center border-b px-4 lg:hidden bg-card sticky top-0 z-40">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="mr-2" data-testid="mobile-nav-toggle">
            <Menu className="size-5" />
            <span className="sr-only">Toggle navigation menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-60 p-0" data-testid="mobile-nav-content">
          <SheetHeader className="h-14 border-b px-6 flex items-center justify-center">
            <SheetTitle className="text-lg font-semibold text-left w-full">
              Hotel Tracker
            </SheetTitle>
            <SheetDescription className="sr-only">
              Navigation menu for mobile devices
            </SheetDescription>
          </SheetHeader>
          <div className="flex flex-col h-[calc(100%-3.5rem)]">
            <div className="flex-1 p-4">
              <NavItemsList onItemClick={() => setOpen(false)} />
            </div>
            <div className="border-t p-4">
              <Button
                variant="ghost"
                className="w-full justify-start gap-2 text-muted-foreground"
                onClick={() => signOut({ callbackUrl: "/login" })}
              >
                <LogOut className="size-4" />
                Sign out
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
      <div className="flex-1 flex justify-center lg:justify-start">
        <h1 className="text-lg font-semibold" data-testid="mobile-header-title">
          Hotel Tracker
        </h1>
      </div>
      <div className="w-9" /> {/* Spacer for centering title on mobile */}
    </header>
  );
}
