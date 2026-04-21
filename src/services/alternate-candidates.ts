import prisma from "@/lib/prisma";
import { AppError } from "@/lib/app-error";
import { boundingBox, haversineMiles } from "@/lib/geo/distance";

const MAX_RESULTS = 50;
const MAX_STALE_DAYS = 90;

export interface AlternateCandidateFilters {
  hotelChainIds: string[];
  subBrandIds?: string[];
  radiusMiles: number;
  countryWide?: boolean;
}

export interface AlternateCandidate {
  propertyId: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  countryCode: string | null;
  distanceMiles: number | null;
  hotelChainId: string | null;
  chainCategories: string[];
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

  const whereBase = {
    hotelChainId: { in: filters.hotelChainIds },
    id: { not: anchor.id },
    OR: [{ lastSeenAt: { gte: staleCutoff } }, { lastSeenAt: null }],
  };

  let whereGeo: typeof whereBase & { OR?: unknown } = { ...whereBase };
  if (!filters.countryWide && anchor.latitude !== null && anchor.longitude !== null) {
    const box = boundingBox(anchor.latitude, anchor.longitude, filters.radiusMiles);
    whereGeo = {
      ...whereBase,
      OR: [
        {
          AND: [
            { latitude: { gte: box.minLat } },
            { latitude: { lte: box.maxLat } },
            { longitude: { gte: box.minLng } },
            { longitude: { lte: box.maxLng } },
          ],
        },
        {
          AND: [{ latitude: null }, { countryCode: anchor.countryCode ?? "__none__" }],
        },
      ],
    };
  }

  const rows = await prisma.property.findMany({
    where: whereGeo as Parameters<typeof prisma.property.findMany>[0]["where"],
    select: {
      id: true,
      name: true,
      latitude: true,
      longitude: true,
      countryCode: true,
      hotelChainId: true,
      chainCategories: true,
    },
    take: 500,
  });

  const scored: AlternateCandidate[] = [];
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
      if (!filters.countryWide && distance > filters.radiusMiles) continue;
    } else {
      if (r.countryCode !== anchor.countryCode) continue;
    }
    scored.push({
      propertyId: r.id,
      name: r.name,
      latitude: r.latitude,
      longitude: r.longitude,
      countryCode: r.countryCode,
      distanceMiles: distance,
      hotelChainId: r.hotelChainId,
      chainCategories: r.chainCategories,
    });
  }

  scored.sort((a, b) => {
    if (a.distanceMiles === null && b.distanceMiles === null) return 0;
    if (a.distanceMiles === null) return 1;
    if (b.distanceMiles === null) return -1;
    return a.distanceMiles - b.distanceMiles;
  });

  return scored.slice(0, MAX_RESULTS);
}
