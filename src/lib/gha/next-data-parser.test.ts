import { describe, it, expect } from "vitest";
import { parseGhaPropertyNextData } from "./next-data-parser";

function wrap(payload: unknown): string {
  return `<html><head></head><body><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(payload)}</script></body></html>`;
}

describe("parseGhaPropertyNextData", () => {
  const ok = {
    props: {
      pageProps: {
        page: {
          name: "Anantara Convento di Amalfi Grand Hotel",
          zipCode: "84011",
          _info: { id: 286138, type: "hotel" },
          location: {
            address: "Via Annunziatella, 46",
            latitude: 40.624123,
            longitude: 14.605552,
          },
          city: {
            name: "Amalfi",
            timezone: "Europe/Rome",
            _location: { parentLocation: { content: { name: "Italy" } } },
          },
          categories: [{ name: "Ultratravel Collection" }, { name: "Green Collection" }],
        },
      },
    },
  };

  it("extracts all canonical fields", () => {
    const result = parseGhaPropertyNextData(
      wrap(ok),
      "/anantara/anantara-convento-di-amalfi-grand-hotel"
    );
    expect(result).toEqual({
      chainPropertyId: "286138",
      chainUrlPath: "/anantara/anantara-convento-di-amalfi-grand-hotel",
      name: "Anantara Convento di Amalfi Grand Hotel",
      subBrandSlug: "anantara",
      address: "Via Annunziatella, 46",
      latitude: 40.624123,
      longitude: 14.605552,
      city: "Amalfi",
      countryCode: "IT",
      zipCode: "84011",
      chainCategories: ["Ultratravel Collection", "Green Collection"],
    });
  });

  it("returns null for non-hotel pages", () => {
    const payload = structuredClone(ok);
    payload.props.pageProps.page._info.type = "restaurant";
    expect(parseGhaPropertyNextData(wrap(payload), "/x/y")).toBeNull();
  });

  it("returns null when the __NEXT_DATA__ script is missing", () => {
    expect(parseGhaPropertyNextData("<html><body>empty</body></html>", "/x/y")).toBeNull();
  });

  it("returns null on malformed JSON", () => {
    expect(
      parseGhaPropertyNextData(
        `<script id="__NEXT_DATA__" type="application/json">not json</script>`,
        "/x/y"
      )
    ).toBeNull();
  });

  it("handles unknown country by emitting null countryCode but still returning a record", () => {
    const payload = structuredClone(ok);
    payload.props.pageProps.page.city._location.parentLocation.content.name = "Atlantis";
    const r = parseGhaPropertyNextData(wrap(payload), "/anantara/x");
    expect(r?.countryCode).toBeNull();
    expect(r?.name).toBe("Anantara Convento di Amalfi Grand Hotel");
  });
});
