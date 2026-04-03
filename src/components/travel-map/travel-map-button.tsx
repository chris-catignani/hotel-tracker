"use client";

import { Button } from "@/components/ui/button";
import { Map } from "lucide-react";

interface TravelMapButtonProps {
  onClick: () => void;
}

export function TravelMapButton({ onClick }: TravelMapButtonProps) {
  return (
    <Button variant="outline" size="sm" onClick={onClick} data-testid="travel-map-button">
      <Map className="h-4 w-4 mr-2" />
      View Travel Map
    </Button>
  );
}
