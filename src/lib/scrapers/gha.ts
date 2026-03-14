/**
 * GHA Discovery price fetcher.
 *
 * Strategy: Two plain HTTP calls, no browser required.
 *
 * Step 1 — CMS GraphQL lookup (cms.ghadiscovery.com/graphql):
 *   Given the hotel's CMS objectId (stored as chainPropertyId), fetch the
 *   Synxis chainId, hotelId, brandCode, and reservationsEngineCode needed for
 *   the rates call. Results are cached in memory for the lifetime of the fetcher.
 *
 * Step 2 — OSCP rates API (oscp.ghadiscovery.com/api/v3/booking/hotel/rooms/rates):
 *   Plain POST with Basic auth — no member login required. Returns all room
 *   types with their cash rates.
 *
 * chainPropertyId format: numeric CMS objectId (e.g. "23084" for Kempinski Dubai).
 * Use the debug script (scripts/debug-gha.ts) to look up a hotel's objectId by name.
 *
 * GHA Discovery Dollars (D$) are a cashback program, not a points redemption currency.
 * There are no award/points bookings — awardPrice is always null.
 *
 * Refundability heuristic: rates with "Flexible" in the name or the GHAPREF
 * member rate code are treated as refundable. All other rates (e.g. early-booker)
 * are treated as non-refundable.
 */

import { HOTEL_ID } from "@/lib/constants";
import type {
  FetchableProperty,
  FetchParams,
  PriceFetcher,
  PriceFetchResult,
  RoomRate,
} from "@/lib/price-fetcher";

const CMS_URL = "https://cms.ghadiscovery.com/graphql";
const RATES_URL = "https://oscp.ghadiscovery.com/api/v3/booking/hotel/rooms/rates";

// Hardcoded public Basic auth embedded in GHA's web app JS.
const GHA_BASIC_AUTH = "Basic Z2hhOnVFNlU4d253aExzVTVHa1k=";

// CMS GraphQL hotel lookup response types
interface GhaCmsHotel {
  synxisChainId: string;
  synxisHotelId: string;
  reservationsEngineCode: string;
  _location?: {
    parentLocation?: {
      content?: {
        code?: string;
      };
    };
  };
}

interface GhaCmsResponse {
  data?: {
    content?: {
      hotel?: GhaCmsHotel;
    };
  };
}

// OSCP rates API response types
interface GhaRate {
  price: number;
  currency: string;
  rateCode: string;
  rateName: string;
  memberRate: boolean;
}

interface GhaRoom {
  roomName: string;
  roomCode: string;
  rates: GhaRate[];
}

interface GhaRatesResponse {
  rooms?: GhaRoom[];
}

// Resolved hotel metadata from the CMS, cached after first lookup.
interface GhaHotelMeta {
  hotelCode: string; // reservationsEngineCode
  brandCode: string;
  chainId: string;
  hotelId: string;
}

export class GhaFetcher implements PriceFetcher {
  private readonly metaCache = new Map<string, GhaHotelMeta>();

  canFetch(property: FetchableProperty): boolean {
    return property.hotelChainId === HOTEL_ID.GHA_DISCOVERY && !!property.chainPropertyId;
  }

