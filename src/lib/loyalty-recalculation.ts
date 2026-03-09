import prisma from "@/lib/prisma";
import { calculatePoints } from "./loyalty-utils";
import { reevaluateBookings } from "./promotion-matching";

/**
 * Re-calculates loyalty points for all upcoming bookings of a specific hotel chain.
 * This is triggered when the chain's base rate or the user's status for that chain changes.
 */
export async function recalculateLoyaltyForHotelChain(
  hotelChainId: string,
  userId: string
): Promise<void> {
  // 1. Fetch chain and its current user status/elite details
  const hotelChain = await prisma.hotelChain.findUnique({
    where: { id: hotelChainId },
    include: {
      userStatuses: {
        where: { userId },
        include: {
          eliteStatus: true,
        },
        take: 1,
      },
    },
  });

  if (!hotelChain) return;

  // 2. Find all past bookings for this chain and user (where exchangeRate is locked in)
  // Future bookings have exchangeRate = null; their loyalty is computed dynamically at read time
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const bookings = await prisma.booking.findMany({
    where: {
      hotelChainId,
      userId,
      checkIn: {
        lte: today,
      },
    },
    select: {
      id: true,
      pretaxCost: true,
      currency: true,
      exchangeRate: true,
    },
  });

  if (bookings.length === 0) return;

  // 3. Prepare update operations using USD pretax cost (native × exchangeRate)
  const bookingIds = bookings.map((b) => b.id);
  const userStatus = hotelChain.userStatuses[0] ?? null;

  // Pre-fetch current rates for any non-USD currencies in this batch (single query)
  const nonUsdCurrencies = [...new Set(bookings.map((b) => b.currency).filter((c) => c !== "USD"))];
  const rateCache = new Map<string, number>();
  if (nonUsdCurrencies.length > 0) {
    const ratesFromDb = await prisma.exchangeRate.findMany({
      where: { fromCurrency: { in: nonUsdCurrencies }, toCurrency: "USD" },
    });
    for (const row of ratesFromDb) rateCache.set(row.fromCurrency, Number(row.rate));
  }

  const updateOperations = bookings.map((booking) => {
    const rate =
      booking.currency === "USD"
        ? 1
        : ((booking.exchangeRate ? Number(booking.exchangeRate) : null) ??
          rateCache.get(booking.currency) ??
          1);
    const usdPretax = Number(booking.pretaxCost) * rate;
    const newPoints = calculatePoints({
      pretaxCost: usdPretax,
      basePointRate: hotelChain.basePointRate ? Number(hotelChain.basePointRate) : null,
      eliteStatus: userStatus?.eliteStatus,
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
