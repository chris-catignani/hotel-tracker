"use client";

import { NavItemsList } from "@/components/nav-items-list";

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
    </aside>
  );
}
