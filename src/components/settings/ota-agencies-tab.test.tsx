import { render, screen, act, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { OtaAgenciesTab } from "./ota-agencies-tab";

const mockAgencies = [{ id: 1, name: "Expedia" }];

describe("OtaAgenciesTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it("renders correctly", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => [],
    } as Response);

    await act(async () => {
      render(<OtaAgenciesTab />);
    });

    expect(screen.getByText("OTA Agencies")).toBeInTheDocument();
    expect(screen.getByTestId("add-agency-button")).toBeInTheDocument();
  });

  it("shows empty state message", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => [],
    } as Response);

    await act(async () => {
      render(<OtaAgenciesTab />);
    });

    expect(screen.getByTestId("ota-agencies-empty")).toBeInTheDocument();
    expect(screen.getByText(/No OTA agencies/i)).toBeInTheDocument();
    expect(screen.getByText(/Add agencies like Expedia/i)).toBeInTheDocument();
  });

  it("shows fetched agencies", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => mockAgencies,
    } as Response);

    await act(async () => {
      render(<OtaAgenciesTab />);
    });

    const desktopView = screen.getByTestId("agencies-desktop");
    expect(within(desktopView).getByText("Expedia")).toBeInTheDocument();
  });

  it("opens confirmation dialog when Delete is clicked", async () => {
    const user = userEvent.setup();
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => mockAgencies,
    } as Response);

    await act(async () => {
      render(<OtaAgenciesTab />);
    });

    // Find delete button in the desktop view table
    const desktopView = screen.getByTestId("agencies-desktop");
    const deleteBtn = within(desktopView).getByRole("button", { name: "Delete" });
    await user.click(deleteBtn);

    expect(screen.getByText("Delete OTA Agency?")).toBeInTheDocument();
    expect(screen.getByText(/Are you sure you want to delete "Expedia"/)).toBeInTheDocument();
  });

  it("calls DELETE API and refreshes list after confirming", async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .mocked(global.fetch)
      .mockImplementation((url: string, options?: RequestInit) => {
        if (url === "/api/ota-agencies" && (!options || !options.method))
          return Promise.resolve({ ok: true, json: async () => mockAgencies } as Response);
        if (url === "/api/ota-agencies/1" && options?.method === "DELETE")
          return Promise.resolve({ ok: true } as Response);
        return Promise.reject(new Error(`Unknown: ${url}`));
      });

    await act(async () => {
      render(<OtaAgenciesTab />);
    });

    const desktopView = screen.getByTestId("agencies-desktop");
    const deleteBtn = within(desktopView).getByRole("button", { name: "Delete" });
    await user.click(deleteBtn);

    await user.click(screen.getByTestId("confirm-dialog-confirm-button"));

    expect(fetchMock).toHaveBeenCalledWith("/api/ota-agencies/1", { method: "DELETE" });
  });

  it("does not call DELETE if dialog is cancelled", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => mockAgencies,
    } as Response);

    await act(async () => {
      render(<OtaAgenciesTab />);
    });

    const desktopView = screen.getByTestId("agencies-desktop");
    const deleteBtn = within(desktopView).getByRole("button", { name: "Delete" });
    await user.click(deleteBtn);

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    const deleteCalls = fetchMock.mock.calls.filter(([, opts]) => opts?.method === "DELETE");
    expect(deleteCalls.length).toBe(0);
  });
});
