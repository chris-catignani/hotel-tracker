import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { PromotionType } from "@prisma/client";
import { apiError } from "@/lib/api-error";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");

    const where: Record<string, unknown> = {};
    if (type) {
      where.type = type as PromotionType;
    }

    const promotions = await prisma.promotion.findMany({
      where,
      include: {
        hotel: true,
        creditCard: true,
        shoppingPortal: true,
      },
    });

    return NextResponse.json(promotions);
  } catch (error) {
    return apiError("Failed to fetch promotions", error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      type,
      valueType,
      value,
      hotelId,
      creditCardId,
      shoppingPortalId,
      minSpend,
      startDate,
      endDate,
      isActive,
    } = body;

    const promotion = await prisma.promotion.create({
      data: {
        name,
        type,
        valueType,
        value: Number(value),
        hotelId: hotelId ? Number(hotelId) : null,
        creditCardId: creditCardId ? Number(creditCardId) : null,
        shoppingPortalId: shoppingPortalId ? Number(shoppingPortalId) : null,
        minSpend: minSpend != null ? Number(minSpend) : null,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        isActive: isActive !== undefined ? isActive : true,
      },
    });

    return NextResponse.json(promotion, { status: 201 });
  } catch (error) {
    return apiError("Failed to create promotion", error);
  }
}
