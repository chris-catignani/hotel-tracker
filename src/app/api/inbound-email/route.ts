import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getChainGuide } from "@/lib/email-ingestion/chain-guides";
import { parseConfirmationEmail } from "@/lib/email-ingestion/email-parser";
import { ingestBookingFromEmail } from "@/lib/email-ingestion/ingest-booking";
import { sendIngestionConfirmation, sendIngestionError } from "@/lib/email";

/**
 * Resend Inbound email webhook.
 *
 * Expected payload from Resend Inbound:
 * {
 *   from: string,      // forwarding user's email address
 *   sender: string,    // original sender (the hotel)
 *   subject: string,
 *   html: string,      // full raw email HTML
 *   text: string,
 * }
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  // Auth check
  const secret = req.headers.get("x-webhook-secret");
  if (!secret || secret !== process.env.INBOUND_EMAIL_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const forwarderEmail = body.from ?? "";
  const senderEmail = body.sender ?? body.from ?? "";
  const rawEmail = body.html ?? body.text ?? "";

  // Identify user
  const user = await prisma.user.findFirst({
    where: { email: forwarderEmail },
  });
  if (!user) {
    // Silently discard — do not leak account existence
    return NextResponse.json({ ok: true });
  }

  // Identify chain
  const guide = getChainGuide(senderEmail);

  // Parse email
  const parsed = await parseConfirmationEmail(rawEmail, guide);
  if (!parsed) {
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

  if (!duplicate) {
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
