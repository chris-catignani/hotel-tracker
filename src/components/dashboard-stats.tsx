import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface DashboardStatsProps {
  totalBookings: number;
  totalSpend: number;
  totalSavings: number;
  totalNights: number;
  avgNetCostPerNight: number;
  totalPointsRedeemed: number;
  totalCertificates: number;
}

function formatDollars(amount: number) {
  return `$${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function DashboardStats({
  totalBookings,
  totalSpend,
  totalSavings,
  totalNights,
  avgNetCostPerNight,
  totalPointsRedeemed,
  totalCertificates,
}: DashboardStatsProps) {
  const statsBefore = [
    { label: "Total Bookings", value: totalBookings.toString() },
    { label: "Total Nights", value: totalNights.toString() },
  ];

  const statsAfter = [
    { label: "Total Savings", value: formatDollars(totalSavings) },
    { label: "Avg Net Cost / Night", value: formatDollars(avgNetCostPerNight) },
  ];

  const cashDisplay =
    totalSpend > 0
      ? `$${Math.round(totalSpend).toLocaleString("en-US")}`
      : "—";
  const pointsDisplay =
    totalPointsRedeemed > 0
      ? `${totalPointsRedeemed.toLocaleString("en-US")} pts`
      : "—";
  const certsDisplay =
    totalCertificates > 0
      ? `${totalCertificates} cert${totalCertificates !== 1 ? "s" : ""}`
      : "—";

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6 items-start">
      {statsBefore.map((stat) => (
        <Card key={stat.label}>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground text-center">
              {stat.label}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-2xl font-bold text-center">{stat.value}</p>
          </CardContent>
        </Card>
      ))}
      <Card className="lg:col-span-2" style={{ gap: 0 }}>
        <CardHeader className="px-4 pt-3 pb-0">
          <CardTitle className="text-sm font-medium text-muted-foreground text-center">
            Total Spend
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pt-0 pb-3">
          <div className="flex justify-center gap-6">
            <div className="text-center">
              <div className="text-sm text-muted-foreground">Cash</div>
              <div className="text-base font-bold">{cashDisplay}</div>
            </div>
            <div className="text-center">
              <div className="text-sm text-muted-foreground">Points</div>
              <div className="text-base font-bold">{pointsDisplay}</div>
            </div>
            <div className="text-center">
              <div className="text-sm text-muted-foreground">Certs</div>
              <div className="text-base font-bold">{certsDisplay}</div>
            </div>
          </div>
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
            <p className="text-2xl font-bold text-center">{stat.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