  async fetchPrice(params: FetchParams): Promise<PriceFetchResult | null> {
    const objectId = params.property.chainPropertyId;
    if (!objectId) return null;

    console.log(`[GhaFetcher] Fetching rates for objectId=${objectId}...`);

    const meta = await this.resolveHotelMeta(objectId);
    if (!meta) {
      console.error(`[GhaFetcher] Could not resolve hotel metadata for objectId=${objectId}`);
      return null;
    }

    const res = await fetch(RATES_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: GHA_BASIC_AUTH,
      },
      body: JSON.stringify({
        numberOfRooms: 1,
        numberOfAdults: params.adults ?? 2,
        startDate: params.checkIn,
        endDate: params.checkOut,
        hotelCode: meta.hotelCode,
        brandCode: meta.brandCode,
        chainId: meta.chainId,
        hotelId: meta.hotelId,
        numberOfChildren: 0,
        childAges: [],
        content: "full",
        primaryChannel: "SYDC",
        secondaryChannel: "DSCVRYLYLTY",
        loyaltyProgram: "GHA",
        loyaltyLevel: "RED",
      }),
    });

    if (!res.ok) {
      console.error(`[GhaFetcher] Rates API error for ${meta.hotelCode}: HTTP ${res.status}`);
      return null;
    }

    const numNights = Math.round(
      (new Date(params.checkOut).getTime() - new Date(params.checkIn).getTime()) /
        (1000 * 60 * 60 * 24)
    );

    const data = (await res.json()) as GhaRatesResponse;
    const rates = parseGhaRates(data, numNights);
    console.log(
      `[GhaFetcher] Parsed ${rates.length} rates for ${meta.hotelCode} (${numNights} night(s))`
    );

    return rates.length > 0 ? { rates, source: "gha_api" } : null;
  }

  private async resolveHotelMeta(objectId: string): Promise<GhaHotelMeta | null> {
    if (this.metaCache.has(objectId)) {
      return this.metaCache.get(objectId)!;
    }

    const res = await fetch(CMS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: GHA_BASIC_AUTH,
      },
      body: JSON.stringify({
        query: `{content {hotel(id: ${objectId}) {
          synxisChainId synxisHotelId reservationsEngineCode
          _location { parentLocation { content { ...on BrandContent { code } } } }
        }}}`,
      }),
    });

    if (!res.ok) {
      console.error(`[GhaFetcher] CMS lookup failed for objectId=${objectId}: HTTP ${res.status}`);
      return null;
    }

    const body = (await res.json()) as GhaCmsResponse;
    const hotel = body.data?.content?.hotel;
    if (!hotel?.synxisChainId || !hotel?.synxisHotelId || !hotel?.reservationsEngineCode) {
      console.error(`[GhaFetcher] Incomplete CMS data for objectId=${objectId}:`, hotel);
      return null;
    }

    const brandCode = hotel._location?.parentLocation?.content?.code ?? "";
    const meta: GhaHotelMeta = {
      hotelCode: hotel.reservationsEngineCode,
      brandCode,
      chainId: hotel.synxisChainId,
      hotelId: hotel.synxisHotelId,
    };

    this.metaCache.set(objectId, meta);
    return meta;
  }
}

/**
 * Exported for unit testing.
 * Parses room rates from a GHA OSCP rates API response.
 */
export function parseGhaRates(data: GhaRatesResponse, numNights = 1): RoomRate[] {
  const rooms = data.rooms ?? [];

  // GHA sometimes returns multiple roomCodes with the same roomName (e.g. SSK and SST both
  // named "Studio Suite"). Deduplicate by roomName|rateCode, keeping the cheaper price.
  const seen = new Map<string, RoomRate>();

  for (const room of rooms) {
    if (!room.roomCode || !room.roomName) continue;

    for (const rate of room.rates ?? []) {
      if (!rate.rateCode || !rate.currency) continue;
      if (!isFinite(rate.price) || rate.price <= 0) continue;

      const key = `${room.roomName}|${rate.rateCode}`;
      const cashPrice = rate.price / Math.max(numNights, 1);
      const existing = seen.get(key);
      if (existing && Number(existing.cashPrice) <= cashPrice) continue;

      seen.set(key, {
        roomId: room.roomCode,
        roomName: room.roomName,
        ratePlanCode: rate.rateCode,
        ratePlanName: rate.rateName,
        cashPrice,
        cashCurrency: rate.currency,
        awardPrice: null, // GHA uses D$ cashback, not point redemptions
        isRefundable: isRefundableRate(rate),
        isCorporate: false,
      });
    }
  }

  return Array.from(seen.values());
}

/**
 * Determines refundability by rate name heuristic.
 *
 * The GHA OSCP rates API does not return cancellation policy data, so we cannot
 * reliably determine refundability. Refund terms vary by property — e.g. "Best
 * Available Rate" is non-refundable at some hotels but refundable at others.
 *
 * Conservative default: non-refundable. We only mark a rate as refundable when
 * the name explicitly contains "flexible", which is a high-confidence signal.
 * This avoids misleading users into thinking they can cancel for free.
 */
function isRefundableRate(rate: GhaRate): boolean {
  return rate.rateName.toLowerCase().includes("flexible");
}

export function createGhaFetcher(): GhaFetcher {
  return new GhaFetcher();
}
