import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { ConfirmDialog } from "./confirm-dialog";

describe("ConfirmDialog", () => {
  it("renders with title, description, and buttons", async () => {
    await act(async () => {
      render(
        <ConfirmDialog
          open={true}
          onOpenChange={vi.fn()}
          title="Delete Item?"
          description="This action cannot be undone."
          onConfirm={vi.fn()}
        />
      );
    });

    expect(screen.getByText("Delete Item?")).toBeInTheDocument();
    expect(screen.getByText("This action cannot be undone.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(screen.getByTestId("confirm-dialog-confirm-button")).toHaveTextContent("Delete");
  });

  it("renders custom confirmLabel", async () => {
    await act(async () => {
      render(
        <ConfirmDialog
          open={true}
          onOpenChange={vi.fn()}
          title="Confirm?"
          description="Are you sure?"
          onConfirm={vi.fn()}
          confirmLabel="Yes, remove it"
        />
      );
    });

    expect(screen.getByTestId("confirm-dialog-confirm-button")).toHaveTextContent("Yes, remove it");
  });

  it("calls onConfirm when confirm button is clicked", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    await act(async () => {
      render(
        <ConfirmDialog
          open={true}
          onOpenChange={vi.fn()}
          title="Delete?"
          description="Sure?"
          onConfirm={onConfirm}
        />
      );
    });

    await user.click(screen.getByTestId("confirm-dialog-confirm-button"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("calls onOpenChange(false) when Cancel is clicked", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    await act(async () => {
      render(
        <ConfirmDialog
          open={true}
          onOpenChange={onOpenChange}
          title="Delete?"
          description="Sure?"
          onConfirm={vi.fn()}
        />
      );
    });

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("does not render content when closed", async () => {
    await act(async () => {
      render(
        <ConfirmDialog
          open={false}
          onOpenChange={vi.fn()}
          title="Delete Item?"
          description="This action cannot be undone."
          onConfirm={vi.fn()}
        />
      );
    });

    expect(screen.queryByText("Delete Item?")).not.toBeInTheDocument();
  });
});
