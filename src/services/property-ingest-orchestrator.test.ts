import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    property: {
      createMany: vi.fn(),
    },
    hotelChainSubBrand: {
      upsert: vi.fn(),
    },
    $executeRawUnsafe: vi.fn(),
  },
}));

import prisma from "@/lib/prisma";
import { writeProperties, type ParsedProperty } from "./property-ingest-orchestrator";

function makeProperty(overrides: Partial<ParsedProperty> = {}): ParsedProperty {
  return {
    name: "Test Hotel",
    chainPropertyId: "TEST1",
    chainUrlPath: null,
    countryCode: "US",
    city: "New York",
    address: "1 Main St",
    latitude: 40.0,
    longitude: -74.0,
    subBrandName: "TestBrand",
    ...overrides,
  };
}

describe("writeProperties", () => {
  beforeEach(() => vi.clearAllMocks());

  it("upserts each unique sub-brand once", async () => {
    (prisma.hotelChainSubBrand.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "sb1" });
    (prisma.property.createMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 2 });
    (prisma.$executeRawUnsafe as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    await writeProperties(
      "chain-1",
      [
        makeProperty({ subBrandName: "BrandA" }),
        makeProperty({ chainPropertyId: "TEST2", subBrandName: "BrandA" }),
        makeProperty({ chainPropertyId: "TEST3", subBrandName: "BrandB" }),
      ],
      { conflictKey: "chainPropertyId" }
    );

    expect(prisma.hotelChainSubBrand.upsert).toHaveBeenCalledTimes(2);
    expect(prisma.hotelChainSubBrand.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ name: "BrandA" }) })
    );
    expect(prisma.hotelChainSubBrand.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ name: "BrandB" }) })
    );
  });

  it("skips sub-brand upsert for properties with no subBrandName", async () => {
    (prisma.property.createMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 });
    (prisma.$executeRawUnsafe as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    await writeProperties("chain-1", [makeProperty({ subBrandName: null })], {
      conflictKey: "chainPropertyId",
    });

    expect(prisma.hotelChainSubBrand.upsert).not.toHaveBeenCalled();
  });

  it("calls createMany once per batch with skipDuplicates", async () => {
    (prisma.hotelChainSubBrand.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "sb1" });
    (prisma.property.createMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 2 });
    (prisma.$executeRawUnsafe as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    const properties = [makeProperty(), makeProperty({ chainPropertyId: "TEST2" })];

    await writeProperties("chain-1", properties, { conflictKey: "chainPropertyId" });

    expect(prisma.property.createMany).toHaveBeenCalledTimes(1);
    expect(prisma.property.createMany).toHaveBeenCalledWith(
      expect.objectContaining({ skipDuplicates: true })
    );
  });

  it("splits into multiple batches when properties exceed batchSize", async () => {
    (prisma.hotelChainSubBrand.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "sb1" });
    (prisma.property.createMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 2 });
    (prisma.$executeRawUnsafe as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    const properties = Array.from({ length: 5 }, (_, i) =>
      makeProperty({ chainPropertyId: `P${i}` })
    );

    await writeProperties("chain-1", properties, { conflictKey: "chainPropertyId", batchSize: 2 });

    // 5 properties / batchSize 2 = 3 batches
    expect(prisma.property.createMany).toHaveBeenCalledTimes(3);
    expect(prisma.$executeRawUnsafe).toHaveBeenCalledTimes(3);
  });

  it("calls $executeRawUnsafe with chainPropertyId match for chainPropertyId conflict key", async () => {
    (prisma.hotelChainSubBrand.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "sb1" });
    (prisma.property.createMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 });
    (prisma.$executeRawUnsafe as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    await writeProperties("chain-1", [makeProperty()], { conflictKey: "chainPropertyId" });

    const sql = (prisma.$executeRawUnsafe as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(sql).toContain("chain_property_id = v.chain_property_id");
  });

  it("calls $executeRawUnsafe with chainUrlPath match for chainUrlPath conflict key", async () => {
    (prisma.hotelChainSubBrand.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "sb1" });
    (prisma.property.createMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 });
    (prisma.$executeRawUnsafe as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    await writeProperties(
      "chain-1",
      [makeProperty({ chainPropertyId: null, chainUrlPath: "/anantara/test" })],
      { conflictKey: "chainUrlPath" }
    );

    const sql = (prisma.$executeRawUnsafe as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(sql).toContain("chain_url_path = v.chain_url_path");
  });

  it("returns processedCount equal to total properties across all batches", async () => {
    (prisma.hotelChainSubBrand.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "sb1" });
    (prisma.property.createMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 2 });
    (prisma.$executeRawUnsafe as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    const result = await writeProperties(
      "chain-1",
      [makeProperty(), makeProperty({ chainPropertyId: "TEST2" })],
      { conflictKey: "chainPropertyId" }
    );

    expect(result.processedCount).toBe(2);
    expect(result.errors).toHaveLength(0);
  });

  it("counts dbOperationCount as globally unique subBrands + 2 per batch", async () => {
    (prisma.hotelChainSubBrand.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "sb1" });
    (prisma.property.createMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 2 });
    (prisma.$executeRawUnsafe as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    const result = await writeProperties(
      "chain-1",
      [
        makeProperty({ chainPropertyId: "P1", subBrandName: "BrandA" }),
        makeProperty({ chainPropertyId: "P2", subBrandName: "BrandB" }),
        makeProperty({ chainPropertyId: "P3", subBrandName: "BrandA" }),
        makeProperty({ chainPropertyId: "P4", subBrandName: "BrandB" }),
      ],
      { conflictKey: "chainPropertyId", batchSize: 2 }
    );

    // 2 globally unique sub-brands + 2 batches × 2 = 6
    expect(result.dbOperationCount).toBe(6);
  });

  it("captures individual sub-brand upsert failures without aborting the batch", async () => {
    (prisma.hotelChainSubBrand.upsert as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new Error("upsert failed"))
      .mockResolvedValue({ id: "sb2" });
    (prisma.property.createMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 2 });
    (prisma.$executeRawUnsafe as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    const result = await writeProperties(
      "chain-1",
      [
        makeProperty({ subBrandName: "BrandA" }),
        makeProperty({ chainPropertyId: "TEST2", subBrandName: "BrandB" }),
      ],
      { conflictKey: "chainPropertyId" }
    );

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("subBrand[BrandA]");
    expect(prisma.property.createMany).toHaveBeenCalledTimes(1);
  });

  it("captures batch-level errors without aborting other batches", async () => {
    (prisma.hotelChainSubBrand.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "sb1" });
    (prisma.property.createMany as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new Error("DB timeout"))
      .mockResolvedValue({ count: 1 });
    (prisma.$executeRawUnsafe as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    const properties = [
      makeProperty({ chainPropertyId: "FAIL" }),
      makeProperty({ chainPropertyId: "OK" }),
    ];

    const result = await writeProperties("chain-1", properties, {
      conflictKey: "chainPropertyId",
      batchSize: 1,
    });

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("batch[0]");
    expect(result.processedCount).toBe(1);
  });
});
