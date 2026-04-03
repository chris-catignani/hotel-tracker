import { NextRequest, NextResponse } from "next/server";
import { withObservability } from "@/lib/observability";
import { apiError } from "@/lib/api-error";
import { AppError } from "@/lib/app-error";
import { getAuthenticatedUserId } from "@/lib/auth-utils";
import prisma from "@/lib/prisma";

export interface TravelStop {
  id: string;
  propertyName: string;
  city: string | null;
  countryCode: string | null;
  checkIn: string;
  numNights: number;
  lat: number;
  lng: number;
}

export const GET = withObservability(async (req: NextRequest) => {
  try {
    const userIdOrResponse = await getAuthenticatedUserId();
    if (userIdOrResponse instanceof NextResponse) return userIdOrResponse;
    const userId = userIdOrResponse;

    const bookings = await prisma.booking.findMany({
      where: {
        userId,
        property: {
          latitude: { not: null },
          longitude: { not: null },
        },
      },
      select: {
        id: true,
        checkIn: true,
        numNights: true,
        property: {
          select: {
            name: true,
            city: true,
            countryCode: true,
            latitude: true,
            longitude: true,
          },
        },
      },
      orderBy: { checkIn: "asc" },
    });

    const stops: TravelStop[] = bookings.map((b) => ({
      id: b.id,
      propertyName: b.property.name,
      city: b.property.city,
      countryCode: b.property.countryCode,
      checkIn: b.checkIn.toISOString().split("T")[0],
      numNights: b.numNights,
      // latitude/longitude are non-null: guaranteed by the where clause above
      lat: b.property.latitude!,
      lng: b.property.longitude!,
    }));

    return NextResponse.json(stops);
  } catch (error) {
    if (error instanceof AppError) return apiError(error.message, null, error.statusCode, req);
    return apiError("Failed to fetch travel map stops", error, 500, req);
  }
});
