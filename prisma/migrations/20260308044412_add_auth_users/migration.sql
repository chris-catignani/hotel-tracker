-- CreateEnum
CREATE TYPE "PointCategory" AS ENUM ('hotel', 'airline', 'transferable');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "BookingSourceType" AS ENUM ('direct_web', 'direct_app', 'ota', 'other');

-- CreateEnum
CREATE TYPE "CertType" AS ENUM ('marriott_35k', 'marriott_40k', 'marriott_50k', 'marriott_85k', 'hyatt_cat1_4', 'hyatt_cat1_7', 'ihg_40k');

-- CreateEnum
CREATE TYPE "BenefitType" AS ENUM ('free_breakfast', 'dining_credit', 'spa_credit', 'room_upgrade', 'late_checkout', 'early_checkin', 'other');

-- CreateEnum
CREATE TYPE "CreditCardRewardRuleType" AS ENUM ('multiplier', 'fixed');

-- CreateEnum
CREATE TYPE "SubBrandRestrictionMode" AS ENUM ('include', 'exclude');

-- CreateEnum
CREATE TYPE "PromotionType" AS ENUM ('credit_card', 'portal', 'loyalty');

-- CreateEnum
CREATE TYPE "PromotionRewardType" AS ENUM ('points', 'cashback', 'certificate', 'eqn');

-- CreateEnum
CREATE TYPE "PromotionBenefitValueType" AS ENUM ('fixed', 'percentage', 'multiplier');

