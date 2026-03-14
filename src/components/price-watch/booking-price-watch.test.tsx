import { render, screen, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { BookingPriceWatch } from "./booking-price-watch";

const mockRooms = [
  {
    id: "r1-1",
    roomId: "room-1",
    roomName: "King Standard",
    ratePlanCode: "STAND",
    ratePlanName: "Standard Rate",
    cashPrice: 250,
    cashCurrency: "USD",
    awardPrice: null,
    isRefundable: true,
    isCorporate: false,
  },
  {
    id: "r1-2",
    roomId: "room-1",
    roomName: "King Standard",
    ratePlanCode: "NREF",
    ratePlanName: "Non-refundable Rate",
    cashPrice: 220,
    cashCurrency: "USD",
    awardPrice: null,
    isRefundable: false,
    isCorporate: false,
  },
  {
    id: "r1-3",
    roomId: "room-1",
    roomName: "King Standard",
    ratePlanCode: "AWD",
    ratePlanName: "Award Rate",
    cashPrice: null,
    cashCurrency: "USD",
    awardPrice: 12000,
    isRefundable: false,
    isCorporate: false,
  },
  {
    id: "r2-1",
    roomId: "room-2",
    roomName: "Double Standard",
    ratePlanCode: "STAND",
    ratePlanName: "Standard Rate",
    cashPrice: 280,
    cashCurrency: "USD",
    awardPrice: null,
    isRefundable: true,
    isCorporate: false,
  },
];

const mockWatch = {
  id: "watch-1",
  isEnabled: true,
  lastCheckedAt: "2026-03-14T00:00:00Z",
  property: { id: "prop-1", name: "Grand Hyatt", chainPropertyId: "GRDHYT" },
  snapshots: [
    {
      id: "snap-1",
      checkIn: "2026-05-01",
      checkOut: "2026-05-03",
      lowestRefundableCashPrice: 250,
      lowestRefundableCashCurrency: "USD",
      lowestAwardPrice: 12000,
      fetchedAt: "2026-03-14T10:00:00Z",
      source: "hyatt_browser",
      rooms: mockRooms,
    },
  ],
};

const defaultProps = {
  bookingId: "booking-1",
  propertyId: "prop-1",
  hotelChainId: "chain-1",
  checkIn: "2026-05-01",
  checkOut: "2026-05-03",
  totalCost: 480,
  currency: "USD",
};

const initialWatchBooking = {
  id: "pwb-1",
  priceWatchId: "watch-1",
  cashThreshold: null,
  awardThreshold: null,
  dateFlexibilityDays: 0,
};

describe("BookingPriceWatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders with toggle off when no watch exists", async () => {
    await act(async () => {
      render(<BookingPriceWatch {...defaultProps} initialWatchBooking={null} />);
    });

    const toggle = screen.getByTestId("price-watch-toggle");
    expect(toggle).toBeInTheDocument();
    expect(toggle).toHaveAttribute("data-state", "unchecked");
    expect(screen.queryByTestId("latest-cash-price")).not.toBeInTheDocument();
  });

  it("loads watch data on mount and shows latest cash and award prices", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockWatch,
    } as Response);

    await act(async () => {
      render(<BookingPriceWatch {...defaultProps} initialWatchBooking={initialWatchBooking} />);
    });

    await waitFor(() => {
      expect(screen.getByTestId("latest-cash-price")).toBeInTheDocument();
    });

    expect(screen.getByTestId("latest-cash-price")).toHaveTextContent("$250");
    expect(screen.getByTestId("latest-award-price")).toHaveTextContent("12,000 pts");
  });

  it("shows room rates toggle button with correct room type count", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockWatch,
    } as Response);

    await act(async () => {
      render(<BookingPriceWatch {...defaultProps} initialWatchBooking={initialWatchBooking} />);
    });

    await waitFor(() => {
      expect(screen.getByTestId("toggle-room-rates")).toBeInTheDocument();
    });

    expect(screen.getByTestId("toggle-room-rates")).toHaveTextContent(
      "All room rates (2 room types)"
    );
  });

  it("expands room rates table when toggle clicked and collapses on second click", async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockWatch,
    } as Response);

    await act(async () => {
      render(<BookingPriceWatch {...defaultProps} initialWatchBooking={initialWatchBooking} />);
    });

    await waitFor(() => {
      expect(screen.getByTestId("toggle-room-rates")).toBeInTheDocument();
    });

    expect(screen.queryAllByTestId("room-group-row")).toHaveLength(0);

    await user.click(screen.getByTestId("toggle-room-rates"));

    const groupRows = screen.getAllByTestId("room-group-row");
    expect(groupRows).toHaveLength(2);
    expect(screen.getByText("King Standard")).toBeInTheDocument();
    expect(screen.getByText("Double Standard")).toBeInTheDocument();

    // Collapse
    await user.click(screen.getByTestId("toggle-room-rates"));
    expect(screen.queryAllByTestId("room-group-row")).toHaveLength(0);
  });

  it("expands a room group row to show rate plan rows", async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockWatch,
    } as Response);

    await act(async () => {
      render(<BookingPriceWatch {...defaultProps} initialWatchBooking={initialWatchBooking} />);
    });

    await waitFor(() => {
      expect(screen.getByTestId("toggle-room-rates")).toBeInTheDocument();
    });

    await user.click(screen.getByTestId("toggle-room-rates"));
    expect(screen.queryAllByTestId("room-rate-row")).toHaveLength(0);

    // Expand the first room group (King Standard — 2 cash rates + 1 award row)
    await user.click(screen.getAllByTestId("room-group-row")[0]);
    expect(screen.getAllByTestId("room-rate-row")).toHaveLength(3);
  });

  it("collapses a room group when clicked again", async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockWatch,
    } as Response);

    await act(async () => {
      render(<BookingPriceWatch {...defaultProps} initialWatchBooking={initialWatchBooking} />);
    });

    await waitFor(() => {
      expect(screen.getByTestId("toggle-room-rates")).toBeInTheDocument();
    });

    await user.click(screen.getByTestId("toggle-room-rates"));
    await user.click(screen.getAllByTestId("room-group-row")[0]);
    expect(screen.getAllByTestId("room-rate-row")).toHaveLength(3);

    await user.click(screen.getAllByTestId("room-group-row")[0]);
    expect(screen.queryAllByTestId("room-rate-row")).toHaveLength(0);
  });

  it("shows Refundable and Non-refundable badges in expanded rate rows", async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockWatch,
    } as Response);

    await act(async () => {
      render(<BookingPriceWatch {...defaultProps} initialWatchBooking={initialWatchBooking} />);
    });

    await waitFor(() => {
      expect(screen.getByTestId("toggle-room-rates")).toBeInTheDocument();
    });

    await user.click(screen.getByTestId("toggle-room-rates"));
    await user.click(screen.getAllByTestId("room-group-row")[0]);

    expect(screen.getByText("Refundable")).toBeInTheDocument();
    expect(screen.getByText("Non-refundable")).toBeInTheDocument();
  });

  it("shows award rate row in expanded room with award price", async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockWatch,
    } as Response);

    await act(async () => {
      render(<BookingPriceWatch {...defaultProps} initialWatchBooking={initialWatchBooking} />);
    });

    await waitFor(() => {
      expect(screen.getByTestId("toggle-room-rates")).toBeInTheDocument();
    });

    await user.click(screen.getByTestId("toggle-room-rates"));
    await user.click(screen.getAllByTestId("room-group-row")[0]);

    expect(screen.getByText("Award Rate")).toBeInTheDocument();
    // Award price appears in the rate row (distinct from summary row)
    const rateRows = screen.getAllByTestId("room-rate-row");
    const awardRow = rateRows[rateRows.length - 1];
    expect(awardRow).toHaveTextContent("12,000 pts");
  });

  it("shows award price in room group summary row and dash when no award", async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockWatch,
    } as Response);

    await act(async () => {
      render(<BookingPriceWatch {...defaultProps} initialWatchBooking={initialWatchBooking} />);
    });

    await waitFor(() => {
      expect(screen.getByTestId("toggle-room-rates")).toBeInTheDocument();
    });

    await user.click(screen.getByTestId("toggle-room-rates"));

    const groupRows = screen.getAllByTestId("room-group-row");
    expect(groupRows[0]).toHaveTextContent("12,000 pts"); // King Standard has award
    expect(groupRows[1]).toHaveTextContent("—"); // Double Standard has no award
  });

  it("does not show room rates toggle when snapshot has no rooms", async () => {
    const watchNoRooms = {
      ...mockWatch,
      snapshots: [{ ...mockWatch.snapshots[0], rooms: [] }],
    };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => watchNoRooms,
    } as Response);

    await act(async () => {
      render(<BookingPriceWatch {...defaultProps} initialWatchBooking={initialWatchBooking} />);
    });

    await waitFor(() => {
      expect(screen.getByTestId("latest-cash-price")).toBeInTheDocument();
    });

    expect(screen.queryByTestId("toggle-room-rates")).not.toBeInTheDocument();
  });

  it("shows 'No price data yet' when watch is enabled but has no snapshots", async () => {
    const watchNoSnapshots = { ...mockWatch, snapshots: [] };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => watchNoSnapshots,
    } as Response);

    await act(async () => {
      render(<BookingPriceWatch {...defaultProps} initialWatchBooking={initialWatchBooking} />);
    });

    await waitFor(() => {
      expect(screen.getByText(/No price data yet/i)).toBeInTheDocument();
    });

    expect(screen.queryByTestId("latest-cash-price")).not.toBeInTheDocument();
  });
});
