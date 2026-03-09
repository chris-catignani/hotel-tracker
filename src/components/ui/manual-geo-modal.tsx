"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { COUNTRIES } from "@/lib/countries";
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface ManualGeoModalProps {
  open: boolean;
  onClose: () => void;
  initialPropertyName: string;
  onConfirm: (propertyName: string, countryCode: string, city: string) => void;
}

export function ManualGeoModal({
  open,
  onClose,
  initialPropertyName,
  onConfirm,
}: ManualGeoModalProps) {
  const [propertyName, setPropertyName] = useState(initialPropertyName);
  const [countryCode, setCountryCode] = useState("");
  const [city, setCity] = useState("");
  const [countryOpen, setCountryOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");
  const [showErrors, setShowErrors] = useState(false);

  // Reset local modal fields when it opens; setState-in-effect is valid here since we're
  // synchronizing from a controlled open/initialPropertyName prop, not from render.
  useEffect(() => {
    if (!open) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setPropertyName(initialPropertyName);
    setCountryCode("");
    setCity("");
    setCountrySearch("");
    setShowErrors(false);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open, initialPropertyName]);

  const filteredCountries = COUNTRIES.filter(
    (c) =>
      c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
      c.code.toLowerCase().includes(countrySearch.toLowerCase())
  );

  const selectedCountry = COUNTRIES.find((c) => c.code === countryCode);

  const handleSubmit = () => {
    setShowErrors(true);
    if (!propertyName.trim() || !countryCode) return;
    onConfirm(propertyName.trim(), countryCode, city.trim());
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Enter Property Details</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="manual-property-name">Property Name *</Label>
            <Input
              id="manual-property-name"
              value={propertyName}
              onChange={(e) => setPropertyName(e.target.value)}
              placeholder="e.g. Marriott Downtown Chicago"
              error={showErrors && !propertyName.trim() ? "Property name is required" : ""}
            />
          </div>

          <div className="space-y-2">
            <Label>Country *</Label>
            <Popover open={countryOpen} onOpenChange={setCountryOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={countryOpen}
                  className={cn(
                    "w-full justify-between font-normal",
                    showErrors && !countryCode && "border-destructive"
                  )}
                  data-testid="manual-geo-country-select"
                >
                  {selectedCountry
                    ? `${selectedCountry.code} — ${selectedCountry.name}`
                    : "Select country..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-2" align="start">
                <Input
                  placeholder="Search country..."
                  value={countrySearch}
                  onChange={(e) => setCountrySearch(e.target.value)}
                  className="mb-2 h-8"
                  autoFocus
                />
                <div className="max-h-52 overflow-y-auto" role="listbox">
                  {filteredCountries.length === 0 ? (
                    <p className="px-2 py-1 text-sm text-muted-foreground">No results.</p>
                  ) : (
                    filteredCountries.map((c) => (
                      <button
                        key={c.code}
                        role="option"
                        aria-selected={countryCode === c.code}
                        className={cn(
                          "flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground cursor-pointer text-left",
                          countryCode === c.code && "bg-accent text-accent-foreground"
                        )}
                        onClick={() => {
                          setCountryCode(c.code);
                          setCountrySearch("");
                          setCountryOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "h-4 w-4 shrink-0",
                            countryCode === c.code ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <span className="font-mono text-xs w-8 shrink-0">{c.code}</span>
                        <span className="truncate">{c.name}</span>
                      </button>
                    ))
                  )}
                </div>
              </PopoverContent>
            </Popover>
            {showErrors && !countryCode && (
              <p className="text-sm text-destructive">Country is required</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="manual-city">City (optional)</Label>
            <Input
              id="manual-city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="e.g. Chicago"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} data-testid="manual-geo-confirm">
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
