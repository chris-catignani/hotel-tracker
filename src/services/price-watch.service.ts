import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { AppError } from "@/lib/app-error";
import { PRICE_WATCH_PRIORITY } from "@/lib/constants";

// ---------------------------------------------------------------------------
// Include constants
// ---------------------------------------------------------------------------

const BOOKING_SELECT = {
  id: true,
  propertyId: true,
  property: { select: { name: true } },
  checkIn: true,
  checkOut: true,
  numNights: true,
  totalCost: true,
  currency: true,
  hotelChain: { select: { name: true } },
} as const;

const PROPERTY_INCLUDE = {
  include: { hotelChain: { select: { name: true } } },
} as const;

/** Used by listPriceWatches — latest snapshot only, no room ordering */
const PRICE_WATCH_LIST_INCLUDE = {
  property: PROPERTY_INCLUDE,
  bookings: {
    include: { booking: { select: BOOKING_SELECT } },
  },
  snapshots: {
    orderBy: { fetchedAt: "desc" as const },
    take: 1,
    include: { rooms: true },
  },
} as const;

/** Used by getPriceWatch / upsertPriceWatch / updatePriceWatch — last 5 snapshots with room ordering */
const PRICE_WATCH_DETAIL_INCLUDE = {
  property: PROPERTY_INCLUDE,
  bookings: {
    include: { booking: { select: BOOKING_SELECT } },
  },
  snapshots: {
    orderBy: { fetchedAt: "desc" as const },
    take: 5,
    include: {
      rooms: {
        orderBy: [{ roomName: "asc" }, { ratePlanName: "asc" }] as {
          roomName?: "asc" | "desc";
          ratePlanName?: "asc" | "desc";
        }[],
      },
    },
  },
} as const;

// ---------------------------------------------------------------------------
// Return types
// ---------------------------------------------------------------------------

export type FullPriceWatch = Prisma.PriceWatchGetPayload<{
  include: typeof PRICE_WATCH_DETAIL_INCLUDE;
}>;

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface UpsertPriceWatchInput {
  propertyId: string;
  isEnabled?: boolean;
  bookingId?: string;
  cashThreshold?: number | null;
  awardThreshold?: number | null;
}

export interface UpdatePriceWatchInput {
  isEnabled?: boolean;
}

// ---------------------------------------------------------------------------
// Service functions
// ---------------------------------------------------------------------------

/** List all price watches for a user, newest first. */
export async function listPriceWatches(userId: string) {
  return prisma.priceWatch.findMany({
    where: { userId },
    include: PRICE_WATCH_LIST_INCLUDE,
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Fetch a single price watch by id.
 * Throws AppError(404) if not found or not owned by userId.
 */
export async function getPriceWatch(id: string, userId: string): Promise<FullPriceWatch> {
  const watch = await prisma.priceWatch.findFirst({
    where: { id, userId },
    include: PRICE_WATCH_DETAIL_INCLUDE,
  });
  if (!watch) throw new AppError("Price watch not found", 404);
  return watch;
}

/**
 * Upsert a price watch for (userId, propertyId).
 * If bookingId is provided, also upserts a PriceWatchBooking (IDOR-verified).
 * Throws AppError(400) if propertyId is missing.
 * Throws AppError(404) if bookingId provided but not owned by userId.
 */
export async function upsertPriceWatch(
  userId: string,
  data: UpsertPriceWatchInput
): Promise<FullPriceWatch> {
  const { propertyId, isEnabled = true, bookingId, cashThreshold, awardThreshold } = data;

  if (!propertyId) throw new AppError("propertyId is required", 400);

  let bookingForPriority: { propertyId: string } | null = null;
  if (bookingId) {
    bookingForPriority = await prisma.booking.findFirst({
      where: { id: bookingId, userId },
      select: { propertyId: true },
    });
    if (!bookingForPriority) throw new AppError("Booking not found", 404);
  }

  const priority = bookingForPriority
    ? bookingForPriority.propertyId === propertyId
      ? PRICE_WATCH_PRIORITY.ANCHOR
      : PRICE_WATCH_PRIORITY.ALTERNATE
    : PRICE_WATCH_PRIORITY.ANCHOR;

  const watch = await prisma.priceWatch.upsert({
    where: { userId_propertyId: { userId, propertyId } },
    update: {
      isEnabled,
      ...(priority === PRICE_WATCH_PRIORITY.ANCHOR ? { priority } : {}),
    },
    create: { userId, propertyId, isEnabled, priority },
  });

  if (bookingId) {
    if (priority === PRICE_WATCH_PRIORITY.ALTERNATE) {
      const count = await prisma.priceWatchBooking.count({
        where: {
          bookingId,
          priceWatch: { propertyId: { not: bookingForPriority!.propertyId } },
        },
      });
      const alreadyLinked = await prisma.priceWatchBooking.findUnique({
        where: { priceWatchId_bookingId: { priceWatchId: watch.id, bookingId } },
      });
      if (!alreadyLinked && count >= 5) {
        throw new AppError("Alternate watch limit (5) reached for this booking", 400);
      }
    }

    const bookingData = {
      priceWatchId: watch.id,
      cashThreshold: cashThreshold != null ? Number(cashThreshold) : null,
      awardThreshold: awardThreshold != null ? Number(awardThreshold) : null,
    };

    await prisma.priceWatchBooking.upsert({
      where: {
        priceWatchId_bookingId: { priceWatchId: watch.id, bookingId },
      },
      update: bookingData,
      create: { ...bookingData, bookingId },
    });
  }

  const fullWatch = await prisma.priceWatch.findFirst({
    where: { id: watch.id, userId },
    include: PRICE_WATCH_DETAIL_INCLUDE,
  });

  if (!fullWatch) throw new AppError("Price watch not found after upsert", 500);
  return fullWatch;
}

/**
 * Update a price watch (currently: toggle isEnabled).
 * Throws AppError(404) if not found or not owned by userId.
 */
export async function updatePriceWatch(
  id: string,
  userId: string,
  data: UpdatePriceWatchInput
): Promise<FullPriceWatch> {
  const exists = await prisma.priceWatch.findFirst({
    where: { id, userId },
    select: { id: true },
  });
  if (!exists) throw new AppError("Price watch not found", 404);

  return prisma.priceWatch.update({
    where: { id },
    data,
    include: PRICE_WATCH_DETAIL_INCLUDE,
  });
}

/**
 * Delete a price watch.
 * Throws AppError(404) if not found or not owned by userId.
 */
export async function deletePriceWatch(id: string, userId: string): Promise<void> {
  const exists = await prisma.priceWatch.findFirst({
    where: { id, userId },
    select: { id: true },
  });
  if (!exists) throw new AppError("Price watch not found", 404);

  await prisma.priceWatch.delete({ where: { id } });
}
