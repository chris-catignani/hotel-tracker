import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { apiError } from "@/lib/api-error";
import { getAuthenticatedUserId } from "@/lib/auth-utils";

/** PUT /api/properties/[id] — update chainPropertyId (spiritCode etc) */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userIdOrResponse = await getAuthenticatedUserId();
    if (userIdOrResponse instanceof NextResponse) return userIdOrResponse;

    const { id } = await params;
    const body = await request.json();
    const { chainPropertyId } = body;

    const property = await prisma.property.update({
      where: { id },
      data: { chainPropertyId: chainPropertyId ?? null },
    });

    return NextResponse.json(property);
  } catch (error) {
    return apiError("Failed to update property", error, 500, request);
  }
}
