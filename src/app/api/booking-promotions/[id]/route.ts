import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { apiError } from "@/lib/api-error";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const bookingPromotion = await prisma.bookingPromotion.findUnique({
      where: { id: id },
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
      return apiError("Booking promotion not found", null, 404);
    }

    return NextResponse.json(bookingPromotion);
  } catch (error) {
    return apiError("Failed to fetch booking promotion", error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { verified } = await request.json();

    const bookingPromotion = await prisma.bookingPromotion.update({
      where: { id: id },
      data: { verified },
    });

    return NextResponse.json(bookingPromotion);
  } catch (error) {
    return apiError("Failed to update booking promotion", error);
  }
}
