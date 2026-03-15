import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NavItemsList } from "./nav-items-list";
import { usePathname } from "next/navigation";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
}));

// Mock next/link to avoid "Not implemented: navigation to another Document"
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    onClick,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
  } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a
      href={href}
      onClick={(e) => {
        e.preventDefault();
        onClick?.(e);
      }}
      {...props}
    >
      {children}
    </a>
  ),
}));

describe("NavItemsList", () => {
  beforeEach(() => {
    vi.mocked(usePathname).mockReturnValue("/");
  });

  afterEach(() => {
    vi.clearAllMocks();
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

  it("calls onItemClick when an item is clicked", async () => {
    const user = userEvent.setup();
    const onItemClick = vi.fn();
    render(<NavItemsList onItemClick={onItemClick} />);

    await user.click(screen.getByTestId("nav-item-bookings"));
    expect(onItemClick).toHaveBeenCalledTimes(1);
  });
});
