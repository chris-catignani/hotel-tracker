import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";

interface DashboardStatsProps {
  totalBookings: number;
  totalSpend: number;
  totalSavings: number;
  totalNights: number;
  avgCashNetCostPerNight: number | null;
  avgPointsPerNight: number | null;
  avgCertPointsPerNight: number | null;
  avgNightSkippedCount: number;
  totalPointsRedeemed: number;
  totalCertificates: number;
  bookingBreakdown?: { hotels: number; apartments: number };
  nightsBreakdown?: { hotels: number; apartments: number };
}

export function DashboardStats({
  totalBookings,
  totalSpend,
  totalSavings,
  totalNights,
  avgCashNetCostPerNight,
  avgPointsPerNight,
  avgCertPointsPerNight,
  avgNightSkippedCount,
  totalPointsRedeemed,
  totalCertificates,
  bookingBreakdown,
  nightsBreakdown,
}: DashboardStatsProps) {
  const statsAfter = [
    {
      label: "Total Savings",
      value: formatCurrency(totalSavings, "USD", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }),
    },
  ];

  const cashDisplay =
    totalSpend > 0
      ? formatCurrency(totalSpend, "USD", { minimumFractionDigits: 0, maximumFractionDigits: 0 })
      : "—";
  const pointsDisplay =
    totalPointsRedeemed > 0 ? `${totalPointsRedeemed.toLocaleString("en-US")} pts` : "—";
  const certsDisplay =
    totalCertificates > 0 ? `${totalCertificates} cert${totalCertificates !== 1 ? "s" : ""}` : "—";

  const avgCashDisplay =
    avgCashNetCostPerNight != null
      ? formatCurrency(avgCashNetCostPerNight, "USD", {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        })
      : "—";
  const avgPointsDisplay =
    avgPointsPerNight != null
      ? `${Math.round(avgPointsPerNight).toLocaleString("en-US")} pts`
      : "—";
  const avgCertsDisplay =
    avgCertPointsPerNight != null
      ? `${Math.round(avgCertPointsPerNight).toLocaleString("en-US")} pts`
      : "—";

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6 items-stretch">
      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground text-center">
            Total Bookings
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 text-center">
          <p className="text-2xl font-bold" data-testid="stat-value-total-bookings">
            {totalBookings}
          </p>
          {bookingBreakdown && (
            <p className="text-xs text-muted-foreground mt-1">
              {bookingBreakdown.hotels} hotels · {bookingBreakdown.apartments} apts
            </p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground text-center">
            Total Nights
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 text-center">
          <p className="text-2xl font-bold" data-testid="stat-value-total-nights">
            {totalNights}
          </p>
          {nightsBreakdown && (
            <p className="text-xs text-muted-foreground mt-1">
              {nightsBreakdown.hotels} hotels · {nightsBreakdown.apartments} apts
            </p>
          )}
        </CardContent>
      </Card>
      <Card className="lg:col-span-2">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground text-center">
            Total Spend
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 flex-1 flex items-center">
          <div className="flex justify-evenly w-full">
            <div className="text-center">
              <div className="text-sm text-muted-foreground">Cash</div>
              <div className="text-base font-bold" data-testid="stat-value-cash">
                {cashDisplay}
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm text-muted-foreground">Points</div>
              <div className="text-base font-bold" data-testid="stat-value-points">
                {pointsDisplay}
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm text-muted-foreground">Certs</div>
              <div className="text-base font-bold" data-testid="stat-value-certs">
                {certsDisplay}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card className="lg:col-span-2">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground text-center">
            Avg / Night
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 flex-1 flex flex-col justify-center gap-3">
          <div className="flex justify-evenly w-full">
            <div className="text-center">
              <div className="text-sm text-muted-foreground">Cash</div>
              <div className="text-base font-bold" data-testid="stat-value-avg-cash-net-per-night">
                {avgCashDisplay}
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm text-muted-foreground">Points</div>
              <div className="text-base font-bold" data-testid="stat-value-avg-points-per-night">
                {avgPointsDisplay}
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm text-muted-foreground">Certs</div>
              <div className="text-base font-bold" data-testid="stat-value-avg-certs-per-night">
                {avgCertsDisplay}
              </div>
            </div>
          </div>
          {avgNightSkippedCount > 0 && (
            <div
              className="p-2 bg-amber-50 border border-amber-200 rounded-md flex items-start gap-2 text-amber-800"
              data-testid="avg-night-skipped-warning"
            >
              <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <div className="text-xs">
                <span className="font-semibold">{avgNightSkippedCount}</span> combination{" "}
                {avgNightSkippedCount === 1 ? "booking" : "bookings"} excluded — mixed payment types
                not supported.
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      {statsAfter.map((stat) => (
        <Card key={stat.label}>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground text-center">
              {stat.label}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p
              className="text-2xl font-bold text-center"
              data-testid={`stat-value-${stat.label.toLowerCase().replace(/\s+/g, "-")}`}
            >
              {stat.value}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
