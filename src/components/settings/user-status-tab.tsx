"use client";

import { useCallback, useEffect, useState } from "react";
import { AppSelect } from "@/components/ui/app-select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { extractApiError } from "@/lib/client-error";
import { HotelChain, UserStatus } from "@/lib/types";
import { ErrorBanner } from "@/components/ui/error-banner";

interface PartnershipEarn {
  id: string;
  name: string;
  earnRate: string | number;
  earnCurrency: string;
  pointType: { name: string };
  isEnabled: boolean;
}

export function UserStatusTab() {
  const [userStatuses, setUserStatuses] = useState<UserStatus[]>([]);
  const [hotelChains, setHotelChains] = useState<HotelChain[]>([]);
  const [partnerships, setPartnerships] = useState<PartnershipEarn[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const [statusRes, chainsRes, partnershipsRes] = await Promise.all([
      fetch("/api/user-statuses"),
      fetch("/api/hotel-chains"),
      fetch("/api/partnership-earns"),
    ]);
    if (statusRes.ok) setUserStatuses(await statusRes.json());
    if (chainsRes.ok) setHotelChains(await chainsRes.json());
    if (partnershipsRes.ok) setPartnerships(await partnershipsRes.json());
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  const handlePartnershipToggle = async (partnershipEarnId: string, checked: boolean) => {
    setPartnerships((prev) =>
      prev.map((p) => (p.id === partnershipEarnId ? { ...p, isEnabled: checked } : p))
    );
    setError(null);
    const res = await fetch("/api/user-partnership-earns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ partnershipEarnId, isEnabled: checked }),
    });
    if (!res.ok) {
      setPartnerships((prev) =>
        prev.map((p) => (p.id === partnershipEarnId ? { ...p, isEnabled: !checked } : p))
      );
      setError(await extractApiError(res, "Failed to update partnership preference."));
    }
  };

  const handleStatusChange = async (hotelChainId: string, eliteStatusId: string) => {
    setError(null);
    const res = await fetch("/api/user-statuses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hotelChainId,
        eliteStatusId: eliteStatusId === "none" ? null : eliteStatusId,
      }),
    });
    if (res.ok) {
      fetchData();
    } else {
      setError(await extractApiError(res, "Failed to update status."));
    }
  };

  return (
    <div className="space-y-4">
      <ErrorBanner error={error} onDismiss={() => setError(null)} />
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">My Elite Status</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Select your current elite status level for each hotel chain to improve point earning
        calculations.
      </p>

      <Table data-testid="user-status-table">
        <TableHeader>
          <TableRow>
            <TableHead>Hotel Chain</TableHead>
            <TableHead>Current Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {hotelChains.map((chain) => {
            const currentStatus = userStatuses.find((us) => us.hotelChainId === chain.id);
            return (
              <TableRow key={chain.id}>
                <TableCell className="font-medium">{chain.name}</TableCell>
                <TableCell>
                  <AppSelect
                    value={currentStatus?.eliteStatusId ? currentStatus.eliteStatusId : "none"}
                    onValueChange={(v) => handleStatusChange(chain.id, v)}
                    options={[
                      { label: "Base Member / No Status", value: "none" },
                      ...(chain.eliteStatuses?.map((status) => ({
                        label: status.name,
                        value: status.id,
                      })) || []),
                    ]}
                    className="w-[200px]"
                    placeholder="Select status..."
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {partnerships.length > 0 && (
        <div className="border-t pt-4 pb-4 space-y-3">
          <h2 className="text-lg font-semibold">Hotel Partnerships</h2>
          <p className="text-sm text-muted-foreground">
            Enable opt-in partnerships to include their rewards in net cost calculations.
          </p>
          {partnerships.map((p) => (
            <div key={p.id} className="flex items-start gap-3">
              <Checkbox
                id={`partnership-${p.id}`}
                checked={p.isEnabled}
                onCheckedChange={(checked) => handlePartnershipToggle(p.id, checked === true)}
                data-testid={`partnership-checkbox-${p.id}`}
              />
              <div className="space-y-1">
                <Label
                  htmlFor={`partnership-${p.id}`}
                  className="text-sm font-medium cursor-pointer"
                >
                  {p.name}
                </Label>
                <p className="text-xs text-muted-foreground">
                  Earn {Number(p.earnRate)} {p.pointType.name} per {p.earnCurrency} 1 of pre-tax
                  spend at participating properties.
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
