"use client";

import { useCallback, useEffect, useState } from "react";
import { AppSelect } from "@/components/ui/app-select";
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

export function UserStatusTab() {
  const [userStatuses, setUserStatuses] = useState<UserStatus[]>([]);
  const [hotelChains, setHotelChains] = useState<HotelChain[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const [statusRes, chainsRes] = await Promise.all([
      fetch("/api/user-statuses"),
      fetch("/api/hotel-chains"),
    ]);
    if (statusRes.ok) setUserStatuses(await statusRes.json());
    if (chainsRes.ok) setHotelChains(await chainsRes.json());
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

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
    </div>
  );
}
