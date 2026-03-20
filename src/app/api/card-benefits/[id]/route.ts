import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { apiError } from "@/lib/api-error";
import { requireAdmin } from "@/lib/auth-utils";
import { BenefitPeriod } from "@prisma/client";
import { reapplyBenefitForAllUsers } from "@/lib/card-benefit-apply";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const cardBenefit = await prisma.cardBenefit.findUnique({
      where: { id },
      include: { hotelChain: { select: { id: true, name: true } } },
    });
    if (!cardBenefit) return apiError("Card benefit not found", null, 404, request);
    return NextResponse.json(cardBenefit);
  } catch (error) {
    return apiError("Failed to fetch card benefit", error, 500, request);
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const adminOrResponse = await requireAdmin();
    if (adminOrResponse instanceof NextResponse) return adminOrResponse;

    const { id } = await params;
    const body = await request.json();
    const { creditCardId, description, value, period, hotelChainId, isActive } = body;

    const data: Record<string, unknown> = {};
    if (creditCardId !== undefined) data.creditCardId = creditCardId;
    if (description !== undefined) data.description = description;
    if (value !== undefined) data.value = Number(value);
    if (period !== undefined) data.period = period as BenefitPeriod;
    if (hotelChainId !== undefined) data.hotelChainId = hotelChainId || null;
    if (isActive !== undefined) data.isActive = isActive;

    const cardBenefit = await prisma.cardBenefit.update({
      where: { id },
      data,
      include: { hotelChain: { select: { id: true, name: true } } },
    });

    // Re-evaluate all existing matching bookings (handles value/period/isActive/criteria changes)
    await reapplyBenefitForAllUsers(cardBenefit.id);

    return NextResponse.json(cardBenefit);
  } catch (error) {
    return apiError("Failed to update card benefit", error, 500, request);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminOrResponse = await requireAdmin();
    if (adminOrResponse instanceof NextResponse) return adminOrResponse;

    const { id } = await params;
    await prisma.cardBenefit.delete({ where: { id } });
    return NextResponse.json({ message: "Card benefit deleted" });
  } catch (error) {
    return apiError("Failed to delete card benefit", error, 500, request);
  }
}
