import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { AppError } from "@/lib/app-error";
import { boundingBox, haversineMiles } from "@/lib/geo/distance";

const MAX_RESULTS = 50;
const MAX_STALE_DAYS = 90;

export interface AlternateCandidateFilters {
  hotelChainIds: string[];
  subBrandIds?: string[];
  radiusMiles: number;
}

export interface AlternateCandidate {
  propertyId: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  countryCode: string | null;
  distanceMiles: number | null;
  hotelChainId: string | null;
  hotelChainName: string | null;
  chainCategories: string[];
  isWatched: boolean;
  priceWatchId: string | null;
  cashThreshold: number | null;
  awardThreshold: number | null;
}

export async function findAlternateCandidates(
  userId: string,
  bookingId: string,
  filters: AlternateCandidateFilters
): Promise<AlternateCandidate[]> {
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, userId },
    include: {
      property: {
        select: {
          id: true,
          latitude: true,
          longitude: true,
          countryCode: true,
        },
      },
    },
  });
  if (!booking) throw new AppError("Booking not found", 404);

  const anchor = booking.property;
  const staleCutoff = new Date(Date.now() - MAX_STALE_DAYS * 24 * 3600_000);

  const whereBase: Prisma.PropertyWhereInput = {
    ...(filters.hotelChainIds.length > 0 && { hotelChainId: { in: filters.hotelChainIds } }),
    ...(anchor.countryCode && { countryCode: anchor.countryCode }),
    id: { not: anchor.id },
    OR: [{ lastSeenAt: { gte: staleCutoff } }, { lastSeenAt: null }],
  };

  let whereGeo: Prisma.PropertyWhereInput = { ...whereBase };
  if (anchor.latitude !== null && anchor.longitude !== null) {
    const box = boundingBox(anchor.latitude, anchor.longitude, filters.radiusMiles);
    whereGeo = {
      ...whereBase,
      OR: undefined,
      AND: [
        { OR: whereBase.OR },
        {
          OR: [
            {
              AND: [
                { latitude: { gte: box.minLat } },
                { latitude: { lte: box.maxLat } },
                { longitude: { gte: box.minLng } },
                { longitude: { lte: box.maxLng } },
              ],
            },
            { latitude: null },
          ],
        },
      ],
    };
  }

  const rows = await prisma.property.findMany({
    where: whereGeo,
    select: {
      id: true,
      name: true,
      latitude: true,
      longitude: true,
      countryCode: true,
      hotelChainId: true,
      hotelChain: { select: { name: true } },
      chainCategories: true,
    },
    orderBy: { id: "asc" },
    take: 500,
  });

  type CandidateBase = Omit<
    AlternateCandidate,
    "isWatched" | "priceWatchId" | "cashThreshold" | "awardThreshold"
  >;
  const scored: CandidateBase[] = [];
  for (const r of rows) {
    if (r.id === anchor.id) continue;
    let distance: number | null = null;
    if (
      anchor.latitude !== null &&
      anchor.longitude !== null &&
      r.latitude !== null &&
      r.longitude !== null
    ) {
      distance = haversineMiles(anchor.latitude, anchor.longitude, r.latitude, r.longitude);
      if (distance > filters.radiusMiles) continue;
    }
    scored.push({
      propertyId: r.id,
      name: r.name,
      latitude: r.latitude,
      longitude: r.longitude,
      countryCode: r.countryCode,
      distanceMiles: distance,
      hotelChainId: r.hotelChainId,
      hotelChainName: r.hotelChain?.name ?? null,
      chainCategories: r.chainCategories,
    });
  }

  scored.sort((a, b) => {
    if (a.distanceMiles === null && b.distanceMiles === null) return 0;
    if (a.distanceMiles === null) return 1;
    if (b.distanceMiles === null) return -1;
    return a.distanceMiles - b.distanceMiles;
  });

  const page = scored.slice(0, MAX_RESULTS);

  const watchedRows = await prisma.priceWatchBooking.findMany({
    where: {
      bookingId,
      priceWatch: { userId, propertyId: { in: page.map((c) => c.propertyId) } },
    },
    select: {
      cashThreshold: true,
      awardThreshold: true,
      priceWatch: { select: { id: true, propertyId: true } },
    },
  });
  const watchedMap = new Map(
    watchedRows.map((w) => [
      w.priceWatch.propertyId,
      {
        priceWatchId: w.priceWatch.id,
        cashThreshold: w.cashThreshold !== null ? Number(w.cashThreshold) : null,
        awardThreshold: w.awardThreshold,
      },
    ])
  );

  return page.map((c) => {
    const watch = watchedMap.get(c.propertyId);
    return {
      ...c,
      isWatched: watch !== undefined,
      priceWatchId: watch?.priceWatchId ?? null,
      cashThreshold: watch?.cashThreshold ?? null,
      awardThreshold: watch?.awardThreshold ?? null,
    };
  });
}
