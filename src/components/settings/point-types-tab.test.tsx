import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PointTypesTab } from "./point-types-tab";

const mockPt = [
  {
    id: "1",
    name: "Marriott Points",
    category: "hotel",
    usdCentsPerPoint: 0.007,
    programCurrency: null,
    programCentsPerPoint: null,
  },
];

describe("PointTypesTab", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it("renders basic UI elements", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => [],
    } as Response);

    render(<PointTypesTab />);

    expect(screen.getByText("Point Types")).toBeInTheDocument();
    expect(screen.getByTestId("add-point-type-button")).toBeInTheDocument();
  });

  it("shows empty state message", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => [],
    } as Response);

    render(<PointTypesTab />);

    expect(await screen.findByTestId("point-types-empty")).toBeInTheDocument();
    expect(screen.getByText(/No point types/i)).toBeInTheDocument();
    expect(screen.getByText(/Define point values/i)).toBeInTheDocument();
  });

  it("renders fetched point types", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => mockPt,
    } as Response);

    render(<PointTypesTab />);

    // Verify it appears in both views
    const mobileView = await screen.findByTestId("point-types-mobile");
    const desktopView = screen.getByTestId("point-types-desktop");

    expect(within(mobileView).getByText("Marriott Points")).toBeInTheDocument();
    expect(within(desktopView).getByText("Marriott Points")).toBeInTheDocument();
  });

  it("opens confirmation dialog when Delete is clicked", async () => {
    const user = userEvent.setup();
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => mockPt,
    } as Response);

    render(<PointTypesTab />);

    const desktopView = await screen.findByTestId("point-types-desktop");
    const deleteBtn = within(desktopView).getByRole("button", { name: "Delete" });
    await user.click(deleteBtn);

    expect(screen.getByText("Delete Point Type?")).toBeInTheDocument();
    expect(
      screen.getByText(/Are you sure you want to delete "Marriott Points"/)
    ).toBeInTheDocument();
  });

  it("calls DELETE API and refreshes list after confirming", async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .mocked(global.fetch)
      .mockImplementation((input: string | Request | URL, options?: RequestInit) => {
        const url = input instanceof Request ? input.url : input.toString();
        if (url === "/api/point-types" && (!options?.method || options.method === "GET"))
          return Promise.resolve({ ok: true, json: async () => mockPt } as Response);
        if (url === "/api/point-types/1" && options?.method === "DELETE")
          return Promise.resolve({ ok: true } as Response);
        return Promise.reject(new Error(`Unknown: ${url}`));
      });

    render(<PointTypesTab />);

    const desktopView = await screen.findByTestId("point-types-desktop");
    const deleteBtn = within(desktopView).getByRole("button", { name: "Delete" });
    await user.click(deleteBtn);

    await user.click(screen.getByTestId("confirm-dialog-confirm-button"));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/point-types/1",
      expect.objectContaining({ method: "DELETE" })
    );
  });

  it("does not call DELETE if dialog is cancelled", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => mockPt,
    } as Response);

    render(<PointTypesTab />);

    const desktopView = await screen.findByTestId("point-types-desktop");
    const deleteBtn = within(desktopView).getByRole("button", { name: "Delete" });
    await user.click(deleteBtn);

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    const deleteCalls = fetchMock.mock.calls.filter(([, opts]) => opts?.method === "DELETE");
    expect(deleteCalls.length).toBe(0);
  });

  it("sends programCurrency and programCentsPerPoint when adding a foreign-currency point type", async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .mocked(global.fetch)
      .mockImplementation((input: string | Request | URL, options?: RequestInit) => {
        const url = input instanceof Request ? input.url : input.toString();
        if (url === "/api/point-types" && (!options?.method || options.method === "GET"))
          return Promise.resolve({ ok: true, json: async () => [] } as Response);
        if (url === "/api/point-types" && options?.method === "POST")
          return Promise.resolve({
            ok: true,
            json: async () => ({ id: "new", name: "Accor ALL" }),
          } as Response);
        return Promise.reject(new Error(`Unknown: ${url}`));
      });

    render(<PointTypesTab />);

    await user.click(screen.getByTestId("add-point-type-button"));

    await user.type(screen.getByLabelText("Name *"), "Accor ALL");
    await user.type(screen.getByLabelText(/USD Value per Point/i), "0.022");
    await user.click(screen.getByTestId("pt-foreign-currency-checkbox"));
    await user.type(screen.getByTestId("pt-program-currency"), "EUR");
    await user.type(screen.getByTestId("pt-program-cpp"), "0.02");

    await user.click(screen.getByRole("button", { name: "Save" }));

    const postCall = fetchMock.mock.calls.find(([, opts]) => opts?.method === "POST");
    expect(postCall).toBeDefined();
    const body = JSON.parse(postCall![1]!.body as string);
    expect(body.usdCentsPerPoint).toBe(0.022);
    expect(body.programCurrency).toBe("EUR");
    expect(body.programCentsPerPoint).toBe(0.02);
  });

  it("shows program currency alongside USD value for non-USD point types", async () => {
    const foreignPt = [
      {
        id: "2",
        name: "Accor ALL",
        category: "hotel",
        usdCentsPerPoint: 0.022,
        programCurrency: "EUR",
        programCentsPerPoint: 0.02,
      },
    ];

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => foreignPt,
    } as Response);

    render(<PointTypesTab />);

    const desktopView = await screen.findByTestId("point-types-desktop");
    expect(within(desktopView).getByText(/EUR/)).toBeInTheDocument();
    expect(within(desktopView).getByText(/0.02/)).toBeInTheDocument();
  });
});
