import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { CurrencyCombobox } from "./currency-combobox";

describe("CurrencyCombobox", () => {
  it("shows 'Select currency' when no value is set", () => {
    render(<CurrencyCombobox value="" onValueChange={() => {}} />);
    expect(screen.getByRole("combobox")).toHaveTextContent("Select currency");
  });

  it("displays the selected currency code and name", () => {
    render(<CurrencyCombobox value="EUR" onValueChange={() => {}} />);
    expect(screen.getByRole("combobox")).toHaveTextContent("EUR — Euro");
  });

  it("opens the dropdown when the trigger is clicked", async () => {
    const user = userEvent.setup();
    render(<CurrencyCombobox value="USD" onValueChange={() => {}} />);

    await user.click(screen.getByRole("combobox"));

    expect(screen.getByPlaceholderText("Search currency or country...")).toBeInTheDocument();
  });

  it("filters by currency code", async () => {
    const user = userEvent.setup();
    render(<CurrencyCombobox value="USD" onValueChange={() => {}} />);

    await user.click(screen.getByRole("combobox"));
    await user.type(screen.getByPlaceholderText("Search currency or country..."), "JPY");

    await waitFor(() => {
      expect(screen.getByText("Japanese Yen")).toBeInTheDocument();
      expect(screen.queryByText("Euro")).not.toBeInTheDocument();
    });
  });

  it("filters by country/currency name", async () => {
    const user = userEvent.setup();
    render(<CurrencyCombobox value="USD" onValueChange={() => {}} />);

    await user.click(screen.getByRole("combobox"));
    await user.type(screen.getByPlaceholderText("Search currency or country..."), "Swiss");

    await waitFor(() => {
      expect(screen.getByText("Swiss Franc")).toBeInTheDocument();
      expect(screen.queryByText("Euro")).not.toBeInTheDocument();
    });
  });

  it("shows 'No results.' when search matches nothing", async () => {
    const user = userEvent.setup();
    render(<CurrencyCombobox value="USD" onValueChange={() => {}} />);

    await user.click(screen.getByRole("combobox"));
    await user.type(screen.getByPlaceholderText("Search currency or country..."), "zzznomatch");

    await waitFor(() => {
      expect(screen.getByText("No results.")).toBeInTheDocument();
    });
  });

  it("calls onValueChange with the selected currency code", async () => {
    const handleChange = vi.fn();
    const user = userEvent.setup();
    render(<CurrencyCombobox value="USD" onValueChange={handleChange} />);

    await user.click(screen.getByRole("combobox"));
    await user.type(screen.getByPlaceholderText("Search currency or country..."), "SGD");

    const option = await screen.findByText("Singapore Dollar");
    await user.click(option);

    expect(handleChange).toHaveBeenCalledWith("SGD");
  });

  it("closes the dropdown after selecting a currency", async () => {
    const user = userEvent.setup();
    render(<CurrencyCombobox value="USD" onValueChange={() => {}} />);

    await user.click(screen.getByRole("combobox"));
    const input = screen.getByPlaceholderText("Search currency or country...");
    await user.type(input, "GBP");

    const option = await screen.findByText("British Pound");
    await user.click(option);

    await waitFor(() => {
      expect(
        screen.queryByPlaceholderText("Search currency or country...")
      ).not.toBeInTheDocument();
    });
  });

  it("passes data-testid to the trigger button", () => {
    render(
      <CurrencyCombobox value="USD" onValueChange={() => {}} data-testid="my-currency-combobox" />
    );
    expect(screen.getByTestId("my-currency-combobox")).toBeInTheDocument();
  });
});
