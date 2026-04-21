import { describe, it, expect } from "vitest";
import { dedupCrossListings, filterPropertyUrls } from "./sitemap-harvest";

describe("filterPropertyUrls", () => {
  it("keeps only 2-segment URLs", () => {
    expect(
      filterPropertyUrls([
        "/anantara/anantara-convento-di-amalfi-grand-hotel",
        "/anantara/anantara-convento/sub",
        "/anantara",
        "/kempinski/towers-rotana",
      ])
    ).toEqual(["/anantara/anantara-convento-di-amalfi-grand-hotel", "/kempinski/towers-rotana"]);
  });

  it("skips non-property first segments", () => {
    expect(
      filterPropertyUrls([
        "/search/italy",
        "/member/profile",
        "/our-partners/amex",
        "/destination-guides/rome",
        "/support/faq",
        "/anantara/convento",
      ])
    ).toEqual(["/anantara/convento"]);
  });
});

describe("dedupCrossListings", () => {
  it("drops ultratravel-collection when a primary-brand sibling exists", () => {
    const input = [
      "/anantara/anantara-convento",
      "/ultratravel-collection/anantara-convento",
      "/kempinski/towers-rotana",
    ];
    expect(dedupCrossListings(input).sort()).toEqual(
      ["/anantara/anantara-convento", "/kempinski/towers-rotana"].sort()
    );
  });

  it("keeps ultratravel-collection when no sibling exists", () => {
    const input = ["/ultratravel-collection/orphan"];
    expect(dedupCrossListings(input)).toEqual(["/ultratravel-collection/orphan"]);
  });

  it("is idempotent", () => {
    const once = dedupCrossListings(["/anantara/x", "/ultratravel-collection/x", "/kempinski/y"]);
    const twice = dedupCrossListings(once);
    expect(once.sort()).toEqual(twice.sort());
  });
});
