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
          _info: { id: 286138 },
          location: {
            address: "Via Annunziatella, 46",
            latitude: "40.624123",
            longitude: "14.605552",
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
      unknownCountryName: null,
      zipCode: "84011",
      chainCategories: ["Ultratravel Collection", "Green Collection"],
    });
  });

  it("returns null for pages without a property id", () => {
    const payload = structuredClone(ok);
    delete (payload.props.pageProps.page._info as Record<string, unknown>).id;
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

  it("resolves country name when location hierarchy has an intermediate level", () => {
    const payload = structuredClone(ok);
    (payload.props.pageProps.page.city as Record<string, unknown>)._location = {
      parentLocation: {
        content: {
          _info: { id: 9078 },
          _location: { parentLocation: { content: { _info: { id: 5272 }, name: "Malaysia" } } },
        },
      },
    };
    const r = parseGhaPropertyNextData(wrap(payload), "/anantara/x");
    expect(r?.countryCode).toBe("MY");
  });

  it("handles unknown country by emitting null countryCode but still returning a record", () => {
    const payload = structuredClone(ok);
    payload.props.pageProps.page.city._location.parentLocation.content.name = "Atlantis";
    const r = parseGhaPropertyNextData(wrap(payload), "/anantara/x");
    expect(r?.countryCode).toBeNull();
    expect(r?.unknownCountryName).toBe("Atlantis");
    expect(r?.name).toBe("Anantara Convento di Amalfi Grand Hotel");
  });
});
