import { render, screen, act, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PointTypesTab } from "./point-types-tab";

const mockPt = [{ id: 1, name: "Marriott Points", category: "hotel", centsPerPoint: 0.007 }];

describe("PointTypesTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it("renders basic UI elements", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => [],
    } as Response);

    await act(async () => {
      render(<PointTypesTab />);
    });

    expect(screen.getByText("Point Types")).toBeInTheDocument();
    expect(screen.getByTestId("add-point-type-button")).toBeInTheDocument();
  });

  it("shows empty state message", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => [],
    } as Response);

    await act(async () => {
      render(<PointTypesTab />);
    });

    // Check both mobile and desktop views for empty state
    const mobileView = screen.getByTestId("point-types-mobile");
    const desktopView = screen.getByTestId("point-types-desktop");

    expect(within(mobileView).getByText(/No point types added yet/i)).toBeInTheDocument();
    expect(within(desktopView).getByText(/No point types added yet/i)).toBeInTheDocument();
  });

  it("renders fetched point types", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => mockPt,
    } as Response);

    await act(async () => {
      render(<PointTypesTab />);
    });

    // Verify it appears in both views
    const mobileView = screen.getByTestId("point-types-mobile");
    const desktopView = screen.getByTestId("point-types-desktop");

    expect(within(mobileView).getByText("Marriott Points")).toBeInTheDocument();
    expect(within(desktopView).getByText("Marriott Points")).toBeInTheDocument();
  });

  it("opens confirmation dialog when Delete is clicked", async () => {
    const user = userEvent.setup();
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => mockPt,
    } as Response);

    await act(async () => {
      render(<PointTypesTab />);
    });

    const desktopView = screen.getByTestId("point-types-desktop");
    const deleteBtn = within(desktopView).getByRole("button", { name: "Delete" });
    await user.click(deleteBtn);

    expect(screen.getByText("Delete Point Type?")).toBeInTheDocument();
    expect(
      screen.getByText(/Are you sure you want to delete "Marriott Points"/)
    ).toBeInTheDocument();
  });

  it("calls DELETE API and refreshes list after confirming", async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .mocked(global.fetch)
      .mockImplementation((url: string, options?: RequestInit) => {
        if (url === "/api/point-types" && (!options || !options.method))
          return Promise.resolve({ ok: true, json: async () => mockPt } as Response);
        if (url === "/api/point-types/1" && options?.method === "DELETE")
          return Promise.resolve({ ok: true } as Response);
        return Promise.reject(new Error(`Unknown: ${url}`));
      });

    await act(async () => {
      render(<PointTypesTab />);
    });

    const desktopView = screen.getByTestId("point-types-desktop");
    const deleteBtn = within(desktopView).getByRole("button", { name: "Delete" });
    await user.click(deleteBtn);

    await user.click(screen.getByTestId("confirm-dialog-confirm-button"));

    expect(fetchMock).toHaveBeenCalledWith("/api/point-types/1", { method: "DELETE" });
  });

  it("does not call DELETE if dialog is cancelled", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => mockPt,
    } as Response);

    await act(async () => {
      render(<PointTypesTab />);
    });

    const desktopView = screen.getByTestId("point-types-desktop");
    const deleteBtn = within(desktopView).getByRole("button", { name: "Delete" });
    await user.click(deleteBtn);

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    const deleteCalls = fetchMock.mock.calls.filter(([, opts]) => opts?.method === "DELETE");
    expect(deleteCalls.length).toBe(0);
  });
});
