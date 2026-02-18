import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface DashboardStatsProps {
  totalBookings: number;
  totalSpend: number;
  totalSavings: number;
  avgNetCost: number;
  avgNetCostPerNight: number;
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
  avgNetCost,
  avgNetCostPerNight,
}: DashboardStatsProps) {
  const stats = [
    { label: "Total Bookings", value: totalBookings.toString() },
    { label: "Total Spend", value: formatDollars(totalSpend) },
    { label: "Total Savings", value: formatDollars(totalSavings) },
    { label: "Avg Net Cost", value: formatDollars(avgNetCost) },
    { label: "Avg Net Cost / Night", value: formatDollars(avgNetCostPerNight) },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
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
    </div>
  );
}
