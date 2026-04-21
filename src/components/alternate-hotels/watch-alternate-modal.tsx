"use client";

import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api-fetch";
import { toast } from "sonner";

interface Props {
  bookingId: string;
  property: { id: string; name: string };
  onClose: () => void;
  onSaved: () => void;
}

export function WatchAlternateModal({ bookingId, property, onClose, onSaved }: Props) {
  const [cashThreshold, setCashThreshold] = useState("");
  const [awardThreshold, setAwardThreshold] = useState("");
  const [dateFlex, setDateFlex] = useState("0");
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    setSaving(true);
    const result = await apiFetch<{ id: string }>("/api/price-watches", {
      method: "POST",
      body: {
        propertyId: property.id,
        isEnabled: true,
        bookingId,
        cashThreshold: cashThreshold ? Number(cashThreshold) : null,
        awardThreshold: awardThreshold ? Number(awardThreshold) : null,
        dateFlexibilityDays: Number(dateFlex) || 0,
      },
    });
    setSaving(false);
    if (!result.ok) {
      toast.error("Failed to watch this alternate. Please try again.");
      return;
    }
    toast.success(`Watching ${property.name}`);
    onSaved();
  }, [cashThreshold, awardThreshold, dateFlex, bookingId, property.id, property.name, onSaved]);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent data-testid="watch-alternate-modal">
        <DialogHeader>
          <DialogTitle>Watch {property.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Cash alert below (USD)</Label>
            <Input
              type="number"
              value={cashThreshold}
              onChange={(e) => setCashThreshold(e.target.value)}
              placeholder="e.g. 200"
              data-testid="alt-cash-threshold"
            />
          </div>
          <div>
            <Label className="text-xs">Award alert below (pts)</Label>
            <Input
              type="number"
              value={awardThreshold}
              onChange={(e) => setAwardThreshold(e.target.value)}
              placeholder="e.g. 30000"
              data-testid="alt-award-threshold"
            />
          </div>
          <div>
            <Label className="text-xs">Date flexibility (days)</Label>
            <Input
              type="number"
              value={dateFlex}
              onChange={(e) => setDateFlex(e.target.value)}
              placeholder="0"
              data-testid="alt-date-flex"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} data-testid="alt-save-button">
            {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
