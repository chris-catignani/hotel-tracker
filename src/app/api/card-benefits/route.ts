import { NextRequest, NextResponse } from "next/server";
import { withObservability } from "@/lib/observability";
import { apiError } from "@/lib/api-error";
import { AppError } from "@/lib/app-error";
import { requireAdmin } from "@/lib/auth-utils";
import { listCardBenefits, createCardBenefit } from "@/services/card-benefit.service";

export const GET = withObservability(async (_request: NextRequest) => {
  try {
    const cardBenefits = await listCardBenefits();
    return NextResponse.json(cardBenefits);
  } catch (error) {
    return apiError("Failed to fetch card benefits", error, 500);
  }
});

export const POST = withObservability(async (request: NextRequest) => {
  try {
    const adminOrResponse = await requireAdmin();
    if (adminOrResponse instanceof NextResponse) return adminOrResponse;

    const body = await request.json();
    const cardBenefit = await createCardBenefit(body);
    return NextResponse.json(cardBenefit, { status: 201 });
  } catch (error) {
    if (error instanceof AppError) return apiError(error.message, null, error.statusCode, request);
    return apiError("Failed to create card benefit", error, 500, request);
  }
});
