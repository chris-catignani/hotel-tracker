import { getOrFetchHistoricalRate } from "@/services/exchange-rate";
import type { CalculationDetail } from "@/lib/net-cost";

function formatCents(centsPerPoint: number): string {
  const c = centsPerPoint * 100;
  if (Number.isInteger(c)) return c.toString();
  return parseFloat(c.toFixed(2)).toString();
}

export interface PartnershipEarnInput {
  id: string;
  name: string;
  hotelChainId: string | null;
  earnRate: string | number;
  earnCurrency: string;
  countryCodes: string[];
  pointType: {
    name: string;
    shortName: string;
    category: string;
    usdCentsPerPoint: string | number;
  };
}

export interface PartnershipEarnResult {
  id: string;
  name: string;
  pointsEarned: number;
  earnedValue: number;
  pointTypeName: string;
  calc: CalculationDetail;
}

/**
 * Computes the earned value for each enabled PartnershipEarn row against a booking.
 * Filters out earns that don't match the booking's hotel chain or country code.
 * Uses historical exchange rates for past bookings.
 */
export async function resolvePartnershipEarns(
  booking: {
    hotelChainId: string | null;
    pretaxCost: string | number;
    lockedExchangeRate: string | number | null;
    property?: { countryCode?: string | null } | null;
    checkIn: Date | string;
  },
  enabledEarns: PartnershipEarnInput[]
): Promise<PartnershipEarnResult[]> {
  if (!enabledEarns.length) return [];

  const results: PartnershipEarnResult[] = [];
  const checkInStr =
    booking.checkIn instanceof Date
      ? booking.checkIn.toISOString().split("T")[0]
      : String(booking.checkIn).split("T")[0];

  // Pre-filter earns to only those that could apply to this booking.
  // This avoids fetching exchange rates for earns that will be filtered out anyway.
  const applicableEarns = enabledEarns.filter((earn) => {
    if (earn.hotelChainId && earn.hotelChainId !== booking.hotelChainId) return false;
    if (earn.countryCodes.length > 0) {
      const countryCode = booking.property?.countryCode;
      if (!countryCode || !earn.countryCodes.includes(countryCode)) return false;
    }
    return true;
  });
  if (!applicableEarns.length) return [];

  // pretaxCost in native currency → USD
  const exchangeRate = booking.lockedExchangeRate ? Number(booking.lockedExchangeRate) : 1;
  const pretaxCostUSD = Number(booking.pretaxCost) * exchangeRate;

  // Deduplicate earn currencies to avoid redundant API calls
  const uniqueCurrencies = [...new Set(applicableEarns.map((e) => e.earnCurrency))];
  const rateEntries = await Promise.all(
    uniqueCurrencies.map(
      async (currency) => [currency, await getOrFetchHistoricalRate(currency, checkInStr)] as const
    )
  );
  const rateByEarnCurrency = Object.fromEntries(rateEntries);

  for (const earn of applicableEarns) {
    const earnCurrencyRate = rateByEarnCurrency[earn.earnCurrency];
    if (!earnCurrencyRate) continue;

    const earnRate = Number(earn.earnRate);
    const centsPerPoint = Number(earn.pointType.usdCentsPerPoint);
    const centsStr = formatCents(centsPerPoint);
    const pointTypeLabel = earn.pointType.category === "airline" ? "miles" : "points";
    const pointTypeAbbr = earn.pointType.category === "airline" ? "miles" : "pts";

    // Convert USD pretax cost to the earn currency (e.g. AUD)
    // earnCurrencyRate = 1 earnCurrency = X USD, so pretaxInEarnCurrency = pretaxUSD / rate
    const pretaxInEarnCurrency = pretaxCostUSD / earnCurrencyRate;
    const pointsEarned = pretaxInEarnCurrency * earnRate;
    const earnedValue = pointsEarned * centsPerPoint;

    const calc: CalculationDetail = {
      label: earn.name,
      appliedValue: earnedValue,
      description: `${pointTypeLabel.charAt(0).toUpperCase() + pointTypeLabel.slice(1)} earned via the ${earn.name} partnership. Earn ${earnRate} ${pointTypeLabel} per ${earn.earnCurrency} 1 of pre-tax spend.`,
      groups: [
        {
          name: `${earn.name} ${earn.pointType.name}`,
          segments: [
            {
              label: "Points Earned",
              value: earnedValue,
              formula: `${pretaxCostUSD.toFixed(2)} USD ÷ ${earnCurrencyRate.toFixed(4)} ${earn.earnCurrency}/USD = ${pretaxInEarnCurrency.toFixed(2)} ${earn.earnCurrency} × ${earnRate} ${pointTypeAbbr}/${earn.earnCurrency} = ${Math.round(pointsEarned).toLocaleString()} ${pointTypeAbbr} × ${centsStr}¢ = $${earnedValue.toFixed(2)}`,
              description: `Pre-tax cost converted to ${earn.earnCurrency}, then multiplied by ${earnRate} ${pointTypeAbbr} per ${earn.earnCurrency} 1. Points valued at ${centsStr}¢ each.`,
            },
          ],
        },
      ],
    };

    results.push({
      id: earn.id,
      name: earn.name,
      pointsEarned,
      earnedValue,
      pointTypeName: earn.pointType.name,
      calc,
    });
  }

  return results;
}
