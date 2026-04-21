import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

vi.mock("@/lib/auth-utils", () => ({
  requireAdmin: vi.fn(),
}));
vi.mock("@/services/gha-directory-ingest", () => ({
  ingestGhaDirectory: vi.fn(),
}));

import { requireAdmin } from "@/lib/auth-utils";
import { ingestGhaDirectory } from "@/services/gha-directory-ingest";
import { POST } from "./route";
import { HOTEL_ID } from "@/lib/constants";

describe("POST /api/admin/reingest-chain/[chainId]", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    (ingestGhaDirectory as ReturnType<typeof vi.fn>).mockResolvedValue({
      harvestedCount: 5,
      stampedCount: 0,
      fetchedCount: 5,
      upsertedCount: 5,
      skippedCount: 0,
      errors: [],
    });
  });

  it("returns 403 for non-admins", async () => {
    (requireAdmin as ReturnType<typeof vi.fn>).mockResolvedValue(
      new NextResponse(null, { status: 403 })
    );
    const req = new NextRequest("http://localhost/api/admin/reingest-chain/x", { method: "POST" });
    const res = await POST(req, { params: Promise.resolve({ chainId: HOTEL_ID.GHA_DISCOVERY }) });
    expect(res.status).toBe(403);
  });

  it("400s for unknown chains", async () => {
    (requireAdmin as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    const req = new NextRequest("http://localhost/api/admin/reingest-chain/x", { method: "POST" });
    const res = await POST(req, { params: Promise.resolve({ chainId: "unknown" }) });
    expect(res.status).toBe(400);
  });

  it("runs the GHA ingester with forceFullRefetch=true", async () => {
    (requireAdmin as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    const req = new NextRequest("http://localhost/api/admin/reingest-chain/x", { method: "POST" });
    const res = await POST(req, { params: Promise.resolve({ chainId: HOTEL_ID.GHA_DISCOVERY }) });
    expect(res.status).toBe(200);
    expect(ingestGhaDirectory).toHaveBeenCalledWith({ forceFullRefetch: true });
  });
});
