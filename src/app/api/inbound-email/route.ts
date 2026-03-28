import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import prisma from "@/lib/prisma";
import { getChainGuide } from "@/lib/email-ingestion/chain-guides";
import { parseConfirmationEmail } from "@/lib/email-ingestion/email-parser";
import { ingestBookingFromEmail } from "@/lib/email-ingestion/ingest-booking";
import { sendIngestionConfirmation, sendIngestionError } from "@/lib/email";
import { logger } from "@/lib/logger";

/**
 * Resend Inbound email webhook.
 *
 * Expected payload from Resend Inbound:
 * {
 *   to: string,        // recipient address (must match RESEND_INBOUND_EMAIL)
 *   from: string,      // forwarding user's email address
 *   sender: string,    // original sender (the hotel)
 *   subject: string,
 *   html: string,      // full raw email HTML
 *   text: string,
 * }
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const rawBody = await req.text();

  // Verify Resend webhook signature via svix
  const wh = new Webhook(process.env.RESEND_WEBHOOK_SIGNING_SECRET!);
  let body: Record<string, string>;
  try {
    body = wh.verify(rawBody, {
      "svix-id": req.headers.get("svix-id") ?? "",
      "svix-timestamp": req.headers.get("svix-timestamp") ?? "",
      "svix-signature": req.headers.get("svix-signature") ?? "",
    }) as Record<string, string>;
  } catch {
    logger.warn("inbound-email: svix signature verification failed");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Filter to only process emails addressed to the designated inbound address
  if (body.to !== process.env.RESEND_INBOUND_EMAIL) {
    logger.info("inbound-email: discarding email — wrong recipient", { to: body.to });
    return NextResponse.json({ ok: true });
  }

  const forwarderEmail = body.from ?? "";
  const senderEmail = body.sender ?? body.from ?? "";
  const rawEmail = body.html ?? body.text ?? "";

  logger.info("inbound-email: received", { from: forwarderEmail, sender: senderEmail });

  // Identify user
  const user = await prisma.user.findFirst({
    where: { email: forwarderEmail },
  });
  if (!user) {
    logger.info("inbound-email: discarding email — no matching user", { from: forwarderEmail });
    return NextResponse.json({ ok: true });
  }

  // Identify chain
  const guide = getChainGuide(senderEmail);
  logger.info("inbound-email: chain identified", {
    chain: guide?.chainName ?? "unknown",
    sender: senderEmail,
  });

  // Parse email
  const parsed = await parseConfirmationEmail(rawEmail, guide);
  if (!parsed) {
    logger.warn("inbound-email: parse failed", {
      chain: guide?.chainName ?? "unknown",
      from: forwarderEmail,
    });
    await sendIngestionError({
      to: user.email!,
      reason: guide
        ? `We couldn't extract the required fields from your ${guide.chainName} confirmation.`
        : "We couldn't recognise the booking details in this email.",
    });
    return NextResponse.json({ ok: true });
  }

  // Create booking
  const { bookingId, duplicate } = await ingestBookingFromEmail(
    parsed,
    user.id,
    guide?.chainName ?? null
  );

  if (duplicate) {
    logger.info("inbound-email: duplicate booking, skipping", {
      bookingId,
      confirmationNumber: parsed.confirmationNumber,
    });
  } else {
    logger.info("inbound-email: booking created", {
      bookingId,
      property: parsed.propertyName,
      checkIn: parsed.checkIn,
    });
    await sendIngestionConfirmation({
      to: user.email!,
      propertyName: parsed.propertyName,
      checkIn: parsed.checkIn,
      checkOut: parsed.checkOut,
      bookingId,
    });
  }

  return NextResponse.json({ ok: true });
}
