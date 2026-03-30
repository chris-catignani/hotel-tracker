#!/usr/bin/env npx tsx
/**
 * Debug script to look up a GHA Discovery hotel's objectId, chainId, and hotelId,
 * and optionally fetch its room rates.
 *
 * Usage:
 *   npx tsx scripts/debug-gha.ts <hotelName>          # search by name
 *   npx tsx scripts/debug-gha.ts --rates <objectId>   # fetch rates for a known objectId
 *
 * Examples:
 *   npx tsx scripts/debug-gha.ts "kempinski dubai"
 *   npx tsx scripts/debug-gha.ts --rates 23084
 */

export {};

const GHA_BASIC_AUTH = "Basic Z2hhOnVFNlU4d253aExzVTVHa1k=";

async function searchByName(keyword: string) {
  console.log(`Searching GHA hotels for: "${keyword}"...`);
  const res = await fetch(
    `https://cms.ghadiscovery.com/api/autocomplete?keyword=${encodeURIComponent(keyword)}`,
    { headers: { Authorization: GHA_BASIC_AUTH } }
  );
  const data = await res.json();
  const hotels = data.hotels ?? [];
  if (hotels.length === 0) {
    console.log("No hotels found.");
    return;
  }
  console.log(`\nFound ${hotels.length} hotel(s):\n`);
  for (const h of hotels) {
    console.log(`  Name:        ${h.name}`);
    console.log(`  objectId:    ${h.objectId}  ← use this as chainPropertyId`);
    console.log(`  hotelCode:   ${h.hotelCode}`);
    console.log(`  brandCode:   ${h.brandCode}`);
    console.log("");
  }
}

async function fetchRates(objectId: string) {
  console.log(`Looking up hotel metadata for objectId=${objectId}...`);
  const cmsRes = await fetch("https://cms.ghadiscovery.com/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: GHA_BASIC_AUTH,
    },
    body: JSON.stringify({
      query: `{content {hotel(id: ${objectId}) {
        name synxisChainId synxisHotelId reservationsEngineCode
        _location { parentLocation { content { ...on BrandContent { code } } } }
      }}}`,
    }),
  });
  const cmsData = await cmsRes.json();
  const hotel = cmsData?.data?.content?.hotel;
  if (!hotel) {
    console.error("Hotel not found in CMS.");
    return;
  }

  const brandCode = hotel._location?.parentLocation?.content?.code ?? "";
  console.log(`\nHotel:       ${hotel.name}`);
  console.log(`hotelCode:   ${hotel.reservationsEngineCode}`);
  console.log(`brandCode:   ${brandCode}`);
  console.log(`chainId:     ${hotel.synxisChainId}`);
  console.log(`hotelId:     ${hotel.synxisHotelId}`);

  const checkIn =
    process.argv[4] ?? new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const checkOut =
    process.argv[5] ?? new Date(Date.now() + 31 * 86400000).toISOString().slice(0, 10);

  console.log(`\nFetching rates (${checkIn} → ${checkOut})...`);
  const ratesRes = await fetch("https://oscp.ghadiscovery.com/api/v3/booking/hotel/rooms/rates", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: GHA_BASIC_AUTH,
    },
    body: JSON.stringify({
      numberOfRooms: 1,
      numberOfAdults: 2,
      startDate: checkIn,
      endDate: checkOut,
      hotelCode: hotel.reservationsEngineCode,
      brandCode,
      chainId: hotel.synxisChainId,
      hotelId: hotel.synxisHotelId,
      numberOfChildren: 0,
      childAges: [],
      content: "full",
      primaryChannel: "SYDC",
      secondaryChannel: "DSCVRYLYLTY",
      loyaltyProgram: "GHA",
      loyaltyLevel: "RED",
    }),
  });
  const ratesData = await ratesRes.json();
  console.log(JSON.stringify(ratesData, null, 2));
}

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error("Usage: npx tsx scripts/debug-gha.ts <hotelName>");
    console.error("       npx tsx scripts/debug-gha.ts --rates <objectId> [checkIn] [checkOut]");
    process.exit(1);
  }
  if (arg === "--rates") {
    const objectId = process.argv[3];
    if (!objectId) {
      console.error("Usage: npx tsx scripts/debug-gha.ts --rates <objectId>");
      process.exit(1);
    }
    await fetchRates(objectId);
  } else {
    await searchByName(arg);
  }
}

main().catch(console.error);
