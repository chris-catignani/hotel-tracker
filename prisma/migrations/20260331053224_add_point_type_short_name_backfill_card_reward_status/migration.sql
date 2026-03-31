-- AlterTable
ALTER TABLE "point_types" ADD COLUMN     "short_name" TEXT;

-- Backfill short_name for all known point types
UPDATE "point_types" SET "short_name" = 'ALL'    WHERE id = 'coa03zp46q2v01c4l4knm1rcg';
UPDATE "point_types" SET "short_name" = 'Avios'  WHERE id = 'c4rk0idsjpnfriatk1qulswgx';
UPDATE "point_types" SET "short_name" = 'Bilt'   WHERE id = 'cbuf26mcgjs61kr9bybazq95j';
UPDATE "point_types" SET "short_name" = 'Cap1'   WHERE id = 'cwhd30omk2xajtvfa2iqmmgab';
UPDATE "point_types" SET "short_name" = 'D$'     WHERE id = 'c8wn8dzybdbymevuucmup1j96';
UPDATE "point_types" SET "short_name" = 'Hilton' WHERE id = 'cyh0r61a810u6qrgfj515tkid';
UPDATE "point_types" SET "short_name" = 'IHG'    WHERE id = 'cmcri5r30guyq8l8f2pvaqwr7';
UPDATE "point_types" SET "short_name" = 'Bonvoy' WHERE id = 'ctv910qcpclvq0b9thpcw12x6';
UPDATE "point_types" SET "short_name" = 'MR'     WHERE id = 'cc0pgnx83hbjbbwxi99qocq52';
UPDATE "point_types" SET "short_name" = 'Qantas' WHERE id = 'cqantas0points0type000001';
UPDATE "point_types" SET "short_name" = 'UR'     WHERE id = 'c8974es8z9vnwdgt934zrlare';
UPDATE "point_types" SET "short_name" = 'WF'     WHERE id = 'c0kuqb3diocim6kgaxo0b3w0r';
UPDATE "point_types" SET "short_name" = 'Hyatt'  WHERE id = 'cd0y4mrv3iwc2r2gwgwy722zk';

-- Backfill card_reward_posting_status = 'pending' for bookings that have a credit card
-- but were created before this field was introduced.
UPDATE "bookings"
SET "card_reward_posting_status" = 'pending'
WHERE "user_credit_card_id" IS NOT NULL
  AND "card_reward_posting_status" IS NULL;
