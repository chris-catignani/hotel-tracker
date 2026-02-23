import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
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

  it("renders the header and title", () => {
    render(<MobileHeader />);
    expect(screen.getByTestId("mobile-header-title")).toHaveTextContent("Hotel Tracker");
    expect(screen.getByTestId("mobile-nav-toggle")).toBeInTheDocument();
  });

  it("opens the navigation menu when the toggle is clicked", async () => {
    render(<MobileHeader />);

    const toggle = screen.getByTestId("mobile-nav-toggle");
    fireEvent.click(toggle);

    // Wait for SheetContent to appear (it should have data-testid="mobile-nav-content")
    await waitFor(() => {
      expect(screen.getByTestId("mobile-nav-content")).toBeInTheDocument();
    });

    // Verify NavItemsList is rendered inside
    expect(screen.getByTestId("nav-item-dashboard")).toBeInTheDocument();
  });

  it("closes the navigation menu when a link is clicked", async () => {
    render(<MobileHeader />);

    // Open menu
    fireEvent.click(screen.getByTestId("mobile-nav-toggle"));

    await waitFor(() => {
      expect(screen.getByTestId("mobile-nav-content")).toBeInTheDocument();
    });

    // Click a nav item
    fireEvent.click(screen.getByTestId("nav-item-bookings"));

    // Sheet should close (Radix UI might take a moment to unmount or apply state)
    // We check if the state 'open' in Sheet changes.
    // Usually we can wait for the content to disappear.
    await waitFor(() => {
      expect(screen.queryByTestId("mobile-nav-content")).not.toBeInTheDocument();
    });
  });
});
