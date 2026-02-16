import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const portals = await prisma.shoppingPortal.findMany();
    return NextResponse.json(portals);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch portals" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name } = body;

    const portal = await prisma.shoppingPortal.create({
      data: {
        name,
      },
    });

    return NextResponse.json(portal, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create portal" },
      { status: 500 }
    );
  }
}
