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
    address: "Springfield, Sangamon County, Illinois, United States",
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

const SAVED_ENTRY: HomebaseEntry = {
  address: "123 Main St, Chicago, Illinois, United States",
  city: "Chicago",
  countryCode: "US",
  lat: 41.8,
  lng: -87.6,
};

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

  it("renders the prompt overlay with Done button", () => {
    render(<HomebaseInput initialEntry={null} onSelect={vi.fn()} />);
    expect(screen.getByTestId("homebase-prompt")).toBeInTheDocument();
    expect(screen.getByTestId("homebase-address-input")).toBeInTheDocument();
    expect(screen.getByTestId("homebase-done")).toBeInTheDocument();
  });

  it("prefills the input with the saved entry address", () => {
    render(<HomebaseInput initialEntry={SAVED_ENTRY} onSelect={vi.fn()} />);
    expect(screen.getByTestId("homebase-address-input")).toHaveValue(SAVED_ENTRY.address);
  });

  it("Done button is enabled when initialEntry is provided", () => {
    render(<HomebaseInput initialEntry={SAVED_ENTRY} onSelect={vi.fn()} />);
    expect(screen.getByTestId("homebase-done")).not.toBeDisabled();
  });

  it("Done button is disabled when no entry is provided and no suggestion selected", () => {
    render(<HomebaseInput initialEntry={null} onSelect={vi.fn()} />);
    expect(screen.getByTestId("homebase-done")).toBeDisabled();
  });

  it("clicking Done with saved entry calls onSelect without needing a new selection", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<HomebaseInput initialEntry={SAVED_ENTRY} onSelect={onSelect} />);
    await user.click(screen.getByTestId("homebase-done"));
    expect(onSelect).toHaveBeenCalledWith(SAVED_ENTRY);
  });

  it("typing (non-empty) clears the selected entry and disables Done", async () => {
    const user = userEvent.setup({ delay: null });
    render(<HomebaseInput initialEntry={SAVED_ENTRY} onSelect={vi.fn()} />);
    const input = screen.getByTestId("homebase-address-input");
    await user.clear(input);
    await user.type(input, "new");
    expect(screen.getByTestId("homebase-done")).toBeDisabled();
  });

  it("clearing the input enables Done when there was a saved entry", async () => {
    const user = userEvent.setup({ delay: null });
    render(<HomebaseInput initialEntry={SAVED_ENTRY} onSelect={vi.fn()} />);
    const input = screen.getByTestId("homebase-address-input");
    await user.clear(input);
    expect(screen.getByTestId("homebase-done")).not.toBeDisabled();
  });

  it("clicking Done with cleared input calls onSelect with null", async () => {
    const user = userEvent.setup({ delay: null });
    const onSelect = vi.fn();
    render(<HomebaseInput initialEntry={SAVED_ENTRY} onSelect={onSelect} />);
    const input = screen.getByTestId("homebase-address-input");
    await user.clear(input);
    await user.click(screen.getByTestId("homebase-done"));
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it("clearing the input keeps Done disabled when there was no saved entry", () => {
    render(<HomebaseInput initialEntry={null} onSelect={vi.fn()} />);
    // Input starts empty, Done should stay disabled
    expect(screen.getByTestId("homebase-done")).toBeDisabled();
  });

  it("fetches suggestions after 300ms debounce when user types ≥3 chars", async () => {
    const user = userEvent.setup({ delay: null });
    render(<HomebaseInput initialEntry={null} onSelect={vi.fn()} />);
    const input = screen.getByTestId("homebase-address-input");
    await user.type(input, "Spr");
    expect(global.fetch).not.toHaveBeenCalled();
    await waitFor(
      () => {
        expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining("q=Spr"));
      },
      { timeout: 500 }
    );
  });

  it("does not fetch when query is shorter than 3 chars", async () => {
    const user = userEvent.setup({ delay: null });
    render(<HomebaseInput initialEntry={null} onSelect={vi.fn()} />);
    const input = screen.getByTestId("homebase-address-input");
    await user.type(input, "Sp");
    await new Promise((resolve) => setTimeout(resolve, 350));
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("shows suggestion dropdown after fetch resolves", async () => {
    const user = userEvent.setup({ delay: null });
    render(<HomebaseInput initialEntry={null} onSelect={vi.fn()} />);
    const input = screen.getByTestId("homebase-address-input");
    await user.type(input, "Spr");
    await waitFor(() => expect(screen.getByTestId("homebase-suggestion-0")).toBeInTheDocument(), {
      timeout: 500,
    });
    expect(screen.getByTestId("homebase-suggestion-1")).toBeInTheDocument();
  });

  it("selecting a suggestion fills input with full address and enables Done", async () => {
    const user = userEvent.setup({ delay: null });
    render(<HomebaseInput initialEntry={null} onSelect={vi.fn()} />);
    const input = screen.getByTestId("homebase-address-input");
    await user.type(input, "Spr");
    await waitFor(() => expect(screen.getByTestId("homebase-suggestion-0")).toBeInTheDocument(), {
      timeout: 500,
    });
    await user.click(screen.getByTestId("homebase-suggestion-0"));
    expect(input).toHaveValue("Springfield, Sangamon County, Illinois, United States");
    expect(screen.getByTestId("homebase-done")).not.toBeDisabled();
  });

  it("selecting a suggestion does not immediately call onSelect", async () => {
    const user = userEvent.setup({ delay: null });
    const onSelect = vi.fn();
    render(<HomebaseInput initialEntry={null} onSelect={onSelect} />);
    const input = screen.getByTestId("homebase-address-input");
    await user.type(input, "Spr");
    await waitFor(() => expect(screen.getByTestId("homebase-suggestion-0")).toBeInTheDocument(), {
      timeout: 500,
    });
    await user.click(screen.getByTestId("homebase-suggestion-0"));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("calls onSelect with full address when Done is clicked after suggestion selected", async () => {
    const user = userEvent.setup({ delay: null });
    const onSelect = vi.fn();
    render(<HomebaseInput initialEntry={null} onSelect={onSelect} />);
    const input = screen.getByTestId("homebase-address-input");
    await user.type(input, "Spr");
    await waitFor(() => expect(screen.getByTestId("homebase-suggestion-0")).toBeInTheDocument(), {
      timeout: 500,
    });
    await user.click(screen.getByTestId("homebase-suggestion-0"));
    await user.click(screen.getByTestId("homebase-done"));
    const expected: HomebaseEntry = {
      address: "Springfield, Sangamon County, Illinois, United States",
      city: "Springfield",
      countryCode: "US",
      lat: 39.8,
      lng: -89.6,
    };
    expect(onSelect).toHaveBeenCalledWith(expected);
  });

  it("falls back to displayName when result.address is null", async () => {
    const user = userEvent.setup({ delay: null });
    const onSelect = vi.fn();
    render(<HomebaseInput initialEntry={null} onSelect={onSelect} />);
    const input = screen.getByTestId("homebase-address-input");
    await user.type(input, "Par");
    await waitFor(() => expect(screen.getByTestId("homebase-suggestion-1")).toBeInTheDocument(), {
      timeout: 500,
    });
    await user.click(screen.getByTestId("homebase-suggestion-1"));
    await user.click(screen.getByTestId("homebase-done"));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ address: "Paris, France" }));
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
    render(<HomebaseInput initialEntry={null} onSelect={onSelect} />);
    const input = screen.getByTestId("homebase-address-input");
    await user.type(input, "Now");
    await waitFor(() => expect(screen.getByTestId("homebase-suggestion-0")).toBeInTheDocument(), {
      timeout: 500,
    });
    await user.click(screen.getByTestId("homebase-suggestion-0"));
    expect(screen.getByTestId("homebase-done")).toBeDisabled();
    expect(onSelect).not.toHaveBeenCalled();
  });
});
