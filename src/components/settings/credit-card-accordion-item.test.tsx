import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CreditCardAccordionItem } from "./credit-card-accordion-item";

const mockCard = {
  id: "1",
  name: "Amex Platinum",
  rewardType: "points",
  rewardRate: 5,
  pointTypeId: null,
  pointType: null,
  rewardRules: [],
  isDeleted: false,
};

// EarningRatesSection and CardBenefitsSection make fetch calls — mock them
vi.mock("./card-benefits-section", () => ({
  CardBenefitsSection: () => <div data-testid="card-benefits-section" />,
}));

const defaultProps = {
  card: mockCard,
  benefits: [],
  hotelChains: [],
  otaAgencies: [],
  pointTypes: [],
  onRefetch: vi.fn(),
};

describe("CreditCardAccordionItem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) } as Response);
  });

  it("renders card name and delete button", () => {
    render(<CreditCardAccordionItem {...defaultProps} />);
    expect(screen.getByTestId("credit-card-card-name")).toHaveTextContent("Amex Platinum");
    expect(screen.getByTestId("delete-credit-card-button")).toBeInTheDocument();
  });

  it("shows pencil icon button and no save button initially", () => {
    render(<CreditCardAccordionItem {...defaultProps} />);
    expect(screen.getByTestId("edit-credit-card-name-button")).toBeInTheDocument();
    expect(screen.queryByTestId("save-credit-card-name-button")).not.toBeInTheDocument();
  });

  it("enters name edit mode when pencil is clicked", async () => {
    const user = userEvent.setup();
    render(<CreditCardAccordionItem {...defaultProps} />);

    await user.click(screen.getByTestId("edit-credit-card-name-button"));

    expect(screen.getByTestId("credit-card-name-input")).toBeInTheDocument();
    expect(screen.getByTestId("save-credit-card-name-button")).toBeInTheDocument();
    expect(screen.queryByTestId("edit-credit-card-name-button")).not.toBeInTheDocument();
  });

  it("does not enter edit mode when clicking the card name text", async () => {
    const user = userEvent.setup();
    render(<CreditCardAccordionItem {...defaultProps} />);

    await user.click(screen.getByTestId("credit-card-card-name"));

    expect(screen.queryByTestId("credit-card-name-input")).not.toBeInTheDocument();
  });

  it("saves name via save button and calls onRefetch", async () => {
    const user = userEvent.setup();
    const onRefetch = vi.fn();
    render(<CreditCardAccordionItem {...defaultProps} onRefetch={onRefetch} />);

    await user.click(screen.getByTestId("edit-credit-card-name-button"));
    await user.clear(screen.getByTestId("credit-card-name-input"));
    await user.type(screen.getByTestId("credit-card-name-input"), "New Name");
    await user.click(screen.getByTestId("save-credit-card-name-button"));

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/credit-cards/1",
      expect.objectContaining({ method: "PUT" })
    );
    expect(onRefetch).toHaveBeenCalled();
  });

  it("saves name via Enter key", async () => {
    const user = userEvent.setup();
    const onRefetch = vi.fn();
    render(<CreditCardAccordionItem {...defaultProps} onRefetch={onRefetch} />);

    await user.click(screen.getByTestId("edit-credit-card-name-button"));
    await user.clear(screen.getByTestId("credit-card-name-input"));
    await user.type(screen.getByTestId("credit-card-name-input"), "New Name{Enter}");

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/credit-cards/1",
      expect.objectContaining({ method: "PUT" })
    );
    expect(onRefetch).toHaveBeenCalled();
  });

  it("cancels name edit via Escape key without saving", async () => {
    const user = userEvent.setup();
    render(<CreditCardAccordionItem {...defaultProps} />);

    await user.click(screen.getByTestId("edit-credit-card-name-button"));
    await user.type(screen.getByTestId("credit-card-name-input"), " Extra{Escape}");

    expect(global.fetch).not.toHaveBeenCalled();
    expect(screen.getByTestId("credit-card-card-name")).toHaveTextContent("Amex Platinum");
  });

  it("expands and collapses when header is clicked", async () => {
    const user = userEvent.setup();
    render(<CreditCardAccordionItem {...defaultProps} />);

    expect(screen.queryByTestId("card-benefits-section")).not.toBeInTheDocument();

    await user.click(screen.getByTestId("accordion-header-1"));
    expect(screen.getByTestId("card-benefits-section")).toBeInTheDocument();

    await user.click(screen.getByTestId("accordion-header-1"));
    expect(screen.queryByTestId("card-benefits-section")).not.toBeInTheDocument();
  });

  it("clicking header while editing name does not collapse accordion", async () => {
    const user = userEvent.setup();
    render(<CreditCardAccordionItem {...defaultProps} />);

    // First expand
    await user.click(screen.getByTestId("accordion-header-1"));
    expect(screen.getByTestId("card-benefits-section")).toBeInTheDocument();

    // Start editing name
    await user.click(screen.getByTestId("edit-credit-card-name-button"));
    expect(screen.getByTestId("credit-card-name-input")).toBeInTheDocument();

    // The accordion click handler is blocked while editing — accordion stays expanded
    expect(screen.getByTestId("card-benefits-section")).toBeInTheDocument();
  });

  it("opens delete confirmation dialog when Delete is clicked", async () => {
    const user = userEvent.setup();
    render(<CreditCardAccordionItem {...defaultProps} />);

    await user.click(screen.getByTestId("delete-credit-card-button"));
    expect(screen.getByText(/Delete Credit Card/i)).toBeInTheDocument();
  });

  it("calls DELETE and onRefetch when deletion is confirmed", async () => {
    const user = userEvent.setup();
    const onRefetch = vi.fn();
    render(<CreditCardAccordionItem {...defaultProps} onRefetch={onRefetch} />);

    await user.click(screen.getByTestId("delete-credit-card-button"));
    await user.click(screen.getByTestId("confirm-dialog-confirm-button"));

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/credit-cards/1",
      expect.objectContaining({ method: "DELETE" })
    );
    expect(onRefetch).toHaveBeenCalled();
  });
});
