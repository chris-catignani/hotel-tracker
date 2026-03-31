-- Backfill posting statuses for existing bookings that predate the feature.
-- Mirrors the logic in the booking PUT route.

UPDATE bookings
SET loyalty_posting_status = 'pending'::"PostingStatus"
WHERE loyalty_posting_status IS NULL
  AND loyalty_points_earned IS NOT NULL
  AND accommodation_type != 'apartment'
  AND hotel_chain_id IS NOT NULL;

UPDATE bookings
SET card_reward_posting_status = 'pending'::"PostingStatus"
WHERE card_reward_posting_status IS NULL
  AND user_credit_card_id IS NOT NULL;

UPDATE bookings
SET portal_cashback_posting_status = 'pending'::"PostingStatus"
WHERE portal_cashback_posting_status IS NULL
  AND shopping_portal_id IS NOT NULL;
