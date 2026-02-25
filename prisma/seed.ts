import { PrismaClient, PointCategory } from "@prisma/client";
import { HOTEL_ID, SUB_BRAND_ID } from "../src/lib/constants";

const prisma = new PrismaClient();

// Pre-generated CUIDs for seed data stability
const CUIDS = [
  "cyh0r61a810u6qrgfj515tkid",
  "ctv910qcpclvq0b9thpcw12x6",
  "cd0y4mrv3iwc2r2gwgwy722zk",
  "cmcri5r30guyq8l8f2pvaqwr7",
  "c8wn8dzybdbymevuucmup1j96",
  "coa03zp46q2v01c4l4knm1rcg",
  "cc0pgnx83hbjbbwxi99qocq52",
  "c8974es8z9vnwdgt934zrlare",
  "cwhd30omk2xajtvfa2iqmmgab",
  "c4rk0idsjpnfriatk1qulswgx",
  "cbuf26mcgjs61kr9bybazq95j",
  "c0kuqb3diocim6kgaxo0b3w0r",
  "cwevwixo5ubql3q9piykd1pn6",
  "csow7yt1q7jox7yb2jv5lcf0c",
  "cimm9s4ufnirodqwyo7igholu",
  "cvvtlfwohhorxonrsigsteaqo",
  "cs24897y4ya1d42iijx1xpts9",
  "c1mqbqf4t5wjq9u50cem5ibfn",
  "c5pa4vb7xbvanpsguu8k7aa9w",
  "c9n5v68hye1fqz3gocmknsejh",
  "cjag7rm9jpr6e1lhc3565qzsh",
  "ca45t5grsndk16qc28nfcgsvf",
  "cpz1aw98lxig38ngomlz29ih1",
  "c75t8rf1z0tra3qwlrwvb33is",
  "c65u3vjz6af06zr23j8gqgvd5",
  "cixyq47beb7j78g1b4nm51upd",
  "c05k6t16a6acwsfldqr2hicmh",
  "cyumuwus7w5sg4bp601tv2y0n",
  "chjzttecd2xw3solt4cob866v",
  "coohshvqavhh4msrlh2h4dzow",
  "carnt7c6ek3qmi309ye9c1rpy",
  "cb5om2oq8kgabf6ialfxxmpbu",
  "cn5cf72b28kfs4n8j42pu0fyu",
  "cld7wuovwgbn34xa8ctujwf17",
  "cr38wvw1a7564af8r0ym18ne7",
  "cgq02387x6qm7lqgpx2gcbgba",
  "cchz7k69n22ya4ankao2jkueu",
  "c7kbcd5uflgcy29flq52l776p",
  "ciq20kk1zf8cisz4avrs981kg",
  "cu7i08xkft5d7tdwc351p3x65",
  "c7ywiknrz8r9p7vqfig9ygkui",
  "cyxsim8z5yb3lk5klblxypz5m",
  "c1grgajz0omerzvabsw2hrmns",
  "c6dn7z3vw71i4qcxe8psh0u1v",
  "cbka4vy07rkbmptkdhn7n7puo",
  "cpqmuzwc4zhnlboaqb0xr0rv5",
  "cl9pgzywd5z68f4y0og7yy4ph",
  "c8t1mkosjkwgbz6ve8pqp5rfq",
  "caibpue2xwlt0l0ipy6nx6jxx",
  "crx7gol08nzkvbxpdhoki98sx",
  "cm039p3pbunjs0dh4lkut8kgc",
  "czo3rbqbcqsvivkluyeqiasuj",
  "cmteoxgeofops4asg9sqcdimc",
  "c3mtxkqxp27kasrbify041nom",
  "ctfz31tpi85hhjf4fxqyz53gn",
  "cwndt5ecwmkgbjzlixup2zdqk",
  "cpuftzewrt1m46fmbvk0ozgcu",
  "c1m21uw7uivhxy7exln96thh1",
  "c2jkgoikmtzqz6llwip3jz9ml",
  "cvba2ofhue8s1x95qfd9pck1y",
  "cpk62lozxift0ipvhe5g4qxrb",
  "c2o6bua86rcva28rmb69ktdko",
  "c44a06dpxx0ks7op4uktuizt6",
  "cum75s63r9zwls68i213kboto",
  "capnkfecq7z6no0ybneit2n33",
  "chv9no61by0b24wpdku08epoh",
  "cx13bz5kj2et7iw3z8sunsub5",
  "cbzn5hm6pujykz0xttutpv3u4",
  "ccxgj3amwirn5mphakigw2eoh",
  "cnnpoo9hq81f3p7e8s3et61m5",
  "ce6yu7gnso4mbqhgqzls60vpw",
  "c92g91fw4e9la1kzw5ynbke6m",
  "cm0yus1jdaeq00f2ngy2v82z4",
  "c2g7kpsufhceec1vodnszz8ue",
  "c6pz62t0ygfq5y2zcmlyeaz6i",
  "c1104z5sjixcwnm83bkewh00z",
  "cfxr96wqrpitedqanpsubdy20",
  "cvouzcq2dmauwzo7jljqgmahp",
  "cx7rs2yro013j4m8q9v5w4yxy",
  "ca8on5y8kubkfhpeboxnosiej",
  "ck6savfgnxpweirhxf7fn52xz",
  "cd5pkxmbioagaqu6w3odc6efy",
  "cviejhp19dz2qdsrshxkqmy2p",
  "c64rcsz4tziv0trt6gvjnt890",
  "ch5b18phnr28tj7xf5jge8lk4",
  "cxqe4tufjh9g1v5o6jptxjo4q",
  "c60njlp6iwqt8mfq0ndrjdnvm",
  "cl35ai6ez7qv6euqofrdceavk",
  "csrzloejik14bc1ki3b5zlcik",
  "c3h3lmfkkc5w4tpijsluodzhm",
  "cnx5j4setafy65foryecfm3ci",
  "cgzph9neht1jwj34jx6uk29js",
  "c0ptrm28lwyfd2azmamhb7zgy",
  "cicfr9qx93tedv7nho0heixl2",
  "cr9kgaal9ip33k14a0t1dfook",
  "cy1hi3g4pt47oyyfrtseog29l",
  "c5r1ii1xayr4sk9ggsle12mu6",
  "cp3nckft5mutcuqdd92ckmmjt",
  "c3rpwipj7duci55m5z94jlkh7",
  "cb7pfurs5p53tr0twhunomh6n",
];

