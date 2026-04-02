import prisma from "@/lib/prisma";
import { Prisma, BenefitPeriod } from "@prisma/client";
import { AppError } from "@/lib/app-error";
import { reapplyBenefitForAllUsers } from "@/services/card-benefit-apply";

// ---------------------------------------------------------------------------
// Shared include
// ---------------------------------------------------------------------------

const CARD_BENEFIT_INCLUDE = {
  hotelChain: { select: { id: true, name: true } },
  otaAgencies: { include: { otaAgency: { select: { id: true, name: true } } } },
} as const;

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------

export type FullCardBenefit = Prisma.CardBenefitGetPayload<{
  include: typeof CARD_BENEFIT_INCLUDE;
}>;

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface CreateCardBenefitInput {
  creditCardId: string;
  description: string;
  value: number;
  maxValuePerBooking?: number | null;
  period: BenefitPeriod;
  hotelChainId?: string | null;
  otaAgencyIds?: string[];
  isActive?: boolean;
  startDate?: string | null;
  endDate?: string | null;
}

export interface UpdateCardBenefitInput {
  creditCardId?: string;
  description?: string;
  value?: number;
  maxValuePerBooking?: number | null;
  period?: BenefitPeriod;
  hotelChainId?: string | null;
  otaAgencyIds?: string[];
  isActive?: boolean;
  startDate?: string | null;
  endDate?: string | null;
}

// ---------------------------------------------------------------------------
// Service functions
// ---------------------------------------------------------------------------

/** List all card benefits ordered by creditCardId then createdAt. */
export async function listCardBenefits(): Promise<FullCardBenefit[]> {
  return prisma.cardBenefit.findMany({
    include: CARD_BENEFIT_INCLUDE,
    orderBy: [{ creditCardId: "asc" }, { createdAt: "asc" }],
  });
}

/**
 * Fetch a single card benefit by id.
 * Throws AppError(404) if not found.
 */
export async function getCardBenefit(id: string): Promise<FullCardBenefit> {
  const benefit = await prisma.cardBenefit.findUnique({
    where: { id },
    include: CARD_BENEFIT_INCLUDE,
  });
  if (!benefit) throw new AppError("Card benefit not found", 404);
  return benefit;
}

/**
 * Create a card benefit with optional OTA agency links.
 * Calls reapplyBenefitForAllUsers after creation.
 * Throws AppError(400) if required fields are missing.
 */
export async function createCardBenefit(data: CreateCardBenefitInput): Promise<FullCardBenefit> {
  const {
    creditCardId,
    description,
    value,
    maxValuePerBooking,
    period,
    hotelChainId,
    otaAgencyIds,
    isActive,
    startDate,
    endDate,
  } = data;

  if (!creditCardId || !description || value == null || !period) {
    throw new AppError("creditCardId, description, value, and period are required", 400);
  }

  const benefit = await prisma.cardBenefit.create({
    data: {
      creditCardId,
      description,
      value: Number(value),
      maxValuePerBooking: maxValuePerBooking != null ? Number(maxValuePerBooking) : null,
      period: period as BenefitPeriod,
      hotelChainId: hotelChainId || null,
      isActive: isActive ?? true,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      otaAgencies:
        Array.isArray(otaAgencyIds) && otaAgencyIds.length > 0
          ? { create: otaAgencyIds.map((id: string) => ({ otaAgencyId: id })) }
          : undefined,
    },
    include: CARD_BENEFIT_INCLUDE,
  });

  await reapplyBenefitForAllUsers(benefit.id);
  return benefit;
}

/**
 * Update a card benefit. OTA agencies are replaced if otaAgencyIds is provided.
 * Calls reapplyBenefitForAllUsers after update.
 */
export async function updateCardBenefit(
  id: string,
  data: UpdateCardBenefitInput
): Promise<FullCardBenefit> {
  const {
    creditCardId,
    description,
    value,
    maxValuePerBooking,
    period,
    hotelChainId,
    otaAgencyIds,
    isActive,
    startDate,
    endDate,
  } = data;

  const updateData: Record<string, unknown> = {};
  if (creditCardId !== undefined) updateData.creditCardId = creditCardId;
  if (description !== undefined) updateData.description = description;
  if (value !== undefined) updateData.value = Number(value);
  if (maxValuePerBooking !== undefined)
    updateData.maxValuePerBooking = maxValuePerBooking != null ? Number(maxValuePerBooking) : null;
  if (period !== undefined) updateData.period = period as BenefitPeriod;
  if (hotelChainId !== undefined) updateData.hotelChainId = hotelChainId || null;
  if (isActive !== undefined) updateData.isActive = isActive;
  if (startDate !== undefined) updateData.startDate = startDate ? new Date(startDate) : null;
  if (endDate !== undefined) updateData.endDate = endDate ? new Date(endDate) : null;

  const benefit = await prisma.$transaction(async (tx) => {
    if (otaAgencyIds !== undefined) {
      await tx.cardBenefitOtaAgency.deleteMany({ where: { cardBenefitId: id } });
      if (Array.isArray(otaAgencyIds) && otaAgencyIds.length > 0) {
        await tx.cardBenefitOtaAgency.createMany({
          data: otaAgencyIds.map((otaAgencyId: string) => ({ cardBenefitId: id, otaAgencyId })),
        });
      }
    }
    return tx.cardBenefit.update({
      where: { id },
      data: updateData,
      include: CARD_BENEFIT_INCLUDE,
    });
  });

  await reapplyBenefitForAllUsers(benefit.id);
  return benefit;
}

/** Delete a card benefit. */
export async function deleteCardBenefit(id: string): Promise<void> {
  await prisma.cardBenefit.delete({ where: { id } });
}
