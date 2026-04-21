import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { WatchAlternateModal } from "./watch-alternate-modal";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/lib/api-fetch", () => ({
  apiFetch: vi.fn(),
}));
import { apiFetch } from "@/lib/api-fetch";
import { toast } from "sonner";

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
        currency="USD"
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
      },
    });
    expect(onSaved).toHaveBeenCalledWith({
      priceWatchId: "pw1",
      cashThreshold: 200,
      awardThreshold: 30000,
    });
  });

  it("shows a validation error when no threshold is set", async () => {
    render(
      <WatchAlternateModal
        bookingId="b1"
        property={{ id: "p1", name: "Alt" }}
        currency="USD"
        onClose={() => {}}
        onSaved={vi.fn()}
      />
    );
    fireEvent.click(screen.getByTestId("alt-save-button"));
    expect(screen.getByTestId("alt-validation-error")).toBeInTheDocument();
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("shows an error toast when the API call fails", async () => {
    (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, data: null });
    render(
      <WatchAlternateModal
        bookingId="b1"
        property={{ id: "p1", name: "Alt" }}
        currency="USD"
        onClose={() => {}}
        onSaved={vi.fn()}
      />
    );
    fireEvent.change(screen.getByTestId("alt-cash-threshold"), { target: { value: "100" } });
    fireEvent.click(screen.getByTestId("alt-save-button"));
    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
    expect(toast.error).toHaveBeenCalledWith("Failed to watch this alternate. Please try again.");
    await waitFor(() => expect(screen.getByTestId("alt-save-button")).not.toBeDisabled());
  });
});
