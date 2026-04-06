import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { calculateCCPointsEarned, calculatePortalPointsEarned } from "@/lib/booking-points-utils";

interface PointsEarnedBooking {
  loyaltyPointsEarned: number | null;
  loyaltyPointsEstimated?: boolean;
  hotelChain: { id?: string; name: string; loyaltyProgram: string | null } | null;
  totalCost: string | number;
  pretaxCost: string | number;
  lockedExchangeRate: string | number | null;
  hotelChainId: string | null;
  otaAgencyId: string | null;
  userCreditCard: {
    creditCard: {
      name: string;
      rewardType: string;
      rewardRate: string | number;
      rewardRules?: {
        rewardType: string;
        rewardValue: string | number;
        hotelChainId: string | null;
        otaAgencyId: string | null;
      }[];
    };
  } | null;
  shoppingPortal: { name: string; rewardType: string } | null;
  portalCashbackRate: string | number | null;
  portalCashbackOnTotal: boolean | null;
}

export function BookingPointsEarned({ booking }: { booking: PointsEarnedBooking }) {
  const loyaltyPoints = booking.loyaltyPointsEarned;
  const ccPoints = calculateCCPointsEarned(booking);
  const portalPoints = calculatePortalPointsEarned(booking);

  if (loyaltyPoints == null && ccPoints == null && portalPoints == null) return null;

  return (
    <Card data-testid="points-earned-card">
      <CardHeader>
        <CardTitle>Points Earned</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2" data-testid="points-earned-list">
          {loyaltyPoints != null && (
            <li className="flex items-center justify-between" data-testid="loyalty-points-row">
              <span>
                {booking.hotelChain?.loyaltyProgram ?? booking.hotelChain?.name ?? "Loyalty"}
              </span>
              <span className="font-medium" data-testid="loyalty-points-value">
                {loyaltyPoints.toLocaleString()} pts
              </span>
            </li>
          )}
          {ccPoints != null && (
            <li className="flex items-center justify-between" data-testid="cc-points-row">
              <span>{booking.userCreditCard?.creditCard.name ?? ""}</span>
              <span className="font-medium" data-testid="cc-points-value">
                {ccPoints.toLocaleString()} pts
              </span>
            </li>
          )}
          {portalPoints != null && (
            <li className="flex items-center justify-between" data-testid="portal-points-row">
              <span>{booking.shoppingPortal?.name ?? ""}</span>
              <span className="font-medium" data-testid="portal-points-value">
                {portalPoints.toLocaleString()} pts
              </span>
            </li>
          )}
        </ul>
      </CardContent>
    </Card>
  );
}
