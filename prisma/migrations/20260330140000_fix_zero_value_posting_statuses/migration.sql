-- Clear loyalty_posting_status for bookings with 0 loyalty points.
-- The backfill migration incorrectly set these to 'pending' since it only
-- checked IS NOT NULL, but 0 points means there is nothing to post.
UPDATE bookings
SET loyalty_posting_status = NULL
WHERE loyalty_points_earned = 0
  AND loyalty_posting_status IS NOT NULL;

-- Clear card_reward_posting_status for bookings whose credit card has no
-- reward rules — these will always compute a $0 card reward.
UPDATE bookings
SET card_reward_posting_status = NULL
WHERE card_reward_posting_status IS NOT NULL
  AND user_credit_card_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM user_credit_cards ucc
    JOIN credit_cards cc ON cc.id = ucc.credit_card_id
    JOIN credit_card_reward_rules r ON r.credit_card_id = cc.id
    WHERE ucc.id = bookings.user_credit_card_id
  );
