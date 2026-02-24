import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { EmptyState } from "./empty-state";
import { Search } from "lucide-react";

describe("EmptyState", () => {
  it("renders title and description", () => {
    render(
      <EmptyState
        icon={Search}
        title="No results found"
        description="Try adjusting your filters or search terms."
      />
    );

    expect(screen.getByText("No results found")).toBeInTheDocument();
    expect(screen.getByText("Try adjusting your filters or search terms.")).toBeInTheDocument();
  });

  it("renders action button and handles clicks", async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();

    render(
      <EmptyState
        icon={Search}
        title="No results found"
        description="Try adjusting your filters or search terms."
        action={{
          label: "Clear Search",
          onClick: handleClick,
        }}
      />
    );

    const button = screen.getByRole("button", { name: "Clear Search" });
    await user.click(button);

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("renders link action correctly", () => {
    render(
      <EmptyState
        icon={Search}
        title="No results found"
        description="Try adjusting your filters or search terms."
        action={{
          label: "Go Home",
          href: "/",
        }}
      />
    );

    const link = screen.getByRole("link", { name: "Go Home" });
    expect(link).toHaveAttribute("href", "/");
  });

  it("applies custom className", () => {
    const { container } = render(
      <EmptyState icon={Search} title="Title" description="Description" className="custom-class" />
    );

    expect(container.firstChild).toHaveClass("custom-class");
  });
});
