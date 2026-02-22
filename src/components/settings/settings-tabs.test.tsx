import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import SettingsPage from "@/app/settings/page";

// Mock the components inside the tabs to avoid deep rendering complexity
vi.mock("./user-status-tab", () => ({
  UserStatusTab: () => <div data-testid="mock-user-status" />,
}));
vi.mock("./point-types-tab", () => ({
  PointTypesTab: () => <div data-testid="mock-point-types" />,
}));
vi.mock("./hotel-chains-tab", () => ({
  HotelChainsTab: () => <div data-testid="mock-hotel-chains" />,
}));
vi.mock("./credit-cards-tab", () => ({
  CreditCardsTab: () => <div data-testid="mock-credit-cards" />,
}));
vi.mock("./shopping-portals-tab", () => ({
  ShoppingPortalsTab: () => <div data-testid="mock-portals" />,
}));
vi.mock("./ota-agencies-tab", () => ({
  OtaAgenciesTab: () => <div data-testid="mock-ota-agencies" />,
}));

describe("SettingsPage Tabs", () => {
  it("renders all tab contents with correct data-testids", () => {
    render(<SettingsPage />);

    expect(screen.getByTestId("tab-my-status")).toBeInTheDocument();
    expect(screen.getByTestId("tab-point-types")).toBeInTheDocument();
    expect(screen.getByTestId("tab-hotels")).toBeInTheDocument();
    expect(screen.getByTestId("tab-credit-cards")).toBeInTheDocument();
    expect(screen.getByTestId("tab-portals")).toBeInTheDocument();
    expect(screen.getByTestId("tab-ota-agencies")).toBeInTheDocument();
  });

  it("initially shows the my-status tab content", () => {
    render(<SettingsPage />);
    expect(screen.getByTestId("mock-user-status")).toBeInTheDocument();
  });
});
