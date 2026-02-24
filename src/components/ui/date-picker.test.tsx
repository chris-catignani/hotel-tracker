import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DatePicker } from "./date-picker";
import { format } from "date-fns";

// Mock matchMedia
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: query.includes("min-width: 768px"), // Default to desktop if query matches
    media: query,
    onchange: null,
    addListener: vi.fn(), // Deprecated
    removeListener: vi.fn(), // Deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

describe("DatePicker", () => {
  const mockSetDate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(window.matchMedia).mockImplementation((query) => ({
      matches: query.includes("min-width: 768px"),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });

  it("renders an input on desktop and allows typing", async () => {
    const user = userEvent.setup();
    render(<DatePicker date={undefined} setDate={mockSetDate} />);

    const input = screen.getByPlaceholderText("MM/DD/YYYY") as HTMLInputElement;
    expect(input).toBeInTheDocument();

    await user.type(input, "02/24/2026");
    expect(mockSetDate).toHaveBeenCalled();

    // Check if the final date passed to setDate is correct
    const calledDate = mockSetDate.mock.calls[mockSetDate.mock.calls.length - 1][0];
    expect(format(calledDate, "yyyy-MM-dd")).toBe("2026-02-24");
  });

  it("auto-formats MMDDYYYY typing", async () => {
    const user = userEvent.setup();
    render(<DatePicker date={undefined} setDate={mockSetDate} />);

    const input = screen.getByPlaceholderText("MM/DD/YYYY") as HTMLInputElement;
    await user.type(input, "02242026");

    expect(input.value).toBe("02/24/2026");
    expect(mockSetDate).toHaveBeenCalled();
    const calledDate = mockSetDate.mock.calls[mockSetDate.mock.calls.length - 1][0];
    expect(format(calledDate, "yyyy-MM-dd")).toBe("2026-02-24");
  });

  it("auto-formats MMDDYY typing", async () => {
    const user = userEvent.setup();
    render(<DatePicker date={undefined} setDate={mockSetDate} />);

    const input = screen.getByPlaceholderText("MM/DD/YYYY") as HTMLInputElement;
    await user.type(input, "022426");

    expect(input.value).toBe("02/24/26");
    expect(mockSetDate).toHaveBeenCalled();
    const calledDate = mockSetDate.mock.calls[mockSetDate.mock.calls.length - 1][0];
    // date-fns parse with 'yy' will assume current century
    expect(format(calledDate, "MM/dd/yy")).toBe("02/24/26");
  });

  it("renders a button on mobile", async () => {
    // Override matchMedia to return false for desktop
    vi.mocked(window.matchMedia).mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    render(<DatePicker date={undefined} setDate={mockSetDate} />);

    expect(screen.queryByPlaceholderText("MM/DD/YYYY")).not.toBeInTheDocument();
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("clears the date when input is cleared", async () => {
    const user = userEvent.setup();
    const initialDate = new Date(2026, 1, 24);
    render(<DatePicker date={initialDate} setDate={mockSetDate} />);

    const input = screen.getByDisplayValue("02/24/2026") as HTMLInputElement;
    await user.clear(input);

    expect(mockSetDate).toHaveBeenCalledWith(undefined);
  });
});
