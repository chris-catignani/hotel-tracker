import { NextRequest, NextResponse } from "next/server";
import { withAxiom } from "next-axiom";
import prisma from "@/lib/prisma";
import { apiError } from "@/lib/api-error";
import { requireAdmin } from "@/lib/auth-utils";

export const GET = withAxiom(async (request: NextRequest) => {
  try {
    const pointTypes = await prisma.pointType.findMany({
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });
    return NextResponse.json(pointTypes);
  } catch (error) {
    return apiError("Failed to fetch point types", error, 500, request);
  }
});

export const POST = withAxiom(async (request: NextRequest) => {
  try {
    const adminError = await requireAdmin();
    if (adminError instanceof NextResponse) return adminError;

    const body = await request.json();
    const { name, category, usdCentsPerPoint, programCurrency, programCentsPerPoint } = body;

    const pointType = await prisma.pointType.create({
      data: {
        name,
        category,
        usdCentsPerPoint: Number(usdCentsPerPoint),
        programCurrency: programCurrency ?? null,
        programCentsPerPoint: programCentsPerPoint != null ? Number(programCentsPerPoint) : null,
      },
    });

    return NextResponse.json(pointType, { status: 201 });
  } catch (error) {
    return apiError("Failed to create point type", error, 500, request);
  }
});
