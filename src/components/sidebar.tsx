"use client";

import { NavItemsList } from "@/components/nav-items-list";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";

export function Sidebar() {
  return (
    <aside
      className="hidden lg:flex h-screen w-60 flex-col border-r bg-card shrink-0"
      data-testid="sidebar"
    >
      <div className="flex h-14 items-center border-b px-6">
        <h1 className="text-lg font-semibold">Hotel Tracker</h1>
      </div>
      <div className="flex-1 p-4 overflow-y-auto">
        <NavItemsList />
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
    </aside>
  );
}
