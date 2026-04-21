import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { WatchAlternateModal } from "./watch-alternate-modal";

vi.mock("@/lib/api-fetch", () => ({
  apiFetch: vi.fn(),
}));
import { apiFetch } from "@/lib/api-fetch";

describe("WatchAlternateModal", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, data: { id: "pw1" } });
  });

  it("posts thresholds to /api/price-watches and calls onSaved", async () => {
    const onSaved = vi.fn();
    render(
      <WatchAlternateModal
        bookingId="b1"
        property={{ id: "p1", name: "Alt" }}
        onClose={() => {}}
        onSaved={onSaved}
      />
    );
    fireEvent.change(screen.getByTestId("alt-cash-threshold"), { target: { value: "200" } });
    fireEvent.change(screen.getByTestId("alt-award-threshold"), { target: { value: "30000" } });
    fireEvent.click(screen.getByTestId("alt-save-button"));

    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
    expect(apiFetch).toHaveBeenCalledWith("/api/price-watches", {
      method: "POST",
      body: {
        propertyId: "p1",
        isEnabled: true,
        bookingId: "b1",
        cashThreshold: 200,
        awardThreshold: 30000,
        dateFlexibilityDays: 0,
      },
    });
    expect(onSaved).toHaveBeenCalled();
  });
});
