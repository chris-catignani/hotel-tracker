import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { ErrorBanner } from "./error-banner";

describe("ErrorBanner", () => {
  it("should return null when error is null", async () => {
    let container: HTMLElement;
    await act(async () => {
      const result = render(<ErrorBanner error={null} onDismiss={() => {}} />);
      container = result.container;
    });
    expect(container!.firstChild).toBeNull();
  });

  it("should render error message when provided", async () => {
    const errorMsg = "Something went wrong";
    await act(async () => {
      render(<ErrorBanner error={errorMsg} onDismiss={() => {}} />);
    });
    expect(screen.getByTestId("error-banner")).toBeInTheDocument();
    expect(screen.getByText(errorMsg)).toBeInTheDocument();
  });

  it("should call onDismiss when close button is clicked", async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    await act(async () => {
      render(<ErrorBanner error="Error" onDismiss={onDismiss} />);
    });

    const closeButton = screen.getByRole("button", { name: /dismiss/i });
    await user.click(closeButton);

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
