import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PromotionForm } from "./promotion-form";
import { PromotionFormData } from "@/lib/types";

// Mock fetch for the component
global.fetch = vi.fn();

describe("PromotionForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(global.fetch).mockImplementation((url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr === "/api/hotel-chains")
        return Promise.resolve({ json: () => Promise.resolve([]) } as Response);
      if (urlStr === "/api/credit-cards")
        return Promise.resolve({ json: () => Promise.resolve([]) } as Response);
      if (urlStr === "/api/portals")
        return Promise.resolve({ json: () => Promise.resolve([]) } as Response);
      return Promise.reject(new Error("Unknown API"));
    });
  });

  it("renders registration fields when restriction is added via picker", () => {
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
    fireEvent.click(screen.getByTestId("restriction-picker-button"));
    fireEvent.click(screen.getByTestId("restriction-option-registration"));

    expect(screen.getByLabelText(/Registration Deadline/i)).toBeDefined();
    expect(screen.getByLabelText(/Validity Duration \(Days\)/i)).toBeDefined();
    expect(screen.getByLabelText(/Your Registration Date/i)).toBeDefined();
  });

  it("submits the renamed validDaysAfterRegistration field", async () => {
    const handleSubmit = vi.fn();
    render(
      <PromotionForm
        onSubmit={handleSubmit}
        submitting={false}
        title="Test"
        description="Test"
        submitLabel="Submit"
      />
    );

    // Fill in required fields
    fireEvent.change(screen.getByLabelText(/Name/i), { target: { value: "Summer Promo" } });

    // Open the picker and add Registration & Validity restriction
    fireEvent.click(screen.getByTestId("restriction-picker-button"));
    fireEvent.click(screen.getByTestId("restriction-option-registration"));

    // Fill in the validity duration field
    const validityInput = screen.getByLabelText(/Validity Duration \(Days\)/i);
    fireEvent.change(validityInput, { target: { value: "90" } });

    // Fill in benefit value (required)
    const benefitValueInput = screen.getByTestId("benefit-value-0");
    fireEvent.change(benefitValueInput, { target: { value: "100" } });

    // Submit
    fireEvent.click(screen.getByTestId("promotion-form-submit"));

    expect(handleSubmit).toHaveBeenCalled();
    const submittedData = handleSubmit.mock.calls[0][0] as PromotionFormData;
    expect(submittedData.restrictions?.validDaysAfterRegistration).toBe("90");
  });
});
