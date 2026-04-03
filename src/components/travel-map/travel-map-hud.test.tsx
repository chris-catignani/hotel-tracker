import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { TravelMapHud } from "./travel-map-hud";
import type { TravelStop } from "@/app/api/travel-map/route";
import type { AnimationStop } from "./travel-map-utils";

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
    expect(screen.getByTestId("hud-property-name")).toHaveTextContent("PARK HYATT PARIS");
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
    expect(screen.getByTestId("hud-property-name")).toHaveTextContent("PARK HYATT PARIS");
  });

  it("shows city name (uppercased) for isHome stops instead of property name", () => {
    const homeStop: AnimationStop = {
      id: "home-0",
      propertyName: "Springfield",
      city: "Springfield",
      countryCode: "US",
      checkIn: "2024-07-01",
      numNights: 0,
      lat: 39.8,
      lng: -89.6,
      isHome: true,
    };
    render(
      <TravelMapHud
        currentStop={homeStop}
        stopIndex={1}
        totalStops={3}
        tickedNights={0}
        cumulativeNights={3}
        totalNights={10}
        totalCountries={2}
        isComplete={false}
      />
    );
    expect(screen.getByTestId("hud-property-name")).toHaveTextContent("SPRINGFIELD");
  });

  it("shows HOME when isHome stop has no city", () => {
    const homeStop: AnimationStop = {
      id: "home-0",
      propertyName: "Home",
      city: null,
      countryCode: "US",
      checkIn: "2024-07-01",
      numNights: 0,
      lat: 39.8,
      lng: -89.6,
      isHome: true,
    };
    render(
      <TravelMapHud
        currentStop={homeStop}
        stopIndex={1}
        totalStops={3}
        tickedNights={0}
        cumulativeNights={3}
        totalNights={10}
        totalCountries={2}
        isComplete={false}
      />
    );
    expect(screen.getByTestId("hud-property-name")).toHaveTextContent("HOME");
  });

  it("shows 0 in night counter for isHome stops", () => {
    const homeStop: AnimationStop = {
      id: "home-0",
      propertyName: "Springfield",
      city: "Springfield",
      countryCode: "US",
      checkIn: "2024-07-01",
      numNights: 0,
      lat: 39.8,
      lng: -89.6,
      isHome: true,
    };
    render(
      <TravelMapHud
        currentStop={homeStop}
        stopIndex={1}
        totalStops={3}
        tickedNights={0}
        cumulativeNights={3}
        totalNights={10}
        totalCountries={2}
        isComplete={false}
      />
    );
    expect(screen.getByTestId("hud-night-counter")).toHaveTextContent("0");
  });

  it("constrains property name to 2 lines and keeps night counter in DOM", () => {
    const longStop: TravelStop = {
      ...stop,
      propertyName:
        "The Ritz-Carlton Residences at The Ritz-Carlton Hotel and Spa of Chicago Downtown",
    };
    render(
      <TravelMapHud
        currentStop={longStop}
        stopIndex={0}
        totalStops={5}
        tickedNights={1}
        cumulativeNights={1}
        totalNights={20}
        totalCountries={2}
        isComplete={false}
      />
    );
    const nameEl = screen.getByTestId("hud-property-name");
    expect(nameEl).toBeInTheDocument();
    expect(nameEl.className).toContain("line-clamp-2");
    expect(screen.getByTestId("hud-night-counter")).toBeInTheDocument();
  });
});
