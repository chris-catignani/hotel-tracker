import { NextRequest, NextResponse } from "next/server";
import { withAxiomRouteHandler } from "next-axiom";
import prisma from "@/lib/prisma";
import { apiError } from "@/lib/api-error";
import { requireAdmin } from "@/lib/auth-utils";

export const GET = withAxiomRouteHandler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    try {
      const agency = await prisma.otaAgency.findUnique({
        where: { id: id },
      });
      if (!agency) return apiError("Agency not found", null, 404, request, { otaAgencyId: id });
      return NextResponse.json(agency);
    } catch (error) {
      return apiError("Failed to fetch agency", error, 500, request, { otaAgencyId: id });
    }
  }
);

export const PUT = withAxiomRouteHandler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    try {
      const adminError = await requireAdmin();
      if (adminError instanceof NextResponse) return adminError;

      const { name } = await request.json();
      const agency = await prisma.otaAgency.update({
        where: { id: id },
        data: { name },
      });
      return NextResponse.json(agency);
    } catch (error) {
      return apiError("Failed to update agency", error, 500, request, { otaAgencyId: id });
    }
  }
);

export const DELETE = withAxiomRouteHandler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    try {
      const adminError = await requireAdmin();
      if (adminError instanceof NextResponse) return adminError;

      // Check if being used by any bookings
      const count = await prisma.booking.count({
        where: { otaAgencyId: id },
      });
      if (count > 0) {
        return apiError("Cannot delete agency that is in use by bookings", null, 409, request, {
          otaAgencyId: id,
        });
      }

      await prisma.otaAgency.delete({ where: { id: id } });
      return new NextResponse(null, { status: 204 });
    } catch (error) {
      return apiError("Failed to delete agency", error, 500, request, { otaAgencyId: id });
    }
  }
);
