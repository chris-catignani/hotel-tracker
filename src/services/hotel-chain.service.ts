import prisma from "@/lib/prisma";
import { AppError } from "@/lib/app-error";
import { normalizeUserStatuses } from "@/lib/normalize-response";
import { getCurrentRate } from "@/services/exchange-rate";
import { recalculateLoyaltyForHotelChain } from "@/services/loyalty-recalculation";

// ---------------------------------------------------------------------------
// Exported helpers
// ---------------------------------------------------------------------------

/**
 * Normalises and validates a raw calculationCurrency value from a request body.
 * Returns the resolved 3-letter code, or null if the value is invalid.
 */
export function parseCalculationCurrency(raw: unknown): string | null {
  if (raw !== undefined && raw !== "" && typeof raw !== "string") return null;
  const value = (typeof raw === "string" ? raw : null) || "USD";
  return /^[A-Z]{3}$/.test(value) ? value : null;
}

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface CreateHotelChainInput {
  name: string;
  loyaltyProgram?: string | null;
  basePointRate?: number | null;
  calculationCurrency?: string;
  pointTypeId?: string | null;
}

export interface UpdateHotelChainInput {
  name?: string;
  loyaltyProgram?: string | null;
  basePointRate?: number | null;
  calculationCurrency?: string;
  pointTypeId?: string | null;
}

// ---------------------------------------------------------------------------
// Service functions
// ---------------------------------------------------------------------------

/** Fetch all hotel chains enriched with calcCurrencyToUsdRate for non-USD chains. */
export async function listHotelChains(userId: string) {
  const hotelChains = await prisma.hotelChain.findMany({
    include: {
      pointType: true,
      hotelChainSubBrands: { orderBy: { name: "asc" } },
      eliteStatuses: { orderBy: { eliteTierLevel: "asc" } },
      userStatuses: { where: { userId }, include: { eliteStatus: true }, take: 1 },
    },
    orderBy: { name: "asc" },
  });

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
      calcRateCache.set(curr, await getCurrentRate(curr));
    })
  );

  const enriched = hotelChains.map((h) => ({
    ...h,
    calcCurrencyToUsdRate:
      h.calculationCurrency && h.calculationCurrency !== "USD"
        ? (calcRateCache.get(h.calculationCurrency) ?? null)
        : null,
  }));

  return normalizeUserStatuses(enriched);
}

/**
 * Fetch a single hotel chain.
 * Throws AppError(404) if not found.
 */
export async function getHotelChain(id: string, userId: string) {
  const hotelChain = await prisma.hotelChain.findUnique({
    where: { id },
    include: {
      pointType: true,
      hotelChainSubBrands: true,
      eliteStatuses: true,
      userStatuses: { where: { userId }, include: { eliteStatus: true }, take: 1 },
    },
  });
  if (!hotelChain) throw new AppError("Hotel chain not found", 404);
  return normalizeUserStatuses(hotelChain);
}

/**
 * Create a hotel chain.
 * Throws AppError(400) if calculationCurrency is invalid.
 */
export async function createHotelChain(data: CreateHotelChainInput) {
  const { name, loyaltyProgram, basePointRate, calculationCurrency, pointTypeId } = data;

  const resolvedCurrency = parseCalculationCurrency(calculationCurrency);
  if (resolvedCurrency === null) {
    throw new AppError("Invalid calculationCurrency: must be a 3-letter ISO 4217 code", 400);
  }

  const hotelChain = await prisma.hotelChain.create({
    data: {
      name,
      loyaltyProgram: loyaltyProgram || null,
      basePointRate: basePointRate != null ? Number(basePointRate) : null,
      calculationCurrency: resolvedCurrency,
      pointTypeId: pointTypeId || null,
    },
    include: {
      pointType: true,
      eliteStatuses: { orderBy: { eliteTierLevel: "asc" } },
      userStatuses: { take: 0 },
    },
  });

  return normalizeUserStatuses(hotelChain);
}

/**
 * Update a hotel chain.
 * Throws AppError(400) if calculationCurrency is invalid.
 * Triggers recalculateLoyaltyForHotelChain if basePointRate or calculationCurrency changed.
 */
export async function updateHotelChain(id: string, userId: string, data: UpdateHotelChainInput) {
  const { name, loyaltyProgram, basePointRate, calculationCurrency, pointTypeId } = data;

  let resolvedCurrency: string | undefined;
  if (calculationCurrency !== undefined) {
    const parsed = parseCalculationCurrency(calculationCurrency);
    if (parsed === null) {
      throw new AppError("Invalid calculationCurrency: must be a 3-letter ISO 4217 code", 400);
    }
    resolvedCurrency = parsed;
  }

  const existing = await prisma.hotelChain.findUnique({
    where: { id },
    select: { basePointRate: true, calculationCurrency: true },
  });
  if (!existing) throw new AppError("Hotel chain not found", 404);

  const updateData: Record<string, unknown> = {};
  if (name !== undefined) updateData.name = name;
  if (loyaltyProgram !== undefined) updateData.loyaltyProgram = loyaltyProgram || null;
  if (basePointRate !== undefined)
    updateData.basePointRate = basePointRate != null ? Number(basePointRate) : null;
  if (resolvedCurrency !== undefined) updateData.calculationCurrency = resolvedCurrency;
  if (pointTypeId !== undefined) updateData.pointTypeId = pointTypeId || null;

  const hotelChain = await prisma.hotelChain.update({
    where: { id },
    data: updateData,
    include: {
      pointType: true,
      eliteStatuses: { orderBy: { eliteTierLevel: "asc" } },
      userStatuses: { where: { userId }, include: { eliteStatus: true }, take: 1 },
    },
  });

  const rateChanged =
    basePointRate !== undefined && Number(existing?.basePointRate) !== Number(basePointRate);
  const currencyChanged =
    resolvedCurrency !== undefined && (existing?.calculationCurrency ?? "USD") !== resolvedCurrency;
  if (rateChanged || currencyChanged) {
    await recalculateLoyaltyForHotelChain(id);
  }

  return normalizeUserStatuses(hotelChain);
}

/**
 * Delete a hotel chain.
 * Throws AppError(409) if bookings or sub-brands exist.
 */
export async function deleteHotelChain(id: string): Promise<void> {
  const existing = await prisma.hotelChain.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new AppError("Hotel chain not found", 404);

  const [bookingCount, subBrandCount] = await Promise.all([
    prisma.booking.count({ where: { hotelChainId: id } }),
    prisma.hotelChainSubBrand.count({ where: { hotelChainId: id } }),
  ]);
  if (bookingCount > 0) {
    throw new AppError("Cannot delete hotel chain with existing bookings", 409);
  }
  if (subBrandCount > 0) {
    throw new AppError("Cannot delete hotel chain with existing sub-brands", 409);
  }

  await prisma.hotelChain.delete({ where: { id } });
}
