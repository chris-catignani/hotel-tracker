import prisma from "@/lib/prisma";
import { calculatePoints } from "./loyalty-utils";
import { reevaluateBookings } from "./promotion-matching";

/**
 * Re-calculates loyalty points for all upcoming bookings of a specific hotel chain.
 * This is triggered when the chain's base rate or the user's status for that chain changes.
 */
export async function recalculateLoyaltyForHotelChain(hotelChainId: number): Promise<void> {
  // 1. Fetch chain and its current user status/elite details
  const hotelChain = await prisma.hotelChain.findUnique({
    where: { id: hotelChainId },
    include: {
      userStatus: {
        include: {
          eliteStatus: true
        }
      }
    }
  });

  if (!hotelChain) return;

  // 2. Find all future bookings for this chain
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const bookings = await prisma.booking.findMany({
    where: {
      hotelChainId,
      checkIn: {
        gte: today
      }
    },
    select: {
      id: true,
      pretaxCost: true
    }
  });

  if (bookings.length === 0) return;

  // 3. Prepare update operations
  const bookingIds = bookings.map(b => b.id);
  const updateOperations = bookings.map(booking => {
    const newPoints = calculatePoints({
      pretaxCost: Number(booking.pretaxCost),
      basePointRate: hotelChain.basePointRate ? Number(hotelChain.basePointRate) : null,
      eliteStatus: hotelChain.userStatus?.eliteStatus,
    });
    return prisma.booking.update({
      where: { id: booking.id },
      data: { loyaltyPointsEarned: newPoints },
    });
  });

  // 4. Use a transaction to ensure all bookings are updated atomically and improve performance.
  await prisma.$transaction(updateOperations);

  // 5. Re-evaluate promotions (especially points multipliers) for these bookings
  // Since we changed the base points, any 2x/3x multipliers need their appliedValue updated
  await reevaluateBookings(bookingIds);
}
