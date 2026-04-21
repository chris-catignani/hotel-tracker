import { NextRequest, NextResponse } from "next/server";
import { withObservability } from "@/lib/observability";
import { apiError } from "@/lib/api-error";
import { requireAdmin } from "@/lib/auth-utils";
import { ingestGhaDirectory } from "@/services/gha-directory-ingest";
import { HOTEL_ID } from "@/lib/constants";

export const POST = withObservability(
  async (request: NextRequest, { params }: { params: Promise<{ chainId: string }> }) => {
    try {
      const adminError = await requireAdmin();
      if (adminError instanceof NextResponse) return adminError;

      const { chainId } = await params;
      if (chainId !== HOTEL_ID.GHA_DISCOVERY) {
        return NextResponse.json(
          { error: "Reingest not implemented for this chain yet." },
          { status: 400 }
        );
      }

      const result = await ingestGhaDirectory({ forceFullRefetch: true });
      return NextResponse.json(result);
    } catch (error) {
      return apiError("Reingest failed", error, 500, request);
    }
  }
);
