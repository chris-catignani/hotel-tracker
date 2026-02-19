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
  const stats = [
    { label: "Total Bookings", value: totalBookings.toString() },
    { label: "Total Spend", value: formatDollars(totalSpend) },
    { label: "Total Savings", value: formatDollars(totalSavings) },
    { label: "Total Nights", value: totalNights.toString() },
    { label: "Avg Net Cost / Night", value: formatDollars(avgNetCostPerNight) },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
      {stats.map((stat) => (
        <Card key={stat.label}>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {stat.label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stat.value}</p>
          </CardContent>
        </Card>
      ))}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Award Points Redeemed
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">
            {totalPointsRedeemed > 0
              ? `${totalPointsRedeemed.toLocaleString("en-US")} pts`
              : totalCertificates > 0
              ? `${totalCertificates} cert${totalCertificates !== 1 ? "s" : ""}`
              : "—"}
          </p>
          {totalPointsRedeemed > 0 && totalCertificates > 0 && (
            <p className="text-sm text-muted-foreground mt-1">
              + {totalCertificates} cert{totalCertificates !== 1 ? "s" : ""}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
