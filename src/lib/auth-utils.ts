import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";

export async function getAuthenticatedUserId(): Promise<string | NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return session.user.id;
}

export async function requireAdmin(): Promise<void | NextResponse> {
  const session = await auth();
  if ((session?.user as { role?: UserRole } | undefined)?.role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
}
