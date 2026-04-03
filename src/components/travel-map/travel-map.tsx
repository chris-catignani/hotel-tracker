import type { TravelStop } from "@/app/api/travel-map/route";

export interface TravelMapProps {
  stops: TravelStop[];
  isPlaying: boolean;
  speed: number;
  onUpdate: (index: number, ticked: number) => void;
  onComplete: () => void;
}

export function TravelMap(_props: TravelMapProps) {
  return null;
}
