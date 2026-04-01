// src/components/settings/settings-crud-tab.test.tsx
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { Building2 } from "lucide-react";
import { SettingsCrudTab } from "./settings-crud-tab";

type Item = { id: string; name: string };

const emptyState = {
  icon: Building2,
  title: "No items",
  description: "Add some items.",
};

const baseColumns = [{ header: "Name", render: (item: Item) => item.name }];

function makeProps(overrides: Partial<Parameters<typeof SettingsCrudTab<Item>>[0]> = {}) {
  const onSubmit = vi.fn().mockResolvedValue(true);
  const fetchItems = vi.fn().mockResolvedValue([]);
  return {
    title: "Things",
    addButtonLabel: "Add Thing",
    addButtonTestId: "add-thing-button",
    fetchItems,
    columns: baseColumns,
    renderMobileCard: (item: Item) => <div data-testid="mobile-card">{item.name}</div>,
    addDialog: {
      title: "Add Thing",
      renderFields: () => <input data-testid="add-name" />,
      onSubmit,
      isValid: true,
    },
    emptyState,
    testIds: { list: "things-desktop", empty: "things-empty" },
    ...overrides,
  } satisfies Parameters<typeof SettingsCrudTab<Item>>[0];
}

describe("SettingsCrudTab", () => {
  it("calls fetchItems on mount", async () => {
    const fetchItems = vi.fn().mockResolvedValue([]);
    render(<SettingsCrudTab {...makeProps({ fetchItems })} />);
    await waitFor(() => expect(fetchItems).toHaveBeenCalledTimes(1));
  });

  it("renders title and add button", async () => {
    render(<SettingsCrudTab {...makeProps()} />);
    expect(screen.getByText("Things")).toBeInTheDocument();
    expect(screen.getByTestId("add-thing-button")).toBeInTheDocument();
  });

  it("shows EmptyState when items is empty", async () => {
    render(<SettingsCrudTab {...makeProps()} />);
    expect(await screen.findByTestId("things-empty")).toBeInTheDocument();
    expect(screen.getByText("No items")).toBeInTheDocument();
  });

  it("shows desktop table with data when items exist", async () => {
    const items: Item[] = [{ id: "1", name: "Alpha" }];
    render(<SettingsCrudTab {...makeProps({ fetchItems: vi.fn().mockResolvedValue(items) })} />);
    const desktop = await screen.findByTestId("things-desktop");
    expect(within(desktop).getByText("Alpha")).toBeInTheDocument();
  });

  it("shows mobile cards with data", async () => {
    const items: Item[] = [{ id: "1", name: "Alpha" }];
    render(<SettingsCrudTab {...makeProps({ fetchItems: vi.fn().mockResolvedValue(items) })} />);
    expect(await screen.findByTestId("mobile-card")).toBeInTheDocument();
  });

  it("opens add dialog when add button is clicked", async () => {
    const user = userEvent.setup();
    render(<SettingsCrudTab {...makeProps()} />);
    await user.click(screen.getByTestId("add-thing-button"));
    expect(screen.getByText("Add Thing")).toBeInTheDocument();
    expect(screen.getByTestId("add-name")).toBeInTheDocument();
  });

  it("calls onSubmit and refetches on successful add", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(true);
    const fetchItems = vi.fn().mockResolvedValue([]);
    render(
      <SettingsCrudTab
        {...makeProps({ addDialog: { ...makeProps().addDialog, onSubmit }, fetchItems })}
      />
    );
    await user.click(screen.getByTestId("add-thing-button"));
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(fetchItems).toHaveBeenCalledTimes(2));
  });

  it("does not close add dialog when onSubmit returns false", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(false);
    render(
      <SettingsCrudTab {...makeProps({ addDialog: { ...makeProps().addDialog, onSubmit } })} />
    );
    await user.click(screen.getByTestId("add-thing-button"));
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId("add-name")).toBeInTheDocument(); // dialog still open
  });

  it("calls editDialog.onOpen with item and opens edit dialog", async () => {
    const user = userEvent.setup();
    const items: Item[] = [{ id: "1", name: "Alpha" }];
    const onOpen = vi.fn();
    const props = makeProps({
      fetchItems: vi.fn().mockResolvedValue(items),
      editDialog: {
        title: "Edit Thing",
        renderFields: () => <input data-testid="edit-name" />,
        onSubmit: vi.fn().mockResolvedValue(true),
        isValid: true,
        onOpen,
      },
    });
    render(<SettingsCrudTab {...props} />);
    const desktop = await screen.findByTestId("things-desktop");
    await user.click(within(desktop).getByRole("button", { name: "Edit" }));
    expect(onOpen).toHaveBeenCalledWith(items[0]);
    expect(screen.getByTestId("edit-name")).toBeInTheDocument();
  });

  it("calls deleteDialog.onOpen with item and shows confirm dialog", async () => {
    const user = userEvent.setup();
    const items: Item[] = [{ id: "1", name: "Alpha" }];
    const onOpen = vi.fn();
    const props = makeProps({
      fetchItems: vi.fn().mockResolvedValue(items),
      deleteDialog: {
        getTitle: () => "Delete Thing?",
        getDescription: (item) => `Delete "${item.name}"?`,
        onConfirm: vi.fn().mockResolvedValue(undefined),
        onOpen,
      },
    });
    render(<SettingsCrudTab {...props} />);
    const desktop = await screen.findByTestId("things-desktop");
    await user.click(within(desktop).getByRole("button", { name: "Delete" }));
    expect(onOpen).toHaveBeenCalledWith(items[0]);
    expect(screen.getByText("Delete Thing?")).toBeInTheDocument();
    expect(screen.getByText('Delete "Alpha"?')).toBeInTheDocument();
  });

  it("calls deleteDialog.onConfirm and refetches after confirm", async () => {
    const user = userEvent.setup();
    const items: Item[] = [{ id: "1", name: "Alpha" }];
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const fetchItems = vi.fn().mockResolvedValue(items);
    const props = makeProps({
      fetchItems,
      deleteDialog: {
        getTitle: () => "Delete Thing?",
        getDescription: (item) => `Delete "${item.name}"?`,
        onConfirm,
        onOpen: vi.fn(),
      },
    });
    render(<SettingsCrudTab {...props} />);
    const desktop = await screen.findByTestId("things-desktop");
    await user.click(within(desktop).getByRole("button", { name: "Delete" }));
    await user.click(screen.getByTestId("confirm-dialog-confirm-button"));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(fetchItems).toHaveBeenCalledTimes(2));
  });

  it("shows error banner when fetchItems throws", async () => {
    const fetchItems = vi.fn().mockRejectedValue(new Error("Load failed"));
    render(<SettingsCrudTab {...makeProps({ fetchItems })} />);
    expect(await screen.findByText("Load failed")).toBeInTheDocument();
  });

  it("calls fetchDependencies before fetchItems on mount", async () => {
    const calls: string[] = [];
    const fetchDependencies = vi.fn().mockImplementation(async () => {
      calls.push("deps");
    });
    const fetchItems = vi.fn().mockImplementation(async () => {
      calls.push("items");
      return [];
    });
    render(<SettingsCrudTab {...makeProps({ fetchDependencies, fetchItems })} />);
    await waitFor(() => expect(calls).toEqual(["deps", "items"]));
  });
});
