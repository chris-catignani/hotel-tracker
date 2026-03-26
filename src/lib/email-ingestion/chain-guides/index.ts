import { hyattGuide } from "./hyatt";
import { marriottGuide } from "./marriott";
import { ihgGuide } from "./ihg";
import type { ChainGuide } from "../types";

const ALL_GUIDES: ChainGuide[] = [hyattGuide, marriottGuide, ihgGuide];

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
