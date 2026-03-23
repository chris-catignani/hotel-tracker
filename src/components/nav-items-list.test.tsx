import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NavItemsList } from "./nav-items-list";
import { usePathname } from "next/navigation";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
}));

// Mock next-auth/react
vi.mock("next-auth/react", () => ({
  useSession: vi.fn(),
}));

import { useSession } from "next-auth/react";

describe("NavItemsList", () => {
  beforeEach(() => {
    vi.mocked(usePathname).mockReturnValue("/");
    vi.mocked(useSession).mockReturnValue({
      data: { user: { id: "1", role: "ADMIN" }, expires: "" },
      status: "authenticated",
      update: vi.fn(),
    });
  });

  it("renders all navigation items for admin users", () => {
    render(<NavItemsList />);

    expect(screen.getByTestId("nav-item-dashboard")).toBeInTheDocument();
    expect(screen.getByTestId("nav-item-bookings")).toBeInTheDocument();
    expect(screen.getByTestId("nav-item-promotions")).toBeInTheDocument();
    expect(screen.getByTestId("nav-item-settings")).toBeInTheDocument();
    expect(screen.getByTestId("nav-item-health")).toBeInTheDocument();
  });

  it("hides admin-only items for non-admin users", () => {
    vi.mocked(useSession).mockReturnValue({
      data: { user: { id: "1", role: "USER" }, expires: "" },
      status: "authenticated",
      update: vi.fn(),
    });
    render(<NavItemsList />);

    expect(screen.getByTestId("nav-item-dashboard")).toBeInTheDocument();
    expect(screen.queryByTestId("nav-item-health")).not.toBeInTheDocument();
  });

  it("hides admin-only items when session is loading", () => {
    vi.mocked(useSession).mockReturnValue({
      data: null,
      status: "loading",
      update: vi.fn(),
    });
    render(<NavItemsList />);

    expect(screen.queryByTestId("nav-item-health")).not.toBeInTheDocument();
  });

  it("highlights the active item based on pathname", () => {
    vi.mocked(usePathname).mockReturnValue("/bookings");

    render(<NavItemsList />);

    const bookingsItem = screen.getByTestId("nav-item-bookings");
    const dashboardItem = screen.getByTestId("nav-item-dashboard");

    // Check for active classes (bg-accent text-accent-foreground)
    expect(bookingsItem).toHaveClass("bg-accent", "text-accent-foreground");
    expect(dashboardItem).not.toHaveClass("bg-accent", "text-accent-foreground");
  });

  it("calls onItemClick when an item is clicked", async () => {
    const user = userEvent.setup();
    const onItemClick = vi.fn();
    render(<NavItemsList onItemClick={onItemClick} />);

    await user.click(screen.getByTestId("nav-item-bookings"));
    expect(onItemClick).toHaveBeenCalledTimes(1);
  });
});
