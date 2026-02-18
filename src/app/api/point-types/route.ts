import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { apiError } from "@/lib/api-error";

export async function GET() {
  try {
    const pointTypes = await prisma.pointType.findMany({
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });
    return NextResponse.json(pointTypes);
  } catch (error) {
    return apiError("Failed to fetch point types", error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, category, centsPerPoint } = body;

    const pointType = await prisma.pointType.create({
      data: {
        name,
        category,
        centsPerPoint: Number(centsPerPoint),
      },
    });

    return NextResponse.json(pointType, { status: 201 });
  } catch (error) {
    return apiError("Failed to create point type", error);
  }
}