let cuidIdx = 0;
function nextCuid() {
  return CUIDS[cuidIdx++];
}

interface EliteStatusData {
  name: string;
  bonusPercentage?: number;
  fixedRate?: number;
  isFixed?: boolean;
  eliteTierLevel: number;
}

interface SubBrandData {
  name: string;
  basePointRate?: number;
}

// Map sub brand names to their constant IDs
const SUB_BRAND_MAP: Record<string, string> = {
  "Autograph Collection": SUB_BRAND_ID.MARRIOTT.AUTOGRAPH_COLLECTION,
  citizenM: SUB_BRAND_ID.MARRIOTT.CITIZENM,
  Moxy: SUB_BRAND_ID.MARRIOTT.MOXY,
  "Tribute Portfolio": SUB_BRAND_ID.MARRIOTT.TRIBUTE_PORTFOLIO,
  "Park Hyatt": SUB_BRAND_ID.HYATT.PARK_HYATT,
  "Hyatt Centric": SUB_BRAND_ID.HYATT.HYATT_CENTRIC,
  "Hyatt Place": SUB_BRAND_ID.HYATT.HYATT_PLACE,
  "Holiday Inn Express": SUB_BRAND_ID.IHG.HOLIDAY_INN_EXPRESS,
  "Hotel Indigo": SUB_BRAND_ID.IHG.HOTEL_INDIGO,
  Sunway: SUB_BRAND_ID.GHA_DISCOVERY.SUNWAY,
  PARKROYAL: SUB_BRAND_ID.GHA_DISCOVERY.PARKROYAL,
  "PARKROYAL COLLECTION": SUB_BRAND_ID.GHA_DISCOVERY.PARKROYAL_COLLECTION,
  "ibis Styles": SUB_BRAND_ID.ACCOR.IBIS_STYLES,
};

