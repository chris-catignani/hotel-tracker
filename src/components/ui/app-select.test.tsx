import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { AppSelect } from "./app-select";

describe("AppSelect", () => {
  const options = [
    { label: "Banana", value: "banana" },
    { label: "Apple", value: "apple" },
    { label: "Cherry", value: "cherry" },
    { label: "None", value: "none" },
  ];

  it("renders correctly with placeholder", () => {
    render(
      <AppSelect value="" onValueChange={() => {}} options={options} placeholder="Pick a fruit" />
    );
    expect(screen.getByText("Pick a fruit")).toBeInTheDocument();
  });

  it("renders correctly with selected value", () => {
    render(<AppSelect value="apple" onValueChange={() => {}} options={options} />);
    expect(screen.getByText("Apple")).toBeInTheDocument();
  });

  it("sorts options alphabetically and keeps special options at top", async () => {
    const user = userEvent.setup();
    render(<AppSelect value="" onValueChange={() => {}} options={options} />);

    await user.click(screen.getByRole("combobox"));

    // Options in popover should be: None, Apple, Banana, Cherry
    const items = await waitFor(() => {
      const all = screen.getAllByRole("option");
      if (all.length < 4) throw new Error("Not all options loaded");
      return all;
    });
    const listLabels = items.map((el) => el.textContent?.trim());

    expect(listLabels).toEqual(["None", "Apple", "Banana", "Cherry"]);
  });

  it("calls onValueChange when an option is clicked", async () => {
    const handleChange = vi.fn();
    const user = userEvent.setup();
    render(<AppSelect value="" onValueChange={handleChange} options={options} />);

    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByText("Banana"));

    expect(handleChange).toHaveBeenCalledWith("banana");
  });

  it("filters options when searching", async () => {
    const manyOptions = Array.from({ length: 15 }, (_, i) => ({
      label: `Option ${i + 1}`,
      value: `opt-${i + 1}`,
    }));

    const user = userEvent.setup();
    render(
      <AppSelect
        value=""
        onValueChange={() => {}}
        options={manyOptions}
        searchPlaceholder="Search fruits"
      />
    );

    await user.click(screen.getByRole("combobox"));

    const searchInput = screen.getByPlaceholderText("Search fruits");
    await user.type(searchInput, "Option 10");

    expect(screen.getByText("Option 10")).toBeInTheDocument();
    expect(screen.queryByText("Option 1")).not.toBeInTheDocument();
  });

  it("passes through data-testid and other props", () => {
    render(
      <AppSelect
        value=""
        onValueChange={() => {}}
        options={options}
        data-testid="my-select"
        id="unique-id"
      />
    );

    const trigger = screen.getByTestId("my-select");
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveAttribute("id", "unique-id");
  });

  it("renders multiple selected values as badges", () => {
    render(
      <AppSelect
        multiple
        value={["apple", "banana"]}
        onValueChange={() => {}}
        options={options}
        placeholder="Pick fruits"
      />
    );

    expect(screen.getByText("Apple")).toBeInTheDocument();
    expect(screen.getByText("Banana")).toBeInTheDocument();
  });

  it("calls onValueChange with array of values in multi-select mode", async () => {
    const handleChange = vi.fn();
    const user = userEvent.setup();
    render(
      <AppSelect
        multiple
        value={["apple"]}
        onValueChange={handleChange}
        options={options}
        placeholder="Pick fruits"
      />
    );

    await user.click(screen.getByRole("combobox"));

    // Select Banana
    await user.click(screen.getByText("Banana"));
    expect(handleChange).toHaveBeenCalledWith(["apple", "banana"]);

    // Deselect Apple
    await user.click(
      screen.getAllByRole("option").find((el) => el.textContent?.includes("Apple"))!
    );
    expect(handleChange).toHaveBeenCalledWith([]);
  });
});
