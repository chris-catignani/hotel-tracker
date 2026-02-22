import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PointTypesTab } from "./point-types-tab";

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

    expect(screen.getByText(/No point types added yet/i)).toBeInTheDocument();
  });

  it("renders fetched point types", async () => {
    const mockPt = [{ id: 1, name: "Marriott Points", category: "hotel", centsPerPoint: 0.007 }];
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => mockPt,
    } as Response);

    await act(async () => {
      render(<PointTypesTab />);
    });

    expect(screen.getByText("Marriott Points")).toBeInTheDocument();
  });
});
