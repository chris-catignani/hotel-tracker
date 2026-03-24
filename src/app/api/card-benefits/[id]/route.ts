import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { apiError } from "@/lib/api-error";
import { requireAdmin } from "@/lib/auth-utils";
import { BenefitPeriod } from "@prisma/client";
import { reapplyBenefitForAllUsers } from "@/lib/card-benefit-apply";

const INCLUDE = {
  hotelChain: { select: { id: true, name: true } },
  otaAgencies: { include: { otaAgency: { select: { id: true, name: true } } } },
};

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const cardBenefit = await prisma.cardBenefit.findUnique({
      where: { id },
      include: INCLUDE,
    });
    if (!cardBenefit)
      return apiError("Card benefit not found", null, 404, request, { cardBenefitId: id });
    return NextResponse.json(cardBenefit);
  } catch (error) {
    return apiError("Failed to fetch card benefit", error, 500, request, { cardBenefitId: id });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const adminOrResponse = await requireAdmin();
    if (adminOrResponse instanceof NextResponse) return adminOrResponse;

    const { id } = await params;
    const body = await request.json();
    const {
      creditCardId,
      description,
      value,
      maxValuePerBooking,
      period,
      hotelChainId,
      otaAgencyIds,
      isActive,
      startDate,
      endDate,
    } = body;

    const data: Record<string, unknown> = {};
    if (creditCardId !== undefined) data.creditCardId = creditCardId;
    if (description !== undefined) data.description = description;
    if (value !== undefined) data.value = Number(value);
    if (maxValuePerBooking !== undefined)
      data.maxValuePerBooking = maxValuePerBooking != null ? Number(maxValuePerBooking) : null;
    if (period !== undefined) data.period = period as BenefitPeriod;
    if (hotelChainId !== undefined) data.hotelChainId = hotelChainId || null;
    if (isActive !== undefined) data.isActive = isActive;
    if (startDate !== undefined) data.startDate = startDate ? new Date(startDate) : null;
    if (endDate !== undefined) data.endDate = endDate ? new Date(endDate) : null;

    const cardBenefit = await prisma.$transaction(async (tx) => {
      // Update OTA agencies: replace existing rows if otaAgencyIds is provided
      if (otaAgencyIds !== undefined) {
        await tx.cardBenefitOtaAgency.deleteMany({ where: { cardBenefitId: id } });
        if (Array.isArray(otaAgencyIds) && otaAgencyIds.length > 0) {
          await tx.cardBenefitOtaAgency.createMany({
            data: otaAgencyIds.map((otaAgencyId: string) => ({ cardBenefitId: id, otaAgencyId })),
          });
        }
      }

      return tx.cardBenefit.update({
        where: { id },
        data,
        include: INCLUDE,
      });
    });

    // Re-evaluate all existing matching bookings
    await reapplyBenefitForAllUsers(cardBenefit.id);

    return NextResponse.json(cardBenefit);
  } catch (error) {
    return apiError("Failed to update card benefit", error, 500, request, { cardBenefitId: id });
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
    return apiError("Failed to delete card benefit", error, 500, request, { cardBenefitId: id });
  }
}
