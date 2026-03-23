import { describe, it, expect, vi } from "vitest";
import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getAuthenticatedUserId, requireAdmin } from "./auth-utils";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

import { auth } from "@/auth";

describe("getAuthenticatedUserId", () => {
  it("returns the userId string when session has user.id", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-123", email: "test@example.com" },
      expires: "2099-01-01",
    } as never);

    const result = await getAuthenticatedUserId();
    expect(result).toBe("user-123");
  });

  it("returns a NextResponse with status 401 when session is null", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    const result = await getAuthenticatedUserId();
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(401);
  });

  it("returns 401 when session has no user id", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { email: "test@example.com" },
      expires: "2099-01-01",
    } as never);

    const result = await getAuthenticatedUserId();
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(401);
  });
});

describe("requireAdmin", () => {
  it("returns undefined when user role is ADMIN", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-123", email: "admin@example.com", role: UserRole.ADMIN },
      expires: "2099-01-01",
    } as never);

    const result = await requireAdmin();
    expect(result).toBeUndefined();
  });

  it("returns a NextResponse with status 403 when user role is USER", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-456", email: "user@example.com", role: UserRole.USER },
      expires: "2099-01-01",
    } as never);

    const result = await requireAdmin();
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(403);
  });

  it("returns 403 when session is null", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    const result = await requireAdmin();
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(403);
  });
});
