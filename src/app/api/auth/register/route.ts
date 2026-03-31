import { NextRequest, NextResponse } from "next/server";
import { withObservability } from "@/lib/observability";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { apiError } from "@/lib/api-error";
import { logger } from "@/lib/logger";

export const POST = withObservability(async (request: NextRequest) => {
  try {
    const { email, password, name } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      logger.info("auth:registered", { outcome: "duplicate" });
      return NextResponse.json({ error: "Email already in use" }, { status: 409 });
    }

    const hashed = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { email, password: hashed, name: name || null },
      select: { id: true, email: true, name: true, role: true },
    });

    logger.info("auth:registered", { outcome: "success", userId: user.id });
    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    return apiError("Failed to register user", error, 500, request);
  }
});
