import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { apiError } from "@/lib/api-error";

export async function GET(request: NextRequest) {
  try {
    const agencies = await prisma.otaAgency.findMany({
      orderBy: { name: "asc" },
    });
    return NextResponse.json(agencies);
  } catch (error) {
    return apiError("Failed to fetch OTA agencies", error, 500, request);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name } = await request.json();
    const agency = await prisma.otaAgency.create({ data: { name } });
    return NextResponse.json(agency, { status: 201 });
  } catch (error) {
    return apiError("Failed to create OTA agency", error, 500, request);
  }
}
