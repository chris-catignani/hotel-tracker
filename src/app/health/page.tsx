import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExternalLink } from "lucide-react";

interface ServiceLink {
  title: string;
  description: string;
  href: string | null;
  unconfiguredMessage?: string;
}

function buildSentryUrl(): string | null {
  const org = process.env.SENTRY_ORG;
  const project = process.env.SENTRY_PROJECT;
  if (!org || !project) return null;
  return `https://sentry.io/organizations/${org}/issues/?project=${project}&query=is%3Aunresolved&statsPeriod=24h`;
}

export default function HealthPage() {
  const links: ServiceLink[] = [
    {
      title: "Axiom",
      description: "Logs, email ingestion stats, and job health dashboards",
      href: process.env.NEXT_PUBLIC_AXIOM_DASHBOARD_URL ?? "https://app.axiom.co",
    },
    {
      title: "Sentry",
      description: "Errors and warnings (unresolved issues, 24h)",
      href: buildSentryUrl(),
      unconfiguredMessage: "Set SENTRY_ORG + SENTRY_PROJECT to enable",
    },
    {
      title: "GitHub Actions",
      description: "CI status and workflows",
      href: "https://github.com/chris-catignani/hotel-tracker/actions",
    },
    {
      title: "Vercel",
      description: "Deployments and logs",
      href: "https://vercel.com/dashboard",
    },
  ];

  return (
    <div className="flex flex-col flex-1 min-h-0 space-y-6">
      <h1 className="text-2xl font-bold shrink-0">Health</h1>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">External Services</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {links.map(({ title, description, href, unconfiguredMessage }) =>
              href ? (
                <Link
                  key={title}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between rounded-lg border p-4 hover:bg-muted/50 transition-colors"
                >
                  <div>
                    <p className="font-medium text-sm">{title}</p>
                    <p className="text-xs text-muted-foreground">{description}</p>
                  </div>
                  <ExternalLink className="size-4 text-muted-foreground shrink-0" />
                </Link>
              ) : (
                <div
                  key={title}
                  className="flex items-center justify-between rounded-lg border p-4 opacity-50"
                >
                  <div>
                    <p className="font-medium text-sm">{title}</p>
                    <p className="text-xs text-muted-foreground">
                      {unconfiguredMessage ?? description}
                    </p>
                  </div>
                </div>
              )
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
