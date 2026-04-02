import prisma from "@/lib/prisma";
import { calculatePoints, resolveBasePointRate } from "@/lib/loyalty-utils";
import { getOrFetchHistoricalRate, resolveCalcCurrencyRate } from "@/lib/exchange-rate";

export interface BookingFinancialParams {
  /** YYYY-MM-DD */
  checkIn: string;
  currency: string;
  hotelChainId: string | null;
  hotelChainSubBrandId?: string | null;
  /** Pretax cost in booking currency. Pass null to skip loyalty points calculation (award bookings). */
  pretaxCost: number | null;
  userId: string;
}

export interface BookingFinancials {
  lockedExchangeRate: number | null;
  loyaltyPointsEarned: number | null;
  lockedLoyaltyUsdCentsPerPoint: number | null;
}

export async function resolveBookingFinancials(
  params: BookingFinancialParams
): Promise<BookingFinancials> {
  const { checkIn, currency, hotelChainId, hotelChainSubBrandId, pretaxCost, userId } = params;

  // ── Exchange rate ──────────────────────────────────────────────────────────
  const todayStr = new Date().toISOString().split("T")[0];
  const isPast = checkIn <= todayStr;

  let lockedExchangeRate: number | null = null;
  if (currency === "USD") {
    lockedExchangeRate = 1;
  } else if (isPast) {
    lockedExchangeRate = await getOrFetchHistoricalRate(currency, checkIn);
  }
  // future non-USD: remains null

  // ── Loyalty points ─────────────────────────────────────────────────────────
  let loyaltyPointsEarned: number | null = null;
  // Only calculate when exchange rate is locked (past/USD) and we have the needed inputs
  if (lockedExchangeRate != null && hotelChainId && pretaxCost != null) {
    const [userStatus, hotelChain, subBrand] = await Promise.all([
      prisma.userStatus.findUnique({
        where: { userId_hotelChainId: { userId, hotelChainId } },
        include: { eliteStatus: true },
      }),
      prisma.hotelChain.findUnique({ where: { id: hotelChainId } }),
      hotelChainSubBrandId
        ? prisma.hotelChainSubBrand.findUnique({ where: { id: hotelChainSubBrandId } })
        : Promise.resolve(null),
    ]);

    const basePointRate = resolveBasePointRate(hotelChain, subBrand);
    const calcCurrency = hotelChain?.calculationCurrency ?? "USD";
    const calcCurrencyToUsdRate = await resolveCalcCurrencyRate(calcCurrency);
    const usdPretaxCost = pretaxCost * lockedExchangeRate;

    loyaltyPointsEarned = calculatePoints({
      pretaxCost: usdPretaxCost,
      basePointRate,
      calculationCurrency: calcCurrency,
      calcCurrencyToUsdRate,
      eliteStatus: userStatus?.eliteStatus
        ? {
            bonusPercentage: userStatus.eliteStatus.bonusPercentage,
            fixedRate: userStatus.eliteStatus.fixedRate,
            isFixed: userStatus.eliteStatus.isFixed,
            pointsFloorTo: userStatus.eliteStatus.pointsFloorTo,
          }
        : null,
    });
  }

  // ── Locked loyalty USD rate ────────────────────────────────────────────────
  // Snapshot programCentsPerPoint × program-currency/USD rate at check-in for
  // foreign-currency programs (e.g. Accor/EUR). Uses programCurrency rate — NOT
  // the booking currency — since programCentsPerPoint is denominated in programCurrency.
  let lockedLoyaltyUsdCentsPerPoint: number | null = null;
  if (isPast && hotelChainId) {
    const hcWithPt = await prisma.hotelChain.findUnique({
      where: { id: hotelChainId },
      select: {
        pointType: { select: { programCurrency: true, programCentsPerPoint: true } },
      },
    });
    const pt = hcWithPt?.pointType;
    if (pt?.programCurrency != null && pt?.programCentsPerPoint != null) {
      const programRate = await getOrFetchHistoricalRate(pt.programCurrency, checkIn);
      if (programRate != null) {
        lockedLoyaltyUsdCentsPerPoint = Number(pt.programCentsPerPoint) * programRate;
      }
    }
  }

  return { lockedExchangeRate, loyaltyPointsEarned, lockedLoyaltyUsdCentsPerPoint };
}
