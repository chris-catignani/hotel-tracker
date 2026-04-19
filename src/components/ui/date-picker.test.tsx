import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DatePicker } from "./date-picker";
import { format } from "date-fns";

vi.mock("@react-input/mask", () => ({
  InputMask: ({ component: _c, mask: _m, replacement: _r, ...props }: Record<string, unknown>) => (
    <input {...(props as React.InputHTMLAttributes<HTMLInputElement>)} />
  ),
}));

describe("DatePicker", () => {
  const mockSetDate = vi.fn();

  beforeEach(() => {
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

    const input = screen.getByTestId("date-picker-input") as HTMLInputElement;
    expect(input).toBeInTheDocument();

    await user.type(input, "02/24/26");
    expect(mockSetDate).toHaveBeenCalled();

    const calledDate = mockSetDate.mock.calls[mockSetDate.mock.calls.length - 1][0];
    expect(format(calledDate, "yyyy-MM-dd")).toBe("2026-02-24");
  });

  it("clears a stale date when input becomes incomplete while typing", async () => {
    const user = userEvent.setup();
    const initialDate = new Date(2026, 1, 24);
    render(<DatePicker date={initialDate} setDate={mockSetDate} />);

    const input = screen.getByTestId("date-picker-input") as HTMLInputElement;
    await user.type(input, "02/24");

    const validDateCalls = mockSetDate.mock.calls.filter(([d]) => d instanceof Date);
    expect(validDateCalls).toHaveLength(0);
    expect(mockSetDate).toHaveBeenLastCalledWith(undefined);
  });

  it("renders a button on mobile", async () => {
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

    expect(screen.queryByTestId("date-picker-input")).not.toBeInTheDocument();
    expect(screen.getByTestId("date-picker-trigger")).toBeInTheDocument();
  });

  it("clears the date when input is cleared", async () => {
    const user = userEvent.setup();
    const initialDate = new Date(2026, 1, 24);
    render(<DatePicker date={initialDate} setDate={mockSetDate} />);

    const input = screen.getByTestId("date-picker-input") as HTMLInputElement;
    await user.clear(input);

    expect(mockSetDate).toHaveBeenCalledWith(undefined);
  });
});
