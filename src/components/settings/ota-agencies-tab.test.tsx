import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { OtaAgenciesTab } from "./ota-agencies-tab";

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

  it("shows fetched agencies", async () => {
    const mockAgencies = [{ id: 1, name: "Expedia" }];
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => mockAgencies,
    } as Response);

    await act(async () => {
      render(<OtaAgenciesTab />);
    });

    expect(screen.getByText("Expedia")).toBeInTheDocument();
  });
});
