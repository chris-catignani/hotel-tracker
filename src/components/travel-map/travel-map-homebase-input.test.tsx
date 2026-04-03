import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { HomebaseInput } from "./travel-map-homebase-input";
import type { HomebaseEntry } from "./travel-map-utils";

const GEO_RESULTS = [
  {
    displayName: "Springfield, Illinois",
    city: "Springfield",
    countryCode: "US",
    latitude: 39.8,
    longitude: -89.6,
    placeId: null,
    address: null,
  },
  {
    displayName: "Paris, France",
    city: "Paris",
    countryCode: "FR",
    latitude: 48.8,
    longitude: 2.3,
    placeId: null,
    address: null,
  },
];

describe("HomebaseInput", () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => GEO_RESULTS,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the prompt overlay", () => {
    render(<HomebaseInput initialAddress="" onSelect={vi.fn()} onSkip={vi.fn()} />);
    expect(screen.getByTestId("homebase-prompt")).toBeInTheDocument();
    expect(screen.getByTestId("homebase-address-input")).toBeInTheDocument();
    expect(screen.getByTestId("homebase-skip")).toBeInTheDocument();
  });

  it("prefills the input with initialAddress", () => {
    render(<HomebaseInput initialAddress="Paris, France" onSelect={vi.fn()} onSkip={vi.fn()} />);
    expect(screen.getByTestId("homebase-address-input")).toHaveValue("Paris, France");
  });

  it("calls onSkip when Skip is clicked", async () => {
    const user = userEvent.setup();
    const onSkip = vi.fn();
    render(<HomebaseInput initialAddress="" onSelect={vi.fn()} onSkip={onSkip} />);
    await user.click(screen.getByTestId("homebase-skip"));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it("fetches suggestions after 300ms debounce when user types ≥3 chars", async () => {
    const user = userEvent.setup({ delay: null });
    render(<HomebaseInput initialAddress="" onSelect={vi.fn()} onSkip={vi.fn()} />);
    const input = screen.getByTestId("homebase-address-input");
    await user.type(input, "Spr");
    expect(global.fetch).not.toHaveBeenCalled();
    // Wait for debounce to trigger
    await waitFor(
      () => {
        expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining("q=Spr"));
      },
      { timeout: 500 }
    );
  });

  it("does not fetch when query is shorter than 3 chars", async () => {
    const user = userEvent.setup({ delay: null });
    render(<HomebaseInput initialAddress="" onSelect={vi.fn()} onSkip={vi.fn()} />);
    const input = screen.getByTestId("homebase-address-input");
    await user.type(input, "Sp");
    // Wait for debounce delay
    await new Promise((resolve) => setTimeout(resolve, 350));
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("shows suggestion dropdown after fetch resolves", async () => {
    const user = userEvent.setup({ delay: null });
    render(<HomebaseInput initialAddress="" onSelect={vi.fn()} onSkip={vi.fn()} />);
    const input = screen.getByTestId("homebase-address-input");
    await user.type(input, "Spr");
    await waitFor(() => expect(screen.getByTestId("homebase-suggestion-0")).toBeInTheDocument(), {
      timeout: 500,
    });
    expect(screen.getByTestId("homebase-suggestion-1")).toBeInTheDocument();
  });

  it("calls onSelect with correct HomebaseEntry when suggestion clicked", async () => {
    const user = userEvent.setup({ delay: null });
    const onSelect = vi.fn();
    render(<HomebaseInput initialAddress="" onSelect={onSelect} onSkip={vi.fn()} />);
    const input = screen.getByTestId("homebase-address-input");
    await user.type(input, "Spr");
    await waitFor(() => expect(screen.getByTestId("homebase-suggestion-0")).toBeInTheDocument(), {
      timeout: 500,
    });
    await user.click(screen.getByTestId("homebase-suggestion-0"));
    const expected: HomebaseEntry = {
      address: "Springfield, Illinois",
      city: "Springfield",
      countryCode: "US",
      lat: 39.8,
      lng: -89.6,
    };
    expect(onSelect).toHaveBeenCalledWith(expected);
  });

  it("does not call onSelect when result has null coordinates", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          displayName: "Nowhere",
          city: "Nowhere",
          countryCode: "US",
          latitude: null,
          longitude: null,
          placeId: null,
          address: null,
        },
      ],
    });
    const user = userEvent.setup({ delay: null });
    const onSelect = vi.fn();
    render(<HomebaseInput initialAddress="" onSelect={onSelect} onSkip={vi.fn()} />);
    const input = screen.getByTestId("homebase-address-input");
    await user.type(input, "Now");
    await waitFor(() => expect(screen.getByTestId("homebase-suggestion-0")).toBeInTheDocument(), {
      timeout: 500,
    });
    await user.click(screen.getByTestId("homebase-suggestion-0"));
    expect(onSelect).not.toHaveBeenCalled();
  });
});
