import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { apiError } from "@/lib/api-error";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { verified } = await request.json();

    const bookingPromotion = await prisma.bookingPromotion.update({
      where: { id: Number(id) },
      data: { verified },
    });

    return NextResponse.json(bookingPromotion);
  } catch (error) {
    return apiError("Failed to update booking promotion", error);
  }
}
