import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { PageSpinner } from "./page-spinner";

describe("PageSpinner", () => {
  it("renders the spinner container", () => {
    render(<PageSpinner />);
    expect(screen.getByTestId("page-spinner")).toBeInTheDocument();
  });
});
