import { NextRequest, NextResponse } from "next/server";
import { withObservability as withAxiom } from "@/lib/observability";
import prisma from "@/lib/prisma";
import { apiError } from "@/lib/api-error";
import { requireAdmin } from "@/lib/auth-utils";
import { BenefitPeriod } from "@prisma/client";
import { reapplyBenefitForAllUsers } from "@/lib/card-benefit-apply";

const INCLUDE = {
  hotelChain: { select: { id: true, name: true } },
  otaAgencies: { include: { otaAgency: { select: { id: true, name: true } } } },
};

export const GET = withAxiom(async (_request: NextRequest) => {
  try {
    const cardBenefits = await prisma.cardBenefit.findMany({
      include: INCLUDE,
      orderBy: [{ creditCardId: "asc" }, { createdAt: "asc" }],
    });
    return NextResponse.json(cardBenefits);
  } catch (error) {
    return apiError("Failed to fetch card benefits", error, 500);
  }
});

export const POST = withAxiom(async (request: NextRequest) => {
  try {
    const adminOrResponse = await requireAdmin();
    if (adminOrResponse instanceof NextResponse) return adminOrResponse;

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

    if (!creditCardId || !description || value == null || !period) {
      return apiError("creditCardId, description, value, and period are required", null, 400);
    }

    const cardBenefit = await prisma.cardBenefit.create({
      data: {
        creditCardId,
        description,
        value: Number(value),
        maxValuePerBooking: maxValuePerBooking != null ? Number(maxValuePerBooking) : null,
        period: period as BenefitPeriod,
        hotelChainId: hotelChainId || null,
        isActive: isActive ?? true,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        otaAgencies:
          Array.isArray(otaAgencyIds) && otaAgencyIds.length > 0
            ? { create: otaAgencyIds.map((id: string) => ({ otaAgencyId: id })) }
            : undefined,
      },
      include: INCLUDE,
    });

    // Retroactively apply to all existing matching bookings
    await reapplyBenefitForAllUsers(cardBenefit.id);

    return NextResponse.json(cardBenefit, { status: 201 });
  } catch (error) {
    return apiError("Failed to create card benefit", error, 500, request);
  }
});
