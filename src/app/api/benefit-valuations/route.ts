import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAllValuations } from "@/lib/benefit-valuations";
import { apiError } from "@/lib/api-error";
import { reevaluateBookings } from "@/lib/promotion-matching";

export async function GET(request: NextRequest) {
  try {
    const valuations = await getAllValuations();
    return NextResponse.json(valuations);
  } catch (error) {
    return apiError("Failed to fetch valuations", error, 500, request);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { valuations } = body;

    if (!Array.isArray(valuations)) {
      return apiError("Invalid input: valuations must be an array", null, 400, request);
    }

    // Process updates/creates/deletes in a transaction
    await prisma.$transaction(async (tx) => {
      for (const v of valuations) {
        const { hotelChainId, isEqn, certType, benefitType, value, valueType } = v;

        // Use findFirst + update/create to handle the null unique constraint issues
        const where = {
          hotelChainId: hotelChainId || null,
          isEqn: isEqn ?? false,
          certType: certType || null,
          benefitType: benefitType || null,
        };

        const existing = await tx.benefitValuation.findFirst({
          where,
        });

        if (value === null) {
          // Deletion requested
          if (existing) {
            await tx.benefitValuation.delete({
              where: { id: existing.id },
            });
          }
          continue;
        }

        if (existing) {
          await tx.benefitValuation.update({
            where: { id: existing.id },
            data: { value, valueType },
          });
        } else {
          await tx.benefitValuation.create({
            data: {
              ...where,
              value,
              valueType,
            },
          });
        }
      }
    });

    // Re-evaluate ALL bookings since valuations affect net cost calculations
    // This is a heavy operation but necessary for consistency
    const allBookings = await prisma.booking.findMany({ select: { id: true } });
    if (allBookings.length > 0) {
      await reevaluateBookings(allBookings.map((b) => b.id));
    }

    const updated = await getAllValuations();
    return NextResponse.json(updated);
  } catch (error) {
    return apiError("Failed to update valuations", error, 500, request);
  }
}
