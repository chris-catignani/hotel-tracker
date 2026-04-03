import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TravelMapModal } from "./travel-map-modal";
import type { TravelStop } from "@/app/api/travel-map/route";
import type { ApiFetchResult } from "@/lib/api-fetch";

// Mock next/dynamic — immediately resolves to the stub component synchronously
vi.mock("next/dynamic", () => ({
  default:
    () =>
    ({ stops }: { stops: TravelStop[] }) => (
      <div data-testid="travel-map-stub">stops:{stops.length}</div>
    ),
}));

// Mock apiFetch so we control API responses
vi.mock("@/lib/api-fetch", () => ({
  apiFetch: vi.fn(),
}));

// Mock ./travel-map since MapLibre won't work in jsdom
vi.mock("./travel-map", () => ({
  TravelMap: ({ stops }: { stops: TravelStop[] }) => (
    <div data-testid="travel-map-stub">stops:{stops.length}</div>
  ),
}));

import { apiFetch } from "@/lib/api-fetch";
const mockApiFetch = vi.mocked(apiFetch);

const SAMPLE_STOP: TravelStop = {
  id: "1",
  propertyName: "Park Hyatt Paris",
  city: "Paris",
  countryCode: "FR",
  checkIn: "2024-06-12",
  numNights: 3,
  lat: 48.8566,
  lng: 2.3522,
};

function makeOkResult(stops: TravelStop[]): ApiFetchResult<TravelStop[]> {
  return { ok: true, data: stops };
}

function makeErrorResult(): ApiFetchResult<TravelStop[]> {
  return { ok: false, status: 500, error: new Error("Server error") };
}

describe("TravelMapModal", () => {
  beforeEach(() => {
    // Default: never-resolving promise so we can assert loading state
    mockApiFetch.mockReturnValue(new Promise(() => {}));
  });

  it("renders nothing when closed", () => {
    mockApiFetch.mockResolvedValue(makeOkResult([]));
    render(<TravelMapModal open={false} onOpenChange={vi.fn()} />);
    expect(screen.queryByTestId("travel-map-modal")).not.toBeInTheDocument();
  });

  it("shows loading state when opened and fetch is in flight", async () => {
    // mockApiFetch already set to a never-resolving promise in beforeEach
    render(<TravelMapModal open={true} onOpenChange={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByTestId("travel-map-modal")).toBeInTheDocument();
    });
    expect(screen.getByTestId("page-spinner")).toBeInTheDocument();
  });

  it("shows empty state when fetch succeeds with empty stops", async () => {
    mockApiFetch.mockResolvedValue(makeOkResult([]));
    render(<TravelMapModal open={true} onOpenChange={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText("No location data yet")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("page-spinner")).not.toBeInTheDocument();
  });

  it("shows error state when fetch fails", async () => {
    mockApiFetch.mockResolvedValue(makeErrorResult());
    render(<TravelMapModal open={true} onOpenChange={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText("Failed to load travel data.")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("page-spinner")).not.toBeInTheDocument();
  });

  it("shows map and controls when fetch succeeds with stops", async () => {
    mockApiFetch.mockResolvedValue(makeOkResult([SAMPLE_STOP]));
    render(<TravelMapModal open={true} onOpenChange={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByTestId("travel-map-play-pause")).toBeInTheDocument();
    });
    expect(screen.getByTestId("travel-map-speed-slider")).toBeInTheDocument();
    expect(screen.queryByTestId("page-spinner")).not.toBeInTheDocument();
  });

  it("resets stops state when modal closes and reopens (no stale data flash)", async () => {
    mockApiFetch.mockResolvedValue(makeOkResult([SAMPLE_STOP]));

    const { rerender } = render(<TravelMapModal open={true} onOpenChange={vi.fn()} />);

    // Wait for stops to load
    await waitFor(() => {
      expect(screen.getByTestId("travel-map-play-pause")).toBeInTheDocument();
    });

    // Close the modal — this should reset stops
    mockApiFetch.mockReturnValue(new Promise(() => {})); // never resolves on reopen
    rerender(<TravelMapModal open={false} onOpenChange={vi.fn()} />);

    // Modal is gone
    expect(screen.queryByTestId("travel-map-modal")).not.toBeInTheDocument();

    // Reopen — the fetch is pending. If stops were NOT reset, we'd see the map
    // immediately. Instead we should see the loading spinner.
    rerender(<TravelMapModal open={true} onOpenChange={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId("travel-map-modal")).toBeInTheDocument();
    });

    // Stale stops were cleared — loading spinner should be showing, not the map
    expect(screen.getByTestId("page-spinner")).toBeInTheDocument();
    expect(screen.queryByTestId("travel-map-play-pause")).not.toBeInTheDocument();
  });
});
