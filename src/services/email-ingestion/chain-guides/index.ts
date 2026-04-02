import { hyattGuide } from "./hyatt";
import { marriottGuide } from "./marriott";
import { ihgGuide } from "./ihg";
import { accorGuide } from "./accor";
import { ghaGuide } from "./gha";
import { airbnbGuide } from "./airbnb";
import { amexGuide } from "./amex";
import { bookingcomGuide } from "./bookingcom";
import { chaseGuide } from "./chase";
import type { ChainGuide } from "../types";

const ALL_GUIDES: ChainGuide[] = [
  hyattGuide,
  marriottGuide,
  ihgGuide,
  accorGuide,
  ghaGuide,
  airbnbGuide,
  amexGuide,
  bookingcomGuide,
  chaseGuide,
];

const DOMAIN_TO_GUIDE = new Map<string, ChainGuide>(
  ALL_GUIDES.flatMap((guide) => guide.senderDomains.map((domain) => [domain, guide]))
);

/**
 * Extract the domain from an email address string.
 * Handles "Name <email@domain.com>" and "email@domain.com" formats.
 */
export function extractDomain(emailAddress: string): string {
  const match = emailAddress.match(/<([^>]+)>/) ?? emailAddress.match(/(\S+)/);
  const address = match ? match[1] : emailAddress;
  return address.split("@")[1]?.toLowerCase() ?? "";
}

/**
 * Returns the ChainGuide for the given sender email domain, or null if unknown.
 */
export function getChainGuide(senderEmail: string): ChainGuide | null {
  const domain = extractDomain(senderEmail);
  return DOMAIN_TO_GUIDE.get(domain) ?? null;
}

/**
 * Detects the ChainGuide by scanning the email body for known sender domains.
 * Used for forwarded emails where the original sender domain is not available.
 * Returns the first matching guide, or null if no known chain is detected.
 */
export function detectChainGuideFromContent(emailContent: string): ChainGuide | null {
  const lowerContent = emailContent.toLowerCase();
  for (const guide of ALL_GUIDES) {
    for (const domain of guide.senderDomains) {
      if (lowerContent.includes(domain.toLowerCase())) {
        return guide;
      }
    }
  }
  return null;
}
