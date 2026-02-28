"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BenefitValuationData } from "@/lib/benefit-valuations";
import { CERT_TYPE_OPTIONS } from "@/lib/cert-types";
import { BENEFIT_TYPE_OPTIONS } from "@/lib/constants";
import { BenefitType, CertType } from "@prisma/client";
import { Loader2, Save } from "lucide-react";

interface HotelChain {
  id: string;
  name: string;
}

export function BenefitValuationsTab() {
  const [valuations, setValuations] = useState<BenefitValuationData[]>([]);
  const [hotelChains, setHotelChains] = useState<HotelChain[]>([]);
  const [selectedChainId, setSelectedChainId] = useState<string>("global");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Local state for form values to allow editing before save
  const [formValues, setFormValues] = useState<Record<string, string>>({});

  useEffect(() => {
    Promise.all([
      fetch("/api/benefit-valuations").then((res) => res.json()),
      fetch("/api/hotel-chains").then((res) => res.json()),
    ])
      .then(([vData, hData]) => {
        setValuations(vData);
        setHotelChains(hData);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Update form values when selected chain or valuations change
  useEffect(() => {
    if (loading) return;

    const newFormValues: Record<string, string> = {};
    const chainId = selectedChainId === "global" ? null : selectedChainId;

    // EQN
    const eqn = valuations.find((v) => v.hotelChainId === chainId && v.isEqn);
    newFormValues["eqn"] = eqn ? String(eqn.value) : "";

    // Certs
    CERT_TYPE_OPTIONS.forEach((opt) => {
      const cert = valuations.find((v) => v.hotelChainId === chainId && v.certType === opt.value);
      newFormValues[`cert_${opt.value}`] = cert ? String(cert.value) : "";
    });

    // Standard benefits
    BENEFIT_TYPE_OPTIONS.forEach((opt) => {
      const benefit = valuations.find(
        (v) => v.hotelChainId === chainId && v.benefitType === opt.value
      );
      newFormValues[`benefit_${opt.value}`] = benefit ? String(benefit.value) : "";
    });

    setFormValues(newFormValues);
  }, [selectedChainId, valuations, loading]);

  const handleSave = async () => {
    setSaving(true);
    const chainId = selectedChainId === "global" ? null : selectedChainId;

    const updates: Array<Partial<BenefitValuationData>> = [];

    // EQN
    if (formValues["eqn"] !== "") {
      updates.push({
        hotelChainId: chainId,
        isEqn: true,
        value: Number(formValues["eqn"]),
        valueType: "dollar",
      });
    }

    // Certs
    CERT_TYPE_OPTIONS.forEach((opt) => {
      if (formValues[`cert_${opt.value}`] !== "") {
        updates.push({
          hotelChainId: chainId,
          isEqn: false,
          certType: opt.value as CertType,
          value: Number(formValues[`cert_${opt.value}`]),
          valueType: "points",
        });
      }
    });

    // Standard Benefits
    BENEFIT_TYPE_OPTIONS.forEach((opt) => {
      if (formValues[`benefit_${opt.value}`] !== "") {
        updates.push({
          hotelChainId: chainId,
          isEqn: false,
          benefitType: opt.value as BenefitType,
          value: Number(formValues[`benefit_${opt.value}`]),
          valueType: "dollar",
        });
      }
    });

    try {
      const res = await fetch("/api/benefit-valuations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ valuations: updates }),
      });

      if (res.ok) {
        const updated = await res.json();
        setValuations(updated);
        alert("Valuations saved. All affected bookings have been re-evaluated.");
      } else {
        throw new Error("Failed to save");
      }
    } catch {
      alert("Error: Failed to save valuations.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const getGlobalValue = (key: string) => {
    if (selectedChainId === "global") return null;
    const globalVal = valuations.find(
      (v) =>
        v.hotelChainId === null &&
        ((key === "eqn" && v.isEqn) ||
          (key.startsWith("cert_") && v.certType === key.replace("cert_", "")) ||
          (key.startsWith("benefit_") && v.benefitType === key.replace("benefit_", "")))
    );
    return globalVal ? globalVal.value : null;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-medium">Benefit Valuations</h3>
          <p className="text-sm text-muted-foreground">
            Configure how you value EQNs, certificates, and perks.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedChainId} onValueChange={setSelectedChainId}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select context" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="global">Global Defaults</SelectItem>
              {hotelChains.map((chain) => (
                <SelectItem key={chain.id} value={chain.id}>
                  {chain.name} Overrides
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleSave} disabled={saving} data-testid="save-valuations">
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save
          </Button>
        </div>
      </div>

      <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
        {/* EQN Valuation */}
        <Card>
          <CardHeader>
            <CardTitle>Elite Qualifying Nights</CardTitle>
            <CardDescription>
              How much is a single bonus EQN worth to you in dollars?
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="eqn">Value per EQN ($)</Label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-muted-foreground">$</span>
                <Input
                  id="eqn"
                  type="number"
                  step="0.01"
                  className="pl-7"
                  value={formValues["eqn"] || ""}
                  onChange={(e) => setFormValues({ ...formValues, eqn: e.target.value })}
                  placeholder={
                    selectedChainId !== "global"
                      ? `Global: $${getGlobalValue("eqn")}`
                      : "e.g. 10.00"
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Certificate Valuations */}
        <Card className="md:row-span-2">
          <CardHeader>
            <CardTitle>Free Night Certificates</CardTitle>
            <CardDescription>Assign a point value to each certificate type.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {CERT_TYPE_OPTIONS.filter(
              (opt) => selectedChainId === "global" || opt.hotelChainId === selectedChainId
            ).map((opt) => (
              <div key={opt.value} className="space-y-2">
                <Label htmlFor={`cert_${opt.value}`}>{opt.label}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id={`cert_${opt.value}`}
                    type="number"
                    value={formValues[`cert_${opt.value}`] || ""}
                    onChange={(e) =>
                      setFormValues({ ...formValues, [`cert_${opt.value}`]: e.target.value })
                    }
                    placeholder={
                      selectedChainId !== "global"
                        ? `Global: ${getGlobalValue(`cert_${opt.value}`)} pts`
                        : "Points value"
                    }
                  />
                  <span className="text-sm text-muted-foreground whitespace-nowrap">points</span>
                </div>
              </div>
            ))}
            {selectedChainId !== "global" &&
              CERT_TYPE_OPTIONS.filter((opt) => opt.hotelChainId === selectedChainId).length ===
                0 && (
                <p className="text-sm text-muted-foreground italic">
                  No specific certificate types defined for this chain.
                </p>
              )}
          </CardContent>
        </Card>

        {/* Standard Benefits */}
        <Card>
          <CardHeader>
            <CardTitle>Standard Perks</CardTitle>
            <CardDescription>
              Default dollar values for manually added booking benefits.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {BENEFIT_TYPE_OPTIONS.map((opt) => (
              <div key={opt.value} className="space-y-2">
                <Label htmlFor={`benefit_${opt.value}`} className="text-xs">
                  {opt.label}
                </Label>
                <div className="relative">
                  <span className="absolute left-2.5 top-2 text-xs text-muted-foreground">$</span>
                  <Input
                    id={`benefit_${opt.value}`}
                    type="number"
                    step="0.01"
                    className="pl-6 h-8 text-sm"
                    value={formValues[`benefit_${opt.value}`] || ""}
                    onChange={(e) =>
                      setFormValues({ ...formValues, [`benefit_${opt.value}`]: e.target.value })
                    }
                    placeholder={
                      selectedChainId !== "global"
                        ? `${getGlobalValue(`benefit_${opt.value}`)}`
                        : "0.00"
                    }
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