async function upsertEliteStatuses(hotelChainId: string, statuses: EliteStatusData[]) {
  for (const status of statuses) {
    await prisma.hotelChainEliteStatus.upsert({
      where: {
        hotelChainId_name: {
          hotelChainId,
          name: status.name,
        },
      },
      update: status,
      create: {
        ...status,
        hotelChainId,
      },
    });
  }
}

/**
 * Utility function used to generate the shortened names above.
 * Kept here for future use when adding new brands to the seed data.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function shortenName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^_|_$/g, "");
}

async function upsertSubBrands(hotelChainId: string, subBrands: SubBrandData[]) {
  for (let i = 0; i < subBrands.length; i++) {
    const sb = subBrands[i];

    // Use stable ID from constants if available, otherwise next random seed ID
    const fixedId = SUB_BRAND_MAP[sb.name] || nextCuid();

    await prisma.hotelChainSubBrand.upsert({
      where: {
        hotelChainId_name: {
          hotelChainId,
          name: sb.name,
        },
      },
      update: {
        name: sb.name,
        hotelChainId,
        basePointRate: sb.basePointRate,
      },
      create: {
        id: fixedId,
        name: sb.name,
        hotelChainId,
        basePointRate: sb.basePointRate,
      },
    });
  }
}

async function upsertUserStatus(hotelChainId: string, statusName: string) {
  const eliteStatus = await prisma.hotelChainEliteStatus.findFirst({
    where: { hotelChainId, name: statusName },
  });
  if (eliteStatus) {
    await prisma.userStatus.upsert({
      where: { hotelChainId },
      update: { eliteStatusId: eliteStatus.id },
      create: { hotelChainId, eliteStatusId: eliteStatus.id },
    });
  }
}

async function main() {
  // PointTypes
  const pointTypeData = [
    { name: "Hilton Honors Points", category: "hotel", centsPerPoint: 0.0045 },
    { name: "Marriott Bonvoy Points", category: "hotel", centsPerPoint: 0.007 },
    { name: "World of Hyatt Points", category: "hotel", centsPerPoint: 0.02 },
    { name: "IHG One Rewards", category: "hotel", centsPerPoint: 0.006 },
    { name: "Discovery Dollars", category: "hotel", centsPerPoint: 0.01 },
    { name: "ALL - Accor Live Limitless", category: "hotel", centsPerPoint: 0.022 },
    { name: "Membership Rewards", category: "transferable", centsPerPoint: 0.02 },
    { name: "Ultimate Rewards", category: "transferable", centsPerPoint: 0.02 },
    { name: "Capital One Miles", category: "transferable", centsPerPoint: 0.0175 },
    { name: "Avios", category: "airline", centsPerPoint: 0.012 },
    { name: "Bilt", category: "transferable", centsPerPoint: 0.02 },
    { name: "Wells Fargo Rewards", category: "transferable", centsPerPoint: 0.015 },
  ];

  const ptIds: Record<string, string> = {};
  for (const pt of pointTypeData) {
    const id = nextCuid();
    await prisma.pointType.upsert({
      where: { id },
      update: {
        name: pt.name,
        category: pt.category as PointCategory,
        centsPerPoint: pt.centsPerPoint,
      },
      create: {
        id,
        name: pt.name,
        category: pt.category as PointCategory,
        centsPerPoint: pt.centsPerPoint,
      },
    });
    ptIds[pt.name] = id;
  }

  // Hilton
  await prisma.hotelChain.upsert({
    where: { id: HOTEL_ID.HILTON },
    update: {
      name: "Hilton",
      loyaltyProgram: "Hilton Honors",
      basePointRate: 10,
      pointTypeId: ptIds["Hilton Honors Points"],
    },
    create: {
      id: HOTEL_ID.HILTON,
      name: "Hilton",
      loyaltyProgram: "Hilton Honors",
      basePointRate: 10,
      pointTypeId: ptIds["Hilton Honors Points"],
    },
  });
  await upsertEliteStatuses(HOTEL_ID.HILTON, [
    { name: "Silver", bonusPercentage: 0.2, eliteTierLevel: 1 },
    { name: "Gold", bonusPercentage: 0.8, eliteTierLevel: 2 },
    { name: "Diamond", bonusPercentage: 1.0, eliteTierLevel: 3 },
    { name: "Diamond Reserve", bonusPercentage: 1.2, eliteTierLevel: 4 },
  ]);
  await upsertSubBrands(HOTEL_ID.HILTON, [
    { name: "Apartment Collection" },
    { name: "Canopy" },
    { name: "Conrad" },
    { name: "Curio Collection" },
    { name: "DoubleTree" },
    { name: "Embassy Suites" },
    { name: "Graduate" },
    { name: "Hampton" },
    { name: "Hilton Club" },
    { name: "Hilton Garden Inn" },
    { name: "Hilton Grand Vacations" },
    { name: "Hilton" },
    { name: "Hilton Vacation Club" },
    { name: "Home2 Suites", basePointRate: 5 },
    { name: "Homewood Suites", basePointRate: 5 },
    { name: "LivSmart Studios", basePointRate: 5 },
    { name: "LXR" },
    { name: "Motto" },
    { name: "NoMad" },
    { name: "Signia" },
    { name: "Spark", basePointRate: 5 },
    { name: "Tapestry Collection" },
    { name: "Tempo" },
    { name: "Tru", basePointRate: 5 },
    { name: "Waldorf Astoria" },
  ]);

  // Marriott
  await prisma.hotelChain.upsert({
    where: { id: HOTEL_ID.MARRIOTT },
    update: {
      name: "Marriott",
      loyaltyProgram: "Marriott Bonvoy",
      basePointRate: 10,
      pointTypeId: ptIds["Marriott Bonvoy Points"],
    },
    create: {
      id: HOTEL_ID.MARRIOTT,
      name: "Marriott",
      loyaltyProgram: "Marriott Bonvoy",
      basePointRate: 10,
      pointTypeId: ptIds["Marriott Bonvoy Points"],
    },
  });
  await upsertEliteStatuses(HOTEL_ID.MARRIOTT, [
    { name: "Silver", bonusPercentage: 0.1, eliteTierLevel: 1 },
    { name: "Gold", bonusPercentage: 0.25, eliteTierLevel: 2 },
    { name: "Platinum", bonusPercentage: 0.5, eliteTierLevel: 3 },
    { name: "Titanium", bonusPercentage: 0.75, eliteTierLevel: 4 },
    { name: "Ambassador", bonusPercentage: 0.75, eliteTierLevel: 5 },
  ]);
  await upsertSubBrands(HOTEL_ID.MARRIOTT, [
    { name: "AC Hotels" },
    { name: "Aloft" },
    { name: "Apartments by Marriott Bonvoy", basePointRate: 5 },
    { name: "Autograph Collection" },
    { name: "Bulgari" },
    { name: "City Express", basePointRate: 5 },
    { name: "citizenM" },
    { name: "Courtyard" },
    { name: "Delta" },
    { name: "Design" },
    { name: "EDITION" },
    { name: "Element", basePointRate: 5 },
    { name: "Fairfield" },
    { name: "Four Points" },
    { name: "Four Points Express", basePointRate: 5 },
    { name: "Four Points Flex", basePointRate: 5 },
    { name: "Gaylord" },
    { name: "Homes & Villas", basePointRate: 5 },
    { name: "JW Marriott" },
    { name: "Le Meridien" },
    { name: "Marriott Executive Apartments", basePointRate: 5 },
    { name: "Marriott" },
    { name: "Marriott Vacation Club" },
    { name: "MGM Collection" },
    { name: "Moxy" },
    { name: "Protea", basePointRate: 5 },
    { name: "Renaissance" },
    { name: "Residence Inn", basePointRate: 5 },
    { name: "Ritz-Carlton Reserve" },
    { name: "Sheraton" },
    { name: "SpringHill Suites" },
    { name: "St. Regis" },
    { name: "StudioRes", basePointRate: 5 },
    { name: "The Luxury Collection" },
    { name: "The Ritz-Carlton" },
    { name: "TownePlace Suites", basePointRate: 5 },
    { name: "Tribute Portfolio" },
    { name: "W Hotels" },
    { name: "Westin" },
  ]);

  // Hyatt
  await prisma.hotelChain.upsert({
    where: { id: HOTEL_ID.HYATT },
    update: {
      name: "Hyatt",
      loyaltyProgram: "World of Hyatt",
      basePointRate: 5,
      pointTypeId: ptIds["World of Hyatt Points"],
    },
    create: {
      id: HOTEL_ID.HYATT,
      name: "Hyatt",
      loyaltyProgram: "World of Hyatt",
      basePointRate: 5,
      pointTypeId: ptIds["World of Hyatt Points"],
    },
  });
  await upsertEliteStatuses(HOTEL_ID.HYATT, [
    { name: "Discoverist", bonusPercentage: 0.1, eliteTierLevel: 1 },
    { name: "Explorist", bonusPercentage: 0.2, eliteTierLevel: 2 },
    { name: "Globalist", bonusPercentage: 0.3, eliteTierLevel: 3 },
  ]);
  await upsertSubBrands(HOTEL_ID.HYATT, [
    { name: "Alila" },
    { name: "Alua" },
    { name: "Andaz" },
    { name: "Breathless" },
    { name: "Caption" },
    { name: "Destination" },
    { name: "Dream" },
    { name: "Dreams" },
    { name: "Grand Hyatt" },
    { name: "Hyatt Centric" },
    { name: "Hyatt House" },
    { name: "Hyatt Place" },
    { name: "Hyatt Regency" },
    { name: "Hyatt Studios", basePointRate: 2.5 },
    { name: "Hyatt Vacation Club" },
    { name: "Hyatt Vivid" },
    { name: "Hyatt Zilara" },
    { name: "Hyatt Ziva" },
    { name: "Impression by Secrets" },
    { name: "JdV" },
    { name: "Miraval" },
    { name: "Park Hyatt" },
    { name: "Secrets" },
    { name: "Sunscape" },
    { name: "The Unbound Collection" },
    { name: "Thompson" },
    { name: "Zoetry" },
  ]);

  // IHG
  await prisma.hotelChain.upsert({
    where: { id: HOTEL_ID.IHG },
    update: {
      name: "IHG",
      loyaltyProgram: "IHG One Rewards",
      basePointRate: 10,
      pointTypeId: ptIds["IHG One Rewards"],
    },
    create: {
      id: HOTEL_ID.IHG,
      name: "IHG",
      loyaltyProgram: "IHG One Rewards",
      basePointRate: 10,
      pointTypeId: ptIds["IHG One Rewards"],
    },
  });
  await upsertEliteStatuses(HOTEL_ID.IHG, [
    { name: "Silver", bonusPercentage: 0.2, eliteTierLevel: 1 },
    { name: "Gold", bonusPercentage: 0.4, eliteTierLevel: 2 },
    { name: "Platinum", bonusPercentage: 0.6, eliteTierLevel: 3 },
    { name: "Diamond", bonusPercentage: 1.0, eliteTierLevel: 4 },
  ]);
  await upsertSubBrands(HOTEL_ID.IHG, [
    { name: "Atwell Suites" },
    { name: "avid" },
    { name: "Candlewood Suites", basePointRate: 5 },
    { name: "Crowne Plaza" },
    { name: "Even" },
    { name: "Garner" },
    { name: "Holiday Inn Club Vacations" },
    { name: "Holiday Inn Express" },
    { name: "Holiday Inn" },
    { name: "Hotel Indigo" },
    { name: "HUALUXE" },
    { name: "Iberostar" },
    { name: "InterContinental" },
    { name: "Kimpton" },
    { name: "Regent" },
    { name: "Six Senses" },
    { name: "Staybridge Suites", basePointRate: 5 },
    { name: "Vignette Collection" },
    { name: "voco" },
  ]);

  // GHA Discovery
  await prisma.hotelChain.upsert({
    where: { id: HOTEL_ID.GHA_DISCOVERY },
    update: {
      name: "GHA Discovery",
      loyaltyProgram: "GHA Discovery",
      basePointRate: 4,
      pointTypeId: ptIds["Discovery Dollars"],
    },
    create: {
      id: HOTEL_ID.GHA_DISCOVERY,
      name: "GHA Discovery",
      loyaltyProgram: "GHA Discovery",
      basePointRate: 4,
      pointTypeId: ptIds["Discovery Dollars"],
    },
  });
  await upsertEliteStatuses(HOTEL_ID.GHA_DISCOVERY, [
    { name: "Silver", fixedRate: 4, isFixed: true, eliteTierLevel: 1 },
    { name: "Gold", fixedRate: 5, isFixed: true, eliteTierLevel: 2 },
    { name: "Platinum", fixedRate: 6, isFixed: true, eliteTierLevel: 3 },
    { name: "Titanium", fixedRate: 7, isFixed: true, eliteTierLevel: 4 },
  ]);
  await upsertSubBrands(HOTEL_ID.GHA_DISCOVERY, [
    { name: "Anantara" },
    { name: "Andronis" },
    { name: "Araiya" },
    { name: "Arjaan" },
    { name: "ASMALLWORLD" },
    { name: "Avani" },
    { name: "Bristoria" },
    { name: "Capella" },
    { name: "Centro" },
    { name: "Cheval Collection" },
    { name: "Cinnamon" },
    { name: "Corinthia" },
    { name: "Divani Collection" },
    { name: "Edge" },
    { name: "Elewana Collection" },
    { name: "iclub" },
    { name: "iStay" },
    { name: "JA" },
    { name: "Kempinski" },
    { name: "Lanson Place" },
    { name: "Lore Group" },
    { name: "Lungarno Collection" },
    { name: "Maqo" },
    { name: "Marco Polo" },
    { name: "Minor" },
    { name: "Mysk" },
    { name: "NH Collection" },
    { name: "NH Hotels" },
    { name: "nhow" },
    { name: "Niccolo" },
    { name: "Nikki Beach" },
    { name: "NUO" },
    { name: "Oaks" },
    { name: "OUTRIGGER" },
    { name: "Pan Pacific" },
    { name: "Paramount" },
    { name: "PARKROYAL COLLECTION" },
    { name: "PARKROYAL" },
    { name: "Patina" },
    { name: "Rayhaan" },
    { name: "Regal" },
    { name: "Rotana" },
    { name: "SAii" },
    { name: "Shaza" },
    { name: "Sun International" },
    { name: "Sunway" },
    { name: "TemptingPlaces" },
    { name: "The Doyle Collection" },
    { name: "The Leela" },
    { name: "The Residence by Cenizaro" },
    { name: "The Set Collection" },
    { name: "The Sukhothai" },
    { name: "Tivoli" },
    { name: "Ultratravel Collection" },
    { name: "Unike Hoteller" },
    { name: "Verdi" },
    { name: "Viceroy" },
  ]);

  // Accor
  const ACCOR_BASE_RATE = 25 / 12; // ~2.0833
  await prisma.hotelChain.upsert({
    where: { id: HOTEL_ID.ACCOR },
    update: {
      name: "Accor",
      loyaltyProgram: "ALL - Accor Live Limitless",
      basePointRate: ACCOR_BASE_RATE,
      pointTypeId: ptIds["ALL - Accor Live Limitless"],
    },
    create: {
      id: HOTEL_ID.ACCOR,
      name: "Accor",
      loyaltyProgram: "ALL - Accor Live Limitless",
      basePointRate: ACCOR_BASE_RATE,
      pointTypeId: ptIds["ALL - Accor Live Limitless"],
    },
  });
  await upsertEliteStatuses(HOTEL_ID.ACCOR, [
    { name: "Silver", bonusPercentage: 0.24, eliteTierLevel: 1 },
    { name: "Gold", bonusPercentage: 0.48, eliteTierLevel: 2 },
    { name: "Platinum", bonusPercentage: 0.76, eliteTierLevel: 3 },
    { name: "Diamond", bonusPercentage: 0.76, eliteTierLevel: 4 },
  ]);
  await upsertSubBrands(HOTEL_ID.ACCOR, [
    { name: "21c Museum" },
    { name: "25hours" },
    { name: "Adagio", basePointRate: 10 / 12 },
    { name: "Adagio Access", basePointRate: 5 / 12 },
    { name: "Banyan Tree" },
    { name: "Emblems Collection" },
    { name: "Faena" },
    { name: "Fairmont" },
    { name: "Grand Mercure" },
    { name: "Greet" },
    { name: "Handwritten Collection" },
    { name: "hotelF1", basePointRate: 5 / 12 },
    { name: "Hyde" },
    { name: "ibis", basePointRate: 12.5 / 12 },
    { name: "ibis budget", basePointRate: 5 / 12 },
    { name: "ibis Styles", basePointRate: 12.5 / 12 },
    { name: "Jo&Joe" },
    { name: "Mama Shelter" },
    { name: "Mantis" },
    { name: "Mercure" },
    { name: "MGallery" },
    { name: "Mondrian" },
    { name: "Mövenpick" },
    { name: "Novotel" },
    { name: "Orient Express" },
    { name: "Pullman" },
    { name: "Raffles" },
    { name: "Rixos" },
    { name: "SLS" },
    { name: "SO/" },
    { name: "Sofitel" },
    { name: "Sofitel Legend" },
    { name: "Swissôtel" },
    { name: "Hoxton" },
    { name: "The Sebel" },
    { name: "Tribe" },
  ]);

  // Seed UserStatus
  await upsertUserStatus(HOTEL_ID.ACCOR, "Platinum");
  await upsertUserStatus(HOTEL_ID.MARRIOTT, "Titanium");
  await upsertUserStatus(HOTEL_ID.HYATT, "Globalist");
  await upsertUserStatus(HOTEL_ID.HILTON, "Diamond");
  await upsertUserStatus(HOTEL_ID.IHG, "Diamond");
  await upsertUserStatus(HOTEL_ID.GHA_DISCOVERY, "Titanium");

  // Credit Cards
  const ccAmexId = "cme8yfwy2hfqahb6ync8czd24";
  await prisma.creditCard.upsert({
    where: { id: ccAmexId },
    update: {
      name: "Amex Platinum",
      rewardType: "points",
      rewardRate: 1,
      pointTypeId: ptIds["Membership Rewards"],
    },
    create: {
      id: ccAmexId,
      name: "Amex Platinum",
      rewardType: "points",
      rewardRate: 1,
      pointTypeId: ptIds["Membership Rewards"],
    },
  });
  const ccChaseId = "cw4yg6ftdskwq651p3p8nrvnr";
  await prisma.creditCard.upsert({
    where: { id: ccChaseId },
    update: {
      name: "Chase Sapphire Reserve",
      rewardType: "points",
      rewardRate: 4,
      pointTypeId: ptIds["Ultimate Rewards"],
    },
    create: {
      id: ccChaseId,
      name: "Chase Sapphire Reserve",
      rewardType: "points",
      rewardRate: 4,
      pointTypeId: ptIds["Ultimate Rewards"],
    },
  });
  const ccCaponeId = "cwkch5kds4vlhety0vbjxep5m";
  await prisma.creditCard.upsert({
    where: { id: ccCaponeId },
    update: {
      name: "Capital One Venture X",
      rewardType: "points",
      rewardRate: 2,
      pointTypeId: ptIds["Capital One Miles"],
    },
    create: {
      id: ccCaponeId,
      name: "Capital One Venture X",
      rewardType: "points",
      rewardRate: 2,
      pointTypeId: ptIds["Capital One Miles"],
    },
  });
  const ccWfId = "cvn8tp6d6nae4s543nno1qc6p";
  await prisma.creditCard.upsert({
    where: { id: ccWfId },
    update: {
      name: "Wells Fargo Autograph Journey",
      rewardType: "points",
      rewardRate: 5,
      pointTypeId: ptIds["Wells Fargo Rewards"],
    },
    create: {
      id: ccWfId,
      name: "Wells Fargo Autograph Journey",
      rewardType: "points",
      rewardRate: 5,
      pointTypeId: ptIds["Wells Fargo Rewards"],
    },
  });

  // OTA Agencies
  const otaAmexFhrId = "c2kjfusly4a0127ty3vj1ilii";
  await prisma.otaAgency.upsert({
    where: { id: otaAmexFhrId },
    update: { name: "AMEX FHR" },
    create: { id: otaAmexFhrId, name: "AMEX FHR" },
  });
  const otaAmexThcId = "c0t44386bltnv0weekdizhsbo";
  await prisma.otaAgency.upsert({
    where: { id: otaAmexThcId },
    update: { name: "AMEX THC" },
    create: { id: otaAmexThcId, name: "AMEX THC" },
  });
  const otaChaseEditId = "c656cp2gyguq568kf1ukey5hz";
  await prisma.otaAgency.upsert({
    where: { id: otaChaseEditId },
    update: { name: "Chase The Edit" },
    create: { id: otaChaseEditId, name: "Chase The Edit" },
  });

  // Shopping Portals
  const spRakutenId = "cj774ttrj5g3wzk24foulu47x";
  await prisma.shoppingPortal.upsert({
    where: { id: spRakutenId },
    update: { name: "Rakuten", rewardType: "points", pointTypeId: ptIds["Bilt"] }, // Rakuten -> Bilt/MR
    create: { id: spRakutenId, name: "Rakuten", rewardType: "points", pointTypeId: ptIds["Bilt"] },
  });
  const spTopCashbackId = "cnj91ehnjvuu34xnsa8l9lem4";
  await prisma.shoppingPortal.upsert({
    where: { id: spTopCashbackId },
    update: { name: "TopCashback", rewardType: "cashback", pointTypeId: null },
    create: { id: spTopCashbackId, name: "TopCashback", rewardType: "cashback" },
  });
  const spBaId = "cjh7oskumoc40su7j747thqig";
  await prisma.shoppingPortal.upsert({
    where: { id: spBaId },
    update: { name: "British Airways", rewardType: "points", pointTypeId: ptIds["Avios"] },
    create: {
      id: spBaId,
      name: "British Airways",
      rewardType: "points",
      pointTypeId: ptIds["Avios"],
    },
  });

  console.log("Seed data created successfully");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
