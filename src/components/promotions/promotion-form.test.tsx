import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PromotionForm } from "./promotion-form";
import { PromotionFormData } from "@/lib/types";

// Mock fetch for the component
global.fetch = vi.fn();

describe("PromotionForm", () => {
  beforeEach(() => {
    vi.mocked(global.fetch).mockImplementation((url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr === "/api/hotel-chains")
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) } as Response);
      if (urlStr === "/api/credit-cards")
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) } as Response);
      if (urlStr === "/api/portals")
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) } as Response);
      return Promise.reject(new Error("Unknown API"));
    });
  });

  it("renders registration fields when restriction is added via picker", async () => {
    const user = userEvent.setup();
    render(
      <PromotionForm
        onSubmit={async () => {}}
        submitting={false}
        title="Test"
        description="Test"
        submitLabel="Submit"
      />
    );

    // Registration fields should not be visible before adding the restriction
    expect(screen.queryByLabelText(/Registration Deadline/i)).toBeNull();

    // Open the picker and add Registration & Validity
    await user.click(screen.getByTestId("restriction-picker-button"));
    await user.click(screen.getByTestId("restriction-option-registration"));

    expect(screen.getByLabelText(/Registration Deadline/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Validity Duration \(Days\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Your Registration Date/i)).toBeInTheDocument();
  });

  it("submits the renamed validDaysAfterRegistration field", async () => {
    const handleSubmit = vi.fn();
    const user = userEvent.setup();
    render(
      <PromotionForm
        onSubmit={handleSubmit}
        submitting={false}
        title="Test"
        description="Test"
        submitLabel="Submit"
        initialData={{
          hotelChainId: "dummy-chain",
        }}
      />
    );

    // Fill in required fields
    await user.type(screen.getByLabelText(/Name/i), "Summer Promo");

    // Open the picker and add Registration & Validity restriction
    await user.click(screen.getByTestId("restriction-picker-button"));
    await user.click(screen.getByTestId("restriction-option-registration"));

    // Fill in the validity duration field
    const validityInput = screen.getByLabelText(/Validity Duration \(Days\)/i);
    await user.type(validityInput, "90");

    // Fill in benefit value (required)
    const benefitValueInput = screen.getByTestId("benefit-value-0");
    await user.type(benefitValueInput, "100");

    // Submit
    await user.click(screen.getByTestId("promotion-form-submit"));

    expect(handleSubmit).toHaveBeenCalled();
    const submittedData = handleSubmit.mock.calls[0][0] as PromotionFormData;
    expect(submittedData.restrictions?.validDaysAfterRegistration).toBe("90");
  });
});
