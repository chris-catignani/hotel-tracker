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
}

/**
 * Finds an existing Property by placeId or (name + hotelChainId), or creates one.
 * Returns the property id.
 */
export async function findOrCreateProperty(input: PropertyInput): Promise<string> {
  const existing = input.placeId
    ? await prisma.property.findUnique({ where: { placeId: input.placeId } })
    : await prisma.property.findFirst({
        where: { name: input.propertyName, hotelChainId: input.hotelChainId ?? undefined },
      });

  if (existing) return existing.id;

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
      },
    });
    return created.id;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      // The (name, hotel_chain_id) unique constraint was violated — the property exists.
      // Always look up by name+hotelChainId since that's what the constraint is on,
      // regardless of whether a placeId was provided in this request.
      const race = await prisma.property.findFirst({
        where: { name: input.propertyName, hotelChainId: input.hotelChainId ?? undefined },
      });
      if (race) return race.id;
    }
    throw err;
  }
}
