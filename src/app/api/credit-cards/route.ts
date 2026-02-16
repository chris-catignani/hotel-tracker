import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const creditCards = await prisma.creditCard.findMany();
    return NextResponse.json(creditCards);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch credit cards" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, rewardType, rewardRate, pointValue } = body;

    const creditCard = await prisma.creditCard.create({
      data: {
        name,
        rewardType,
        rewardRate: Number(rewardRate),
        pointValue: Number(pointValue),
      },
    });

    return NextResponse.json(creditCard, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create credit card" },
      { status: 500 }
    );
  }
}
