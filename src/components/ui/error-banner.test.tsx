import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ErrorBanner } from "./error-banner";

describe("ErrorBanner", () => {
  it("should return null when error is null", () => {
    const { container } = render(<ErrorBanner error={null} onDismiss={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it("should render error message when provided", () => {
    const errorMsg = "Something went wrong";
    render(<ErrorBanner error={errorMsg} onDismiss={() => {}} />);
    expect(screen.getByTestId("error-banner")).toBeInTheDocument();
    expect(screen.getByText(errorMsg)).toBeInTheDocument();
  });

  it("should call onDismiss when close button is clicked", () => {
    const onDismiss = vi.fn();
    render(<ErrorBanner error="Error" onDismiss={onDismiss} />);

    const closeButton = screen.getByRole("button", { name: /dismiss/i });
    fireEvent.click(closeButton);

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
