import { NextRequest, NextResponse } from "next/server";
import { withObservability } from "@/lib/observability";
import { apiError } from "@/lib/api-error";
import { AppError } from "@/lib/app-error";
import { requireAdmin } from "@/lib/auth-utils";
import {
  getCardBenefit,
  updateCardBenefit,
  deleteCardBenefit,
} from "@/services/card-benefit.service";

export const GET = withObservability(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    try {
      const cardBenefit = await getCardBenefit(id);
      return NextResponse.json(cardBenefit);
    } catch (error) {
      if (error instanceof AppError)
        return apiError(error.message, null, error.statusCode, request, { cardBenefitId: id });
      return apiError("Failed to fetch card benefit", error, 500, request, { cardBenefitId: id });
    }
  }
);

export const PUT = withObservability(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    try {
      const adminOrResponse = await requireAdmin();
      if (adminOrResponse instanceof NextResponse) return adminOrResponse;

      const body = await request.json();
      const cardBenefit = await updateCardBenefit(id, body);
      return NextResponse.json(cardBenefit);
    } catch (error) {
      if (error instanceof AppError)
        return apiError(error.message, null, error.statusCode, request, { cardBenefitId: id });
      return apiError("Failed to update card benefit", error, 500, request, { cardBenefitId: id });
    }
  }
);

export const DELETE = withObservability(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    try {
      const adminOrResponse = await requireAdmin();
      if (adminOrResponse instanceof NextResponse) return adminOrResponse;

      await deleteCardBenefit(id);
      return NextResponse.json({ message: "Card benefit deleted" });
    } catch (error) {
      if (error instanceof AppError)
        return apiError(error.message, null, error.statusCode, request, { cardBenefitId: id });
      return apiError("Failed to delete card benefit", error, 500, request, { cardBenefitId: id });
    }
  }
);
