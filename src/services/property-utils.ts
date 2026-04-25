import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

interface PropertyInput {
  propertyName: string;
  placeId?: string | null;
  hotelChainId?: string | null;
  countryCode?: string | null;
  city?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  chainPropertyId?: string | null;
  chainUrlPath?: string | null;
  lastSeenAt?: Date | null;
}

export async function findOrCreateProperty(input: PropertyInput): Promise<string> {
  const existing =
    (input.placeId
      ? await prisma.property.findUnique({ where: { placeId: input.placeId } })
      : null) ??
    (await prisma.property.findFirst({
      where: { name: input.propertyName, hotelChainId: input.hotelChainId ?? undefined },
    }));

  if (existing) {
    const updates: Prisma.PropertyUpdateInput = {};
    if (existing.latitude === null && input.latitude != null) {
      updates.latitude = input.latitude;
      updates.longitude = input.longitude ?? null;
    }
    if (!existing.placeId && input.placeId) {
      updates.placeId = input.placeId;
    }
    if (Object.keys(updates).length > 0) {
      await prisma.property.update({ where: { id: existing.id }, data: updates });
    }
    return existing.id;
  }

  try {
    const created = await prisma.property.create({
      data: {
        name: input.propertyName,
        placeId: input.placeId || null,
        hotelChainId: input.hotelChainId || null,
        countryCode: input.countryCode || null,
        city: input.city || null,
        address: input.address || null,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        chainPropertyId: input.chainPropertyId || null,
        chainUrlPath: input.chainUrlPath || null,
        lastSeenAt: input.lastSeenAt ?? null,
      },
    });
    return created.id;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const race = await prisma.property.findFirst({
        where: { name: input.propertyName, hotelChainId: input.hotelChainId ?? undefined },
      });
      if (race) return race.id;
    }
    throw err;
  }
}
