import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { apiError } from "@/lib/api-error";
import { getAuthenticatedUserId, requireAdmin } from "@/lib/auth-utils";

/** PUT /api/properties/[id] — update chainPropertyId (spiritCode etc); admin only */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userIdOrResponse = await getAuthenticatedUserId();
    if (userIdOrResponse instanceof NextResponse) return userIdOrResponse;

    const adminError = await requireAdmin();
    if (adminError) return adminError;

    const { id } = await params;
    const body = await request.json();
    const { chainPropertyId } = body;

    // Validate spiritCode format: alphanumeric only, max 20 chars (prevents path traversal / SSRF)
    if (chainPropertyId != null) {
      if (typeof chainPropertyId !== "string" || !/^[a-zA-Z0-9_-]{1,20}$/.test(chainPropertyId)) {
        return NextResponse.json(
          { error: "chainPropertyId must be alphanumeric (max 20 characters)" },
          { status: 400 }
        );
      }
    }

    const property = await prisma.property.update({
      where: { id },
      data: { chainPropertyId: chainPropertyId ?? null },
    });

    return NextResponse.json(property);
  } catch (error) {
    return apiError("Failed to update property", error, 500, request);
  }
}
