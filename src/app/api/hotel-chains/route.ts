import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { apiError } from "@/lib/api-error";
import { getAuthenticatedUserId, requireAdmin } from "@/lib/auth-utils";
import { normalizeUserStatuses } from "@/lib/normalize-response";
import { getCurrentRate } from "@/lib/exchange-rate";

export async function GET(request: NextRequest) {
  try {
    const userIdOrResponse = await getAuthenticatedUserId();
    if (userIdOrResponse instanceof NextResponse) return userIdOrResponse;
    const userId = userIdOrResponse;

    const hotelChains = await prisma.hotelChain.findMany({
      include: {
        pointType: true,
        hotelChainSubBrands: {
          orderBy: {
            name: "asc",
          },
        },
        eliteStatuses: {
          orderBy: {
            eliteTierLevel: "asc",
          },
        },
        userStatuses: {
          where: { userId },
          include: {
            eliteStatus: true,
          },
          take: 1,
        },
      },
      orderBy: {
        name: "asc",
      },
    });

    // Enrich each chain with calcCurrencyToUsdRate for non-USD calc currencies
    const calcCurrencies = [
      ...new Set(
        hotelChains
          .filter((h) => h.calculationCurrency && h.calculationCurrency !== "USD")
          .map((h) => h.calculationCurrency)
      ),
    ];
    const calcRateCache = new Map<string, number | null>();
    await Promise.all(
      calcCurrencies.map(async (curr) => {
        if (curr) calcRateCache.set(curr, await getCurrentRate(curr));
      })
    );

    const enriched = hotelChains.map((h) => ({
      ...h,
      calcCurrencyToUsdRate:
        h.calculationCurrency && h.calculationCurrency !== "USD"
          ? (calcRateCache.get(h.calculationCurrency) ?? null)
          : null,
    }));

    return NextResponse.json(normalizeUserStatuses(enriched));
  } catch (error) {
    return apiError("Failed to fetch hotel chains", error, 500, request);
  }
}

export async function POST(request: NextRequest) {
  try {
    const adminError = await requireAdmin();
    if (adminError instanceof NextResponse) return adminError;

    const body = await request.json();
    const { name, loyaltyProgram, basePointRate, calculationCurrency, pointTypeId } = body;

    const hotelChain = await prisma.hotelChain.create({
      data: {
        name,
        loyaltyProgram,
        basePointRate: basePointRate != null ? Number(basePointRate) : null,
        calculationCurrency: calculationCurrency || "USD",
        pointTypeId: pointTypeId || null,
      },
      include: {
        pointType: true,
        eliteStatuses: { orderBy: { eliteTierLevel: "asc" } },
        userStatuses: {
          take: 0,
        },
      },
    });

    return NextResponse.json(normalizeUserStatuses(hotelChain), { status: 201 });
  } catch (error) {
    return apiError("Failed to create hotel chain", error, 500, request);
  }
}
