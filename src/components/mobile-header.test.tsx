import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MobileHeader } from "./mobile-header";
import { usePathname } from "next/navigation";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
}));

describe("MobileHeader", () => {
  beforeEach(() => {
    vi.mocked(usePathname).mockReturnValue("/");
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders the header and title", async () => {
    await act(async () => {
      render(<MobileHeader />);
    });
    expect(screen.getByTestId("mobile-header-title")).toHaveTextContent("Hotel Tracker");
    expect(screen.getByTestId("mobile-nav-toggle")).toBeInTheDocument();
  });

  it("opens the navigation menu when the toggle is clicked", async () => {
    const user = userEvent.setup();
    await act(async () => {
      render(<MobileHeader />);
    });

    const toggle = screen.getByTestId("mobile-nav-toggle");
    await user.click(toggle);

    // Verify SheetContent and NavItemsList are rendered
    expect(screen.getByTestId("mobile-nav-content")).toBeInTheDocument();
    expect(screen.getByTestId("nav-item-dashboard")).toBeInTheDocument();
  });

  it("closes the navigation menu when a link is clicked", async () => {
    const user = userEvent.setup();
    await act(async () => {
      render(<MobileHeader />);
    });

    // Open menu
    await user.click(screen.getByTestId("mobile-nav-toggle"));
    expect(screen.getByTestId("mobile-nav-content")).toBeInTheDocument();

    // Click a nav item
    await user.click(screen.getByTestId("nav-item-bookings"));

    // Sheet should close immediately with animations disabled
    expect(screen.queryByTestId("mobile-nav-content")).not.toBeInTheDocument();
  });
});
