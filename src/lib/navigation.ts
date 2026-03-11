import { LayoutDashboard, CalendarDays, Tag, Settings, Eye } from "lucide-react";

export const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/bookings", label: "Bookings", icon: CalendarDays },
  { href: "/promotions", label: "Promotions", icon: Tag },
  { href: "/price-watch", label: "Price Watch", icon: Eye },
  { href: "/settings", label: "Settings", icon: Settings },
];
