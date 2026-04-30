import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/**
 * POST /api/e2e/make-admin — promote a user to ADMIN role.
 * Only active when E2E_ALLOW_ADMIN_REGISTER=true. Never expose in production.
 */
export async function POST(request: NextRequest) {
  if (process.env.E2E_ALLOW_ADMIN_REGISTER !== "true") {
    return new NextResponse(null, { status: 404 });
  }

  const { email } = await request.json();
  if (!email) {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }

  await prisma.user.update({ where: { email }, data: { role: "ADMIN" } });
  return NextResponse.json({ ok: true });
}
