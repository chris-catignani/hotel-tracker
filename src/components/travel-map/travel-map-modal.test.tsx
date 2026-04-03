import { render, screen, waitFor, fireEvent } from "@testing-library/react";
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

import type { HomebaseEntry } from "./travel-map-utils";
import { HOMEBASE_STORAGE_KEY } from "./travel-map-utils";

vi.mock("./travel-map-homebase-input", () => ({
  HomebaseInput: ({
    initialAddress,
    onSelect,
    onSkip,
  }: {
    initialAddress: string;
    onSelect: (e: HomebaseEntry) => void;
    onSkip: () => void;
  }) => (
    <div data-testid="homebase-prompt">
      <span data-testid="homebase-prefilled">{initialAddress}</span>
      <button data-testid="homebase-skip" onClick={onSkip}>
        Skip
      </button>
      <button
        data-testid="homebase-select"
        onClick={() =>
          onSelect({
            address: "Springfield, IL",
            city: "Springfield",
            countryCode: "US",
            lat: 39.8,
            lng: -89.6,
          })
        }
      >
        Select
      </button>
    </div>
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

  it("shows homebase prompt after stops load, not the countdown", async () => {
    mockApiFetch.mockResolvedValue(makeOkResult([SAMPLE_STOP]));
    render(<TravelMapModal open={true} onOpenChange={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByTestId("homebase-prompt")).toBeInTheDocument();
    });
    // Countdown must NOT be showing yet
    expect(screen.queryByText("5")).not.toBeInTheDocument();
  });

  it("dismisses prompt and shows countdown when Skip is clicked", async () => {
    mockApiFetch.mockResolvedValue(makeOkResult([SAMPLE_STOP]));
    render(<TravelMapModal open={true} onOpenChange={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId("homebase-prompt")).toBeInTheDocument());
    fireEvent.click(screen.getByTestId("homebase-skip"));
    await waitFor(() => expect(screen.queryByTestId("homebase-prompt")).not.toBeInTheDocument());
    // Countdown "5" should now render
    await waitFor(() => expect(screen.getByText("5")).toBeInTheDocument());
  });

  it("dismisses prompt and shows countdown when homebase selected", async () => {
    mockApiFetch.mockResolvedValue(makeOkResult([SAMPLE_STOP]));
    render(<TravelMapModal open={true} onOpenChange={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId("homebase-prompt")).toBeInTheDocument());
    fireEvent.click(screen.getByTestId("homebase-select"));
    await waitFor(() => expect(screen.queryByTestId("homebase-prompt")).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByText("5")).toBeInTheDocument());
  });

  it("saves homebase to localStorage when address is selected", async () => {
    localStorage.clear();
    mockApiFetch.mockResolvedValue(makeOkResult([SAMPLE_STOP]));
    render(<TravelMapModal open={true} onOpenChange={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId("homebase-prompt")).toBeInTheDocument());
    fireEvent.click(screen.getByTestId("homebase-select"));
    const saved = localStorage.getItem(HOMEBASE_STORAGE_KEY);
    expect(saved).not.toBeNull();
    const parsed = JSON.parse(saved!);
    expect(parsed.city).toBe("Springfield");
    expect(parsed.lat).toBe(39.8);
  });

  it("prefills prompt with address from localStorage", async () => {
    localStorage.setItem(
      HOMEBASE_STORAGE_KEY,
      JSON.stringify({
        address: "Paris, France",
        city: "Paris",
        countryCode: "FR",
        lat: 48.8,
        lng: 2.3,
      })
    );
    mockApiFetch.mockResolvedValue(makeOkResult([SAMPLE_STOP]));
    render(<TravelMapModal open={true} onOpenChange={vi.fn()} />);
    await waitFor(() =>
      expect(screen.getByTestId("homebase-prefilled")).toHaveTextContent("Paris, France")
    );
    localStorage.clear();
  });

  it("does not show homebase prompt when stops are empty", async () => {
    mockApiFetch.mockResolvedValue(makeOkResult([]));
    render(<TravelMapModal open={true} onOpenChange={vi.fn()} />);
    await waitFor(() => expect(screen.getByText("No location data yet")).toBeInTheDocument());
    expect(screen.queryByTestId("homebase-prompt")).not.toBeInTheDocument();
  });
});
