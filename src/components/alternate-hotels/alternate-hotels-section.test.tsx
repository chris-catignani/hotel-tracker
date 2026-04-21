import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { AlternateHotelsSection } from "./alternate-hotels-section";

vi.mock("@/lib/api-fetch", () => ({
  apiFetch: vi.fn(),
}));
import { apiFetch } from "@/lib/api-fetch";

describe("AlternateHotelsSection", () => {
  const baseProps = {
    bookingId: "b1",
    hotelChainId: "cwizlxi70wnbaq3qehma0fhbz",
    bookingPropertyId: "p0",
    bookingPropertyName: "Anchor",
  };

  beforeEach(() => {
    vi.resetAllMocks();
    (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      data: [
        {
          propertyId: "p1",
          name: "Alternate A",
          distanceMiles: 3.2,
          hotelChainId: "cwizlxi70wnbaq3qehma0fhbz",
          chainCategories: [],
        },
      ],
    });
  });

  it("is collapsed by default, expanding on click loads candidates", async () => {
    render(<AlternateHotelsSection {...baseProps} />);
    expect(screen.queryByText("Alternate A")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("alternate-hotels-toggle"));

    await waitFor(() => expect(screen.getByText("Alternate A")).toBeInTheDocument());
    expect(apiFetch).toHaveBeenCalledWith(expect.stringContaining("/api/bookings/b1/alternates?"));
  });

  it("shows empty-state when the API returns no candidates", async () => {
    (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, data: [] });
    render(<AlternateHotelsSection {...baseProps} />);
    fireEvent.click(screen.getByTestId("alternate-hotels-toggle"));
    await waitFor(() => expect(screen.getByTestId("alternate-hotels-empty")).toBeInTheDocument());
  });
});
