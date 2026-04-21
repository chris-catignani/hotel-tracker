import { NextRequest, NextResponse } from "next/server";
import { withObservability } from "@/lib/observability";
import { apiError } from "@/lib/api-error";
import { AppError } from "@/lib/app-error";
import { getAuthenticatedUserId } from "@/lib/auth-utils";
import { findAlternateCandidates } from "@/services/alternate-candidates";

export const GET = withObservability(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    try {
      const userIdOrResponse = await getAuthenticatedUserId();
      if (userIdOrResponse instanceof NextResponse) return userIdOrResponse;
      const userId = userIdOrResponse;

      const { id } = await params;
      const sp = request.nextUrl.searchParams;

      const hotelChainIds = (sp.get("hotelChainIds") ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const subBrandIds = (sp.get("subBrandIds") ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const radiusRaw = Number(sp.get("radiusMiles") ?? "10");
      const radiusMiles = Number.isFinite(radiusRaw) && radiusRaw > 0 ? radiusRaw : 10;

      const candidates = await findAlternateCandidates(userId, id, {
        hotelChainIds,
        subBrandIds,
        radiusMiles,
      });
      return NextResponse.json(candidates);
    } catch (error) {
      if (error instanceof AppError)
        return apiError(error.message, null, error.statusCode, request);
      return apiError("Failed to fetch alternates", error, 500, request);
    }
  }
);