-- CreateEnum
CREATE TYPE "PointsMultiplierBasis" AS ENUM ('base_only', 'base_and_elite');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "email_verified" TIMESTAMP(3),
    "image" TEXT,
    "password" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_account_id" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "session_token" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "point_types" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "PointCategory" NOT NULL,
    "cents_per_point" DECIMAL(10,6) NOT NULL,

    CONSTRAINT "point_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hotel_chains" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "loyalty_program" TEXT,
    "base_point_rate" DECIMAL(10,4),
    "point_type_id" TEXT,

    CONSTRAINT "hotel_chains_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hotel_chain_sub_brands" (
    "id" TEXT NOT NULL,
    "hotel_chain_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "base_point_rate" DECIMAL(10,4),

    CONSTRAINT "hotel_chain_sub_brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hotel_chain_elite_statuses" (
    "id" TEXT NOT NULL,
    "hotel_chain_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "elite_tier_level" INTEGER NOT NULL DEFAULT 0,
    "bonus_percentage" DECIMAL(10,4),
    "fixed_rate" DECIMAL(10,4),
    "is_fixed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "hotel_chain_elite_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_statuses" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "hotel_chain_id" TEXT NOT NULL,
    "elite_status_id" TEXT,

    CONSTRAINT "user_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_cards" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "reward_type" TEXT NOT NULL,
    "reward_rate" DECIMAL(10,4) NOT NULL,
    "point_type_id" TEXT,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "credit_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shopping_portals" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "reward_type" TEXT NOT NULL DEFAULT 'cashback',
    "point_type_id" TEXT,

    CONSTRAINT "shopping_portals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ota_agencies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "ota_agencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "hotel_chain_id" TEXT NOT NULL,
    "hotel_chain_sub_brand_id" TEXT,
    "property_name" TEXT NOT NULL,
    "check_in" DATE NOT NULL,
    "check_out" DATE NOT NULL,
    "num_nights" INTEGER NOT NULL,
    "pretax_cost" DECIMAL(10,2) NOT NULL,
    "tax_amount" DECIMAL(10,2) NOT NULL,
    "total_cost" DECIMAL(10,2) NOT NULL,
    "credit_card_id" TEXT,
    "shopping_portal_id" TEXT,
    "portal_cashback_rate" DECIMAL(10,4),
    "portal_cashback_on_total" BOOLEAN NOT NULL DEFAULT false,
    "loyalty_points_earned" INTEGER,
    "points_redeemed" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "original_amount" DECIMAL(10,2),
    "booking_source" "BookingSourceType",
    "ota_agency_id" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_benefits" (
    "id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "benefit_type" "BenefitType" NOT NULL,
    "label" TEXT,
    "dollar_value" DECIMAL(10,2),

    CONSTRAINT "booking_benefits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_certificates" (
    "id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "cert_type" "CertType" NOT NULL,

    CONSTRAINT "booking_certificates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promotion_restrictions" (
    "id" TEXT NOT NULL,
    "min_spend" DECIMAL(10,2),
    "min_nights_required" INTEGER,
    "nights_stackable" BOOLEAN NOT NULL DEFAULT false,
    "span_stays" BOOLEAN NOT NULL DEFAULT false,
    "max_stay_count" INTEGER,
    "max_reward_count" INTEGER,
    "max_redemption_value" DECIMAL(10,2),
    "max_total_bonus_points" INTEGER,
    "once_per_sub_brand" BOOLEAN NOT NULL DEFAULT false,
    "book_by_date" DATE,
    "registration_deadline" DATE,
    "valid_days_after_registration" INTEGER,
    "tie_in_requires_payment" BOOLEAN NOT NULL DEFAULT false,
    "allowed_payment_types" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "allowed_booking_sources" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "hotel_chain_id" TEXT,
    "prerequisite_stay_count" INTEGER,
    "prerequisite_night_count" INTEGER,

    CONSTRAINT "promotion_restrictions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promotion_sub_brand_restrictions" (
    "id" TEXT NOT NULL,
    "promotion_restrictions_id" TEXT NOT NULL,
    "hotel_chain_sub_brand_id" TEXT NOT NULL,
    "mode" "SubBrandRestrictionMode" NOT NULL,

    CONSTRAINT "promotion_sub_brand_restrictions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promotion_restriction_tie_in_cards" (
    "id" TEXT NOT NULL,
    "promotion_restrictions_id" TEXT NOT NULL,
    "credit_card_id" TEXT NOT NULL,

    CONSTRAINT "promotion_restriction_tie_in_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promotions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "name" TEXT NOT NULL,
    "type" "PromotionType" NOT NULL,
    "hotel_chain_id" TEXT,
    "credit_card_id" TEXT,
    "shopping_portal_id" TEXT,
    "start_date" DATE,
    "end_date" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "restrictions_id" TEXT,

    CONSTRAINT "promotions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_promotions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "promotion_id" TEXT NOT NULL,
    "registration_date" DATE NOT NULL,

    CONSTRAINT "user_promotions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promotion_tiers" (
    "id" TEXT NOT NULL,
    "promotion_id" TEXT NOT NULL,
    "min_stays" INTEGER,
    "max_stays" INTEGER,
    "min_nights" INTEGER,
    "max_nights" INTEGER,

    CONSTRAINT "promotion_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promotion_benefits" (
    "id" TEXT NOT NULL,
    "promotion_id" TEXT,
    "promotion_tier_id" TEXT,
    "reward_type" "PromotionRewardType" NOT NULL,
    "value_type" "PromotionBenefitValueType" NOT NULL,
    "value" DECIMAL(10,4) NOT NULL,
    "cert_type" TEXT,
    "points_multiplier_basis" "PointsMultiplierBasis" DEFAULT 'base_only',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "restrictions_id" TEXT,

    CONSTRAINT "promotion_benefits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_promotions" (
    "id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "promotion_id" TEXT NOT NULL,
    "applied_value" DECIMAL(10,2) NOT NULL,
    "bonus_points_applied" INTEGER,
    "is_orphaned" BOOLEAN NOT NULL DEFAULT false,
    "is_pre_qualifying" BOOLEAN NOT NULL DEFAULT false,
    "auto_applied" BOOLEAN NOT NULL DEFAULT true,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "eligible_nights_at_booking" INTEGER,

    CONSTRAINT "booking_promotions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_promotion_benefits" (
    "id" TEXT NOT NULL,
    "booking_promotion_id" TEXT NOT NULL,
    "promotion_benefit_id" TEXT NOT NULL,
    "applied_value" DECIMAL(10,2) NOT NULL,
    "bonus_points_applied" INTEGER,
    "is_orphaned" BOOLEAN NOT NULL DEFAULT false,
    "is_pre_qualifying" BOOLEAN NOT NULL DEFAULT false,
    "eligible_nights_at_booking" INTEGER,

    CONSTRAINT "booking_promotion_benefits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_card_reward_rules" (
    "id" TEXT NOT NULL,
    "credit_card_id" TEXT NOT NULL,
    "hotel_chain_id" TEXT,
    "ota_agency_id" TEXT,
    "reward_type" "CreditCardRewardRuleType" NOT NULL,
    "reward_value" DECIMAL(10,4) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_card_reward_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_provider_account_id_key" ON "accounts"("provider", "provider_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_session_token_key" ON "sessions"("session_token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "hotel_chain_sub_brands_hotel_chain_id_name_key" ON "hotel_chain_sub_brands"("hotel_chain_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "hotel_chain_elite_statuses_hotel_chain_id_name_key" ON "hotel_chain_elite_statuses"("hotel_chain_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "user_statuses_user_id_hotel_chain_id_key" ON "user_statuses"("user_id", "hotel_chain_id");

-- CreateIndex
CREATE INDEX "bookings_check_in_idx" ON "bookings"("check_in");

-- CreateIndex
CREATE INDEX "bookings_created_at_idx" ON "bookings"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "promotion_sub_brand_restrictions_promotion_restrictions_id__key" ON "promotion_sub_brand_restrictions"("promotion_restrictions_id", "hotel_chain_sub_brand_id");

-- CreateIndex
CREATE UNIQUE INDEX "promotion_restriction_tie_in_cards_promotion_restrictions_i_key" ON "promotion_restriction_tie_in_cards"("promotion_restrictions_id", "credit_card_id");

-- CreateIndex
CREATE UNIQUE INDEX "promotions_restrictions_id_key" ON "promotions"("restrictions_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_promotions_promotion_id_key" ON "user_promotions"("promotion_id");

-- CreateIndex
CREATE UNIQUE INDEX "promotion_benefits_restrictions_id_key" ON "promotion_benefits"("restrictions_id");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hotel_chains" ADD CONSTRAINT "hotel_chains_point_type_id_fkey" FOREIGN KEY ("point_type_id") REFERENCES "point_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hotel_chain_sub_brands" ADD CONSTRAINT "hotel_chain_sub_brands_hotel_chain_id_fkey" FOREIGN KEY ("hotel_chain_id") REFERENCES "hotel_chains"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hotel_chain_elite_statuses" ADD CONSTRAINT "hotel_chain_elite_statuses_hotel_chain_id_fkey" FOREIGN KEY ("hotel_chain_id") REFERENCES "hotel_chains"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_statuses" ADD CONSTRAINT "user_statuses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_statuses" ADD CONSTRAINT "user_statuses_hotel_chain_id_fkey" FOREIGN KEY ("hotel_chain_id") REFERENCES "hotel_chains"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_statuses" ADD CONSTRAINT "user_statuses_elite_status_id_fkey" FOREIGN KEY ("elite_status_id") REFERENCES "hotel_chain_elite_statuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_cards" ADD CONSTRAINT "credit_cards_point_type_id_fkey" FOREIGN KEY ("point_type_id") REFERENCES "point_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shopping_portals" ADD CONSTRAINT "shopping_portals_point_type_id_fkey" FOREIGN KEY ("point_type_id") REFERENCES "point_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_hotel_chain_id_fkey" FOREIGN KEY ("hotel_chain_id") REFERENCES "hotel_chains"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_hotel_chain_sub_brand_id_fkey" FOREIGN KEY ("hotel_chain_sub_brand_id") REFERENCES "hotel_chain_sub_brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_credit_card_id_fkey" FOREIGN KEY ("credit_card_id") REFERENCES "credit_cards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_shopping_portal_id_fkey" FOREIGN KEY ("shopping_portal_id") REFERENCES "shopping_portals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_ota_agency_id_fkey" FOREIGN KEY ("ota_agency_id") REFERENCES "ota_agencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_benefits" ADD CONSTRAINT "booking_benefits_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_certificates" ADD CONSTRAINT "booking_certificates_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_restrictions" ADD CONSTRAINT "promotion_restrictions_hotel_chain_id_fkey" FOREIGN KEY ("hotel_chain_id") REFERENCES "hotel_chains"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_sub_brand_restrictions" ADD CONSTRAINT "promotion_sub_brand_restrictions_promotion_restrictions_id_fkey" FOREIGN KEY ("promotion_restrictions_id") REFERENCES "promotion_restrictions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_sub_brand_restrictions" ADD CONSTRAINT "promotion_sub_brand_restrictions_hotel_chain_sub_brand_id_fkey" FOREIGN KEY ("hotel_chain_sub_brand_id") REFERENCES "hotel_chain_sub_brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_restriction_tie_in_cards" ADD CONSTRAINT "promotion_restriction_tie_in_cards_promotion_restrictions__fkey" FOREIGN KEY ("promotion_restrictions_id") REFERENCES "promotion_restrictions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_restriction_tie_in_cards" ADD CONSTRAINT "promotion_restriction_tie_in_cards_credit_card_id_fkey" FOREIGN KEY ("credit_card_id") REFERENCES "credit_cards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_hotel_chain_id_fkey" FOREIGN KEY ("hotel_chain_id") REFERENCES "hotel_chains"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_credit_card_id_fkey" FOREIGN KEY ("credit_card_id") REFERENCES "credit_cards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_shopping_portal_id_fkey" FOREIGN KEY ("shopping_portal_id") REFERENCES "shopping_portals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_restrictions_id_fkey" FOREIGN KEY ("restrictions_id") REFERENCES "promotion_restrictions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_promotions" ADD CONSTRAINT "user_promotions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_promotions" ADD CONSTRAINT "user_promotions_promotion_id_fkey" FOREIGN KEY ("promotion_id") REFERENCES "promotions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_tiers" ADD CONSTRAINT "promotion_tiers_promotion_id_fkey" FOREIGN KEY ("promotion_id") REFERENCES "promotions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_benefits" ADD CONSTRAINT "promotion_benefits_promotion_id_fkey" FOREIGN KEY ("promotion_id") REFERENCES "promotions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_benefits" ADD CONSTRAINT "promotion_benefits_promotion_tier_id_fkey" FOREIGN KEY ("promotion_tier_id") REFERENCES "promotion_tiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_benefits" ADD CONSTRAINT "promotion_benefits_restrictions_id_fkey" FOREIGN KEY ("restrictions_id") REFERENCES "promotion_restrictions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_promotions" ADD CONSTRAINT "booking_promotions_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_promotions" ADD CONSTRAINT "booking_promotions_promotion_id_fkey" FOREIGN KEY ("promotion_id") REFERENCES "promotions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_promotion_benefits" ADD CONSTRAINT "booking_promotion_benefits_booking_promotion_id_fkey" FOREIGN KEY ("booking_promotion_id") REFERENCES "booking_promotions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_promotion_benefits" ADD CONSTRAINT "booking_promotion_benefits_promotion_benefit_id_fkey" FOREIGN KEY ("promotion_benefit_id") REFERENCES "promotion_benefits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_card_reward_rules" ADD CONSTRAINT "credit_card_reward_rules_credit_card_id_fkey" FOREIGN KEY ("credit_card_id") REFERENCES "credit_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_card_reward_rules" ADD CONSTRAINT "credit_card_reward_rules_hotel_chain_id_fkey" FOREIGN KEY ("hotel_chain_id") REFERENCES "hotel_chains"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_card_reward_rules" ADD CONSTRAINT "credit_card_reward_rules_ota_agency_id_fkey" FOREIGN KEY ("ota_agency_id") REFERENCES "ota_agencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
