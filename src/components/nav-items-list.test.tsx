import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NavItemsList } from "./nav-items-list";
import { usePathname } from "next/navigation";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
}));

describe("NavItemsList", () => {
  beforeEach(() => {
    vi.mocked(usePathname).mockReturnValue("/");
  });

  it("renders all navigation items", () => {
    render(<NavItemsList />);

    expect(screen.getByTestId("nav-item-dashboard")).toBeInTheDocument();
    expect(screen.getByTestId("nav-item-bookings")).toBeInTheDocument();
    expect(screen.getByTestId("nav-item-promotions")).toBeInTheDocument();
    expect(screen.getByTestId("nav-item-settings")).toBeInTheDocument();
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

  it("calls onItemClick when an item is clicked", () => {
    const onItemClick = vi.fn();
    render(<NavItemsList onItemClick={onItemClick} />);

    fireEvent.click(screen.getByTestId("nav-item-bookings"));
    expect(onItemClick).toHaveBeenCalledTimes(1);
  });
});
