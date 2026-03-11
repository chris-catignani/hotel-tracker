import prisma from "@/lib/prisma";

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
}
