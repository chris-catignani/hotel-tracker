import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { BookingPriceWatch } from "./booking-price-watch";

// Rooms designed so cash sort and award sort produce different orderings:
// cash asc: Standard ($150) < Penthouse ($300)
// award asc: Penthouse (5,000 pts) < Standard (25,000 pts)
const mockRoomsSortable = [
  {
    id: "rA-1",
    roomId: "room-A",
    roomName: "Penthouse Suite",
    ratePlanCode: "STAND",
    ratePlanName: "Standard Rate",
    cashPrice: 300,
    cashCurrency: "USD",
    awardPrice: null,
    isRefundable: "REFUNDABLE",
    isCorporate: false,
  },
  {
    id: "rA-2",
    roomId: "room-A",
    roomName: "Penthouse Suite",
    ratePlanCode: "AWD",
    ratePlanName: "Award Rate",
    cashPrice: null,
    cashCurrency: "USD",
    awardPrice: 5000,
    isRefundable: "NON_REFUNDABLE",
    isCorporate: false,
  },
  {
    id: "rB-1",
    roomId: "room-B",
    roomName: "Standard Room",
    ratePlanCode: "STAND",
    ratePlanName: "Standard Rate",
    cashPrice: 150,
    cashCurrency: "USD",
    awardPrice: null,
    isRefundable: "REFUNDABLE",
    isCorporate: false,
  },
  {
    id: "rB-2",
    roomId: "room-B",
    roomName: "Standard Room",
    ratePlanCode: "AWD",
    ratePlanName: "Award Rate",
    cashPrice: null,
    cashCurrency: "USD",
    awardPrice: 25000,
    isRefundable: "NON_REFUNDABLE",
    isCorporate: false,
  },
];

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
    isRefundable: "REFUNDABLE",
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
    isRefundable: "NON_REFUNDABLE",
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
    isRefundable: "NON_REFUNDABLE",
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
    isRefundable: "REFUNDABLE",
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
  propertyName: "Park Hyatt Chicago",
  hotelChainId: "chain-1",
  checkIn: "2026-05-01",
  checkOut: "2026-05-03",
  numNights: 2,
  totalCost: 480,
  currency: "USD",
  pointsRedeemed: null,
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
    render(<BookingPriceWatch {...defaultProps} initialWatchBooking={null} />);

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

    render(<BookingPriceWatch {...defaultProps} initialWatchBooking={initialWatchBooking} />);

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

    render(<BookingPriceWatch {...defaultProps} initialWatchBooking={initialWatchBooking} />);

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

    render(<BookingPriceWatch {...defaultProps} initialWatchBooking={initialWatchBooking} />);

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

    render(<BookingPriceWatch {...defaultProps} initialWatchBooking={initialWatchBooking} />);

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

    render(<BookingPriceWatch {...defaultProps} initialWatchBooking={initialWatchBooking} />);

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

    render(<BookingPriceWatch {...defaultProps} initialWatchBooking={initialWatchBooking} />);

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

    render(<BookingPriceWatch {...defaultProps} initialWatchBooking={initialWatchBooking} />);

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

    render(<BookingPriceWatch {...defaultProps} initialWatchBooking={initialWatchBooking} />);

    await waitFor(() => {
      expect(screen.getByTestId("toggle-room-rates")).toBeInTheDocument();
    });

    await user.click(screen.getByTestId("toggle-room-rates"));

    const groupRows = screen.getAllByTestId("room-group-row");
    expect(groupRows[0]).toHaveTextContent("12,000 pts"); // King Standard has award
    expect(groupRows[1]).toHaveTextContent("—"); // Double Standard has no award
  });

  it("shows inline award price on each cash rate row when every rate has both cash and award (Accor/GHA style)", async () => {
    const user = userEvent.setup();
    // Simulates Accor/GHA: every rate has both cashPrice and awardPrice; no pure-award rates
    const accorRooms = [
      {
        id: "a1",
        roomId: "room-A",
        roomName: "Superior Room",
        ratePlanCode: "ROOM|EUROPEAN_PLAN|NO_CANCELLATION",
        ratePlanName: "ADVANCE SAVER RATE",
        cashPrice: 113050,
        cashCurrency: "KRW",
        awardPrice: 1047,
        isRefundable: "NON_REFUNDABLE",
        isCorporate: false,
      },
      {
        id: "a2",
        roomId: "room-A",
        roomName: "Superior Room",
        ratePlanCode: "ROOM|EUROPEAN_PLAN|FREE_CANCELLATION",
        ratePlanName: "FLEXIBLE RATE",
        cashPrice: 133000,
        cashCurrency: "KRW",
        awardPrice: 1232,
        isRefundable: "REFUNDABLE",
        isCorporate: false,
      },
    ];
    const accorWatch = {
      ...mockWatch,
      snapshots: [
        {
          ...mockWatch.snapshots[0],
          lowestAwardPrice: 1047,
          rooms: accorRooms,
        },
      ],
    };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => accorWatch,
    } as Response);

    render(<BookingPriceWatch {...defaultProps} initialWatchBooking={initialWatchBooking} />);

    await waitFor(() => {
      expect(screen.getByTestId("toggle-room-rates")).toBeInTheDocument();
    });

    await user.click(screen.getByTestId("toggle-room-rates"));

    // Summary row: shows lowest REFUNDABLE/UNKNOWN award (1,232 pts for FLEXIBLE RATE),
    // not the overall cheapest (1,047 pts for the non-refundable ADVANCE SAVER RATE)
    const groupRows = screen.getAllByTestId("room-group-row");
    expect(groupRows[0]).toHaveTextContent("1,232 pts");

    await user.click(groupRows[0]);

    const rateRows = screen.getAllByTestId("room-rate-row");
    // Each cash rate row shows its own award price inline
    expect(rateRows[0]).toHaveTextContent("1,047 pts"); // ADVANCE SAVER (cheapest, non-refundable)
    expect(rateRows[1]).toHaveTextContent("1,232 pts"); // FLEXIBLE RATE (refundable)
    // No separate pure-award row added (only 2 rate rows total)
    expect(rateRows).toHaveLength(2);
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

    render(<BookingPriceWatch {...defaultProps} initialWatchBooking={initialWatchBooking} />);

    await waitFor(() => {
      expect(screen.getByTestId("latest-cash-price")).toBeInTheDocument();
    });

    expect(screen.queryByTestId("toggle-room-rates")).not.toBeInTheDocument();
  });

  it("shows no-data message when watch is enabled but has no snapshots", async () => {
    const watchNoSnapshots = { ...mockWatch, snapshots: [] };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => watchNoSnapshots,
    } as Response);

    render(<BookingPriceWatch {...defaultProps} initialWatchBooking={initialWatchBooking} />);

    await waitFor(() => {
      expect(
        screen.getByText(/Prices are checked automatically every morning/i)
      ).toBeInTheDocument();
    });

    expect(screen.queryByTestId("latest-cash-price")).not.toBeInTheDocument();
  });

  it("does not crash when snapshot rooms is undefined", async () => {
    const watchUndefinedRooms = {
      ...mockWatch,
      snapshots: [{ ...mockWatch.snapshots[0], rooms: undefined }],
    };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => watchUndefinedRooms,
    } as Response);

    render(<BookingPriceWatch {...defaultProps} initialWatchBooking={initialWatchBooking} />);

    await waitFor(() => {
      expect(screen.getByTestId("latest-cash-price")).toBeInTheDocument();
    });

    expect(screen.queryByTestId("toggle-room-rates")).not.toBeInTheDocument();
  });

  it("defaults to cash sort for a cash booking (pointsRedeemed=null)", async () => {
    const watchSortable = {
      ...mockWatch,
      snapshots: [{ ...mockWatch.snapshots[0], rooms: mockRoomsSortable }],
    };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => watchSortable,
    } as Response);
    const user = userEvent.setup();

    render(
      <BookingPriceWatch
        {...defaultProps}
        pointsRedeemed={null}
        initialWatchBooking={initialWatchBooking}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("toggle-room-rates")).toBeInTheDocument();
    });

    await user.click(screen.getByTestId("toggle-room-rates"));

    // cash asc: Standard ($150) first, Penthouse ($300) second
    const groupRows = screen.getAllByTestId("room-group-row");
    expect(groupRows[0]).toHaveTextContent("Standard Room");
    expect(groupRows[1]).toHaveTextContent("Penthouse Suite");
  });

  it("defaults to award sort for a points booking (pointsRedeemed>0)", async () => {
    const watchSortable = {
      ...mockWatch,
      snapshots: [{ ...mockWatch.snapshots[0], rooms: mockRoomsSortable }],
    };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => watchSortable,
    } as Response);
    const user = userEvent.setup();

    render(
      <BookingPriceWatch
        {...defaultProps}
        pointsRedeemed={12000}
        initialWatchBooking={initialWatchBooking}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("toggle-room-rates")).toBeInTheDocument();
    });

    await user.click(screen.getByTestId("toggle-room-rates"));

    // award asc: Penthouse (5,000 pts) first, Standard (25,000 pts) second
    const groupRows = screen.getAllByTestId("room-group-row");
    expect(groupRows[0]).toHaveTextContent("Penthouse Suite");
    expect(groupRows[1]).toHaveTextContent("Standard Room");
  });

  it("sorts room groups alphabetically when Room header is clicked", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockWatch,
    } as Response);
    const user = userEvent.setup();

    render(<BookingPriceWatch {...defaultProps} initialWatchBooking={initialWatchBooking} />);

    await waitFor(() => {
      expect(screen.getByTestId("toggle-room-rates")).toBeInTheDocument();
    });

    await user.click(screen.getByTestId("toggle-room-rates"));
    await waitFor(() => expect(screen.getAllByTestId("room-group-row")).toHaveLength(2));
    await user.click(screen.getByText(/^Room/));

    // alphabetical asc: Double Standard < King Standard
    const groupRows = screen.getAllByTestId("room-group-row");
    expect(groupRows[0]).toHaveTextContent("Double Standard");
    expect(groupRows[1]).toHaveTextContent("King Standard");
  });

  it("reverses sort direction when the active column header is clicked again", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockWatch,
    } as Response);
    const user = userEvent.setup();

    render(<BookingPriceWatch {...defaultProps} initialWatchBooking={initialWatchBooking} />);

    await waitFor(() => {
      expect(screen.getByTestId("toggle-room-rates")).toBeInTheDocument();
    });

    await user.click(screen.getByTestId("toggle-room-rates"));
    // Click Room header once → asc (Double Standard first)
    await user.click(screen.getByText(/^Room/));
    let groupRows = screen.getAllByTestId("room-group-row");
    expect(groupRows[0]).toHaveTextContent("Double Standard");

    // Click Room header again → desc (King Standard first)
    await user.click(screen.getByText(/^Room/));
    groupRows = screen.getAllByTestId("room-group-row");
    expect(groupRows[0]).toHaveTextContent("King Standard");
  });

  it("shows expanded cash rates sorted by price ascending (cheapest first)", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockWatch,
    } as Response);
    const user = userEvent.setup();

    render(<BookingPriceWatch {...defaultProps} initialWatchBooking={initialWatchBooking} />);

    await waitFor(() => {
      expect(screen.getByTestId("toggle-room-rates")).toBeInTheDocument();
    });

    await user.click(screen.getByTestId("toggle-room-rates"));

    // Find King Standard row and expand it
    const groupRows = screen.getAllByTestId("room-group-row");
    const kingRow = groupRows.find((r) => r.textContent?.includes("King Standard"))!;
    await user.click(kingRow);

    // King Standard has: r1-2 Non-refundable Rate ($220), r1-1 Standard Rate ($250), then award row
    const rateRows = screen.getAllByTestId("room-rate-row");
    expect(rateRows[0]).toHaveTextContent("Non-refundable Rate"); // $220 — cheapest cash
    expect(rateRows[1]).toHaveTextContent("Standard Rate"); // $250
    expect(rateRows[2]).toHaveTextContent("12,000 pts"); // award row last
  });

  describe("threshold input placeholders", () => {
    const renderEnabled = async (overrides: {
      totalCost?: number;
      numNights?: number;
      pointsRedeemed?: number | null;
    }) => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockWatch,
      } as Response);
      render(
        <BookingPriceWatch
          {...defaultProps}
          {...overrides}
          initialWatchBooking={initialWatchBooking}
        />
      );
      await waitFor(() => {
        expect(screen.getByTestId("cash-threshold-input")).toBeInTheDocument();
      });
    };

    it("shows per-night cash cost as placeholder for a cash-only booking", async () => {
      // totalCost=480, numNights=2 → 240/night; pointsRedeemed=null
      await renderEnabled({ totalCost: 480, numNights: 2, pointsRedeemed: null });
      expect(screen.getByTestId("cash-threshold-input")).toHaveAttribute(
        "placeholder",
        "240 (your cost/night)"
      );
      expect(screen.getByTestId("award-threshold-input")).toHaveAttribute(
        "placeholder",
        "e.g. 25000"
      );
    });

    it("shows per-night award cost as placeholder for an award-only booking", async () => {
      // totalCost=0, pointsRedeemed=30000, numNights=2 → 15,000 pts/night
      await renderEnabled({ totalCost: 0, numNights: 2, pointsRedeemed: 30000 });
      expect(screen.getByTestId("award-threshold-input")).toHaveAttribute(
        "placeholder",
        "15,000 (your cost/night)"
      );
      expect(screen.getByTestId("cash-threshold-input")).toHaveAttribute("placeholder", "e.g. 200");
    });

    it("shows default placeholders for a mixed cash+points booking", async () => {
      // both totalCost and pointsRedeemed > 0
      await renderEnabled({ totalCost: 200, numNights: 2, pointsRedeemed: 20000 });
      expect(screen.getByTestId("cash-threshold-input")).toHaveAttribute("placeholder", "e.g. 200");
      expect(screen.getByTestId("award-threshold-input")).toHaveAttribute(
        "placeholder",
        "e.g. 25000"
      );
    });
  });
});
