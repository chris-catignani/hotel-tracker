import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { TravelMapHud } from "./travel-map-hud";
import type { TravelStop } from "@/app/api/travel-map/route";

const stop: TravelStop = {
  id: "1",
  propertyName: "Park Hyatt Paris",
  city: "Paris",
  countryCode: "FR",
  checkIn: "2024-06-12",
  numNights: 3,
  lat: 48.8566,
  lng: 2.3522,
};

describe("TravelMapHud", () => {
  it("renders nothing when animation has not started", () => {
    const { container } = render(
      <TravelMapHud
        currentStop={null}
        stopIndex={-1}
        totalStops={5}
        tickedNights={0}
        cumulativeNights={0}
        totalNights={10}
        totalCountries={2}
        isComplete={false}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows city name during animation", () => {
    render(
      <TravelMapHud
        currentStop={stop}
        stopIndex={2}
        totalStops={10}
        tickedNights={2}
        cumulativeNights={8}
        totalNights={30}
        totalCountries={3}
        isComplete={false}
      />
    );
    expect(screen.getByTestId("travel-map-hud")).toBeInTheDocument();
    expect(screen.getByTestId("hud-city-name")).toHaveTextContent("PARIS");
  });

  it("shows ticked night counter during animation", () => {
    render(
      <TravelMapHud
        currentStop={stop}
        stopIndex={2}
        totalStops={10}
        tickedNights={2}
        cumulativeNights={8}
        totalNights={30}
        totalCountries={3}
        isComplete={false}
      />
    );
    expect(screen.getByTestId("hud-night-counter")).toHaveTextContent("2");
  });

  it("shows stay counter and cumulative nights", () => {
    render(
      <TravelMapHud
        currentStop={stop}
        stopIndex={2}
        totalStops={10}
        tickedNights={2}
        cumulativeNights={8}
        totalNights={30}
        totalCountries={3}
        isComplete={false}
      />
    );
    expect(screen.getByTestId("hud-stay-counter")).toHaveTextContent("Stay 3 of 10");
    expect(screen.getByTestId("hud-total-nights")).toHaveTextContent("8 nights total");
  });

  it("shows progress bar width proportional to stop index", () => {
    render(
      <TravelMapHud
        currentStop={stop}
        stopIndex={4}
        totalStops={10}
        tickedNights={3}
        cumulativeNights={15}
        totalNights={30}
        totalCountries={3}
        isComplete={false}
      />
    );
    // (4+1)/10 = 50%
    expect(screen.getByTestId("hud-progress-bar")).toHaveStyle({ width: "50%" });
  });

  it("shows summary stats when complete", () => {
    render(
      <TravelMapHud
        currentStop={stop}
        stopIndex={9}
        totalStops={10}
        tickedNights={3}
        cumulativeNights={30}
        totalNights={30}
        totalCountries={3}
        isComplete={true}
      />
    );
    expect(screen.getByTestId("travel-map-hud")).toBeInTheDocument();
    expect(screen.getByTestId("hud-complete-summary")).toBeInTheDocument();
    expect(screen.getByTestId("hud-complete-summary")).toHaveTextContent("10 stays");
    expect(screen.getByTestId("hud-complete-summary")).toHaveTextContent("30 nights");
    expect(screen.getByTestId("hud-complete-summary")).toHaveTextContent("3 countries");
  });

  it("falls back to propertyName when city is null", () => {
    const noCity: TravelStop = { ...stop, city: null };
    render(
      <TravelMapHud
        currentStop={noCity}
        stopIndex={0}
        totalStops={1}
        tickedNights={0}
        cumulativeNights={0}
        totalNights={3}
        totalCountries={1}
        isComplete={false}
      />
    );
    expect(screen.getByTestId("hud-city-name")).toHaveTextContent("PARK HYATT PARIS");
  });
});
