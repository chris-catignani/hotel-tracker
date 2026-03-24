import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { apiError } from "@/lib/api-error";
import { getAuthenticatedUserId } from "@/lib/auth-utils";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userIdOrResponse = await getAuthenticatedUserId();
    if (userIdOrResponse instanceof NextResponse) return userIdOrResponse;
    const userId = userIdOrResponse;

    const { id } = await params;
    const bookingPromotion = await prisma.bookingPromotion.findFirst({
      where: { id, booking: { userId } },
      include: {
        promotion: {
          include: {
            benefits: {
              orderBy: {
                sortOrder: "asc",
              },
            },
          },
        },
        benefitApplications: {
          include: {
            promotionBenefit: true,
          },
        },
      },
    });

    if (!bookingPromotion) {
      return apiError("Booking promotion not found", null, 404, request, {
        bookingPromotionId: id,
      });
    }

    return NextResponse.json(bookingPromotion);
  } catch (error) {
    return apiError("Failed to fetch booking promotion", error, 500, request, {
      bookingPromotionId: id,
    });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userIdOrResponse = await getAuthenticatedUserId();
    if (userIdOrResponse instanceof NextResponse) return userIdOrResponse;
    const userId = userIdOrResponse;

    const { id } = await params;
    const { verified } = await request.json();

    const exists = await prisma.bookingPromotion.findFirst({
      where: { id, booking: { userId } },
      select: { id: true },
    });
    if (!exists)
      return apiError("Booking promotion not found", null, 404, request, {
        bookingPromotionId: id,
      });

    const bookingPromotion = await prisma.bookingPromotion.update({
      where: { id },
      data: { verified },
    });

    return NextResponse.json(bookingPromotion);
  } catch (error) {
    return apiError("Failed to update booking promotion", error, 500, request, {
      bookingPromotionId: id,
    });
  }
}
