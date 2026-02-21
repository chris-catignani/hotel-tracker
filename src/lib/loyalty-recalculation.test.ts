import { describe, it, expect, vi, beforeEach } from 'vitest';
import { recalculateLoyaltyForChain } from './loyalty-recalculation';
import prisma from './prisma';
import { reevaluateBookings } from './promotion-matching';

// Mock the dependencies
vi.mock('./prisma', () => ({
  default: {
    hotelChain: {
      findUnique: vi.fn(),
    },
    booking: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('./promotion-matching', () => ({
  reevaluateBookings: vi.fn(),
}));

describe('loyalty-recalculation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should recalculate points and trigger promotion re-evaluation', async () => {
    // 1. Mock the hotel chain (Base rate: 10, Status bonus: 50%)
    const mockChain = {
      id: 1,
      basePointRate: 10,
      userStatus: {
        eliteStatus: {
          name: 'Platinum',
          bonusPercentage: 0.5,
          isFixed: false,
          fixedRate: null,
        }
      }
    };
    (prisma.hotelChain.findUnique as any).mockResolvedValue(mockChain);

    // 2. Mock future bookings (Today is mocked to be a fixed date in logic, 
    // but here we just return what findMany would return)
    const mockBookings = [
      { id: 101, pretaxCost: 100 }, // Expected: 100 * 10 * 1.5 = 1500
      { id: 102, pretaxCost: 200 }, // Expected: 200 * 10 * 1.5 = 3000
    ];
    (prisma.booking.findMany as any).mockResolvedValue(mockBookings);

    // 3. Run the recalculation
    await recalculateLoyaltyForChain(1);

    // 4. Verify updates
    expect(prisma.booking.update).toHaveBeenCalledTimes(2);
    expect(prisma.booking.update).toHaveBeenCalledWith({
      where: { id: 101 },
      data: { loyaltyPointsEarned: 1500 }
    });
    expect(prisma.booking.update).toHaveBeenCalledWith({
      where: { id: 102 },
      data: { loyaltyPointsEarned: 3000 }
    });

    // 5. Verify promotion re-evaluation was triggered for both bookings
    expect(reevaluateBookings).toHaveBeenCalledWith([101, 102]);
  });

  it('should return early if chain not found', async () => {
    (prisma.hotelChain.findUnique as any).mockResolvedValue(null);
    await recalculateLoyaltyForChain(1);
    expect(prisma.booking.findMany).not.toHaveBeenCalled();
  });

  it('should return early if no future bookings found', async () => {
    (prisma.hotelChain.findUnique as any).mockResolvedValue({ id: 1 });
    (prisma.booking.findMany as any).mockResolvedValue([]);
    await recalculateLoyaltyForChain(1);
    expect(prisma.booking.update).not.toHaveBeenCalled();
    expect(reevaluateBookings).not.toHaveBeenCalled();
  });
});
