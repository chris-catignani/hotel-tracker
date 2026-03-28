import { describe, it, expect } from "vitest";
import { extractDomain, getChainGuide } from "@/lib/email-ingestion/chain-guides/index";

describe("extractDomain", () => {
  it("extracts domain from a plain email address", () => {
    expect(extractDomain("user@reservations.hyatt.com")).toBe("reservations.hyatt.com");
  });

  it("extracts domain from angle-bracket format", () => {
    expect(extractDomain("Hyatt Hotels <noreply@reservations.hyatt.com>")).toBe(
      "reservations.hyatt.com"
    );
  });

  it("normalizes the domain to lowercase", () => {
    expect(extractDomain("User@HYATT.COM")).toBe("hyatt.com");
  });

  it("returns empty string for empty input", () => {
    expect(extractDomain("")).toBe("");
  });
});

describe("getChainGuide", () => {
  it("returns Hyatt guide for a Hyatt sender domain", () => {
    const guide = getChainGuide("noreply@reservations.hyatt.com");
    expect(guide).not.toBeNull();
    expect(guide?.chainName).toBe("Hyatt");
  });

  it("returns Marriott guide for a Marriott sender domain", () => {
    const guide = getChainGuide("noreply@email.marriott.com");
    expect(guide).not.toBeNull();
    expect(guide?.chainName).toBe("Marriott");
  });

  it("returns IHG guide for an IHG sender domain", () => {
    const guide = getChainGuide("noreply@email.ihg.com");
    expect(guide).not.toBeNull();
    expect(guide?.chainName).toBe("IHG");
  });

  it("resolves hyatt.com to Hyatt guide", () => {
    const guide = getChainGuide("noreply@hyatt.com");
    expect(guide?.chainName).toBe("Hyatt");
  });

  it("resolves marriott.com to Marriott guide", () => {
    const guide = getChainGuide("noreply@marriott.com");
    expect(guide?.chainName).toBe("Marriott");
  });

  it("resolves ihg.com to IHG guide", () => {
    const guide = getChainGuide("noreply@ihg.com");
    expect(guide?.chainName).toBe("IHG");
  });

  it("returns null for an unknown sender domain", () => {
    expect(getChainGuide("noreply@unknown.com")).toBeNull();
  });

  it("returns Accor guide for an Accor/ALL sender domain", () => {
    const guide = getChainGuide("all@confirmation.all.com");
    expect(guide).not.toBeNull();
    expect(guide?.chainName).toBe("Accor");
  });

  it("returns GHA guide for a GHA Discovery sender domain", () => {
    const guide = getChainGuide("explore@email.ghadiscovery.com");
    expect(guide).not.toBeNull();
    expect(guide?.chainName).toBe("GHA");
  });

  it("returns Airbnb guide for an Airbnb sender domain", () => {
    const guide = getChainGuide("automated@airbnb.com");
    expect(guide).not.toBeNull();
    expect(guide?.chainName).toBe("Airbnb");
  });

  it("returns Amex guide for an American Express sender domain", () => {
    const guide = getChainGuide("AmericanExpress@welcome.americanexpress.com");
    expect(guide).not.toBeNull();
    expect(guide?.chainName).toBe("Amex Travel");
  });

  it("returns Booking.com guide for a Booking.com sender domain", () => {
    const guide = getChainGuide("noreply@booking.com");
    expect(guide).not.toBeNull();
    expect(guide?.chainName).toBe("Booking.com");
  });

  it("returns Booking.com guide for mailer.booking.com domain", () => {
    const guide = getChainGuide("noreply@mailer.booking.com");
    expect(guide).not.toBeNull();
    expect(guide?.chainName).toBe("Booking.com");
  });

  it("returns Chase guide for a Chase Travel sender domain", () => {
    const guide = getChainGuide("donotreply@chasetravel.com");
    expect(guide).not.toBeNull();
    expect(guide?.chainName).toBe("Chase Travel");
  });
});
