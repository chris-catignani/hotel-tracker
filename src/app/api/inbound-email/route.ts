import { NextRequest, NextResponse } from "next/server";
import { withAxiom } from "next-axiom";
import { Webhook } from "svix";
import prisma from "@/lib/prisma";
import { parseConfirmationEmail } from "@/lib/email-ingestion/email-parser";
import { ingestBookingFromEmail } from "@/lib/email-ingestion/ingest-booking";
import { sendIngestionConfirmation, sendIngestionError } from "@/lib/email";
import { logger } from "@/lib/logger";

/**
 * Resend Inbound email webhook.
 *
 * Resend wraps the email in an envelope:
 * {
 *   type: "email.received",
 *   created_at: string,
 *   data: {
 *     to: string[],      // recipient addresses
 *     from: string,      // forwarding user's email address
 *     subject: string,
 *     html: string,      // full raw email HTML
 *     text: string,
 *   }
 * }
 */
interface ResendInboundPayload {
  type: string;
  data: {
    email_id: string;
    to: string[];
    from: string;
    subject?: string;
  };
}

async function handler(req: NextRequest): Promise<NextResponse> {
  const signingSecret = process.env.RESEND_WEBHOOK_SIGNING_SECRET;
  const inboundEmail = process.env.RESEND_INBOUND_EMAIL;
  if (!signingSecret || !inboundEmail) {
    logger.error(
      "inbound-email: missing RESEND_WEBHOOK_SIGNING_SECRET or RESEND_INBOUND_EMAIL env var"
    );
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }

  const rawBody = await req.text();

  // Verify Resend webhook signature via svix
  const wh = new Webhook(signingSecret);
  let payload: ResendInboundPayload;
  try {
    payload = wh.verify(rawBody, {
      "svix-id": req.headers.get("svix-id") ?? "",
      "svix-timestamp": req.headers.get("svix-timestamp") ?? "",
      "svix-signature": req.headers.get("svix-signature") ?? "",
    }) as ResendInboundPayload;
  } catch (err) {
    logger.warn("inbound-email: svix signature verification failed", { error: err });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data } = payload;

  // Filter to only process emails addressed to the designated inbound address
  if (!data.to.includes(inboundEmail)) {
    logger.info("inbound-email:discarded", {
      reason: "wrong_recipient",
      resendEmailId: data.email_id,
    });
    return NextResponse.json({ ok: true });
  }

  const forwarderEmail = data.from ?? "";

  logger.info("inbound-email:received", { subject: data.subject, resendEmailId: data.email_id });

  // Fetch full email body from Resend — webhook payload only contains metadata
  const emailRes = await fetch(`https://api.resend.com/emails/receiving/${data.email_id}`, {
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
  });
  if (!emailRes.ok) {
    logger.error("inbound-email: failed to fetch email body from Resend API", {
      status: emailRes.status,
      resendEmailId: data.email_id,
      outcome: "fetch_failed",
    });
    // 404 may be timing (email not yet available) and 5xx are transient — let Resend retry
    // Other 4xx are permanent failures (e.g. bad API key) — ack to prevent pointless retries
    const isTransient = emailRes.status === 404 || emailRes.status >= 500;
    return NextResponse.json({ ok: true }, { status: isTransient ? 500 : 200 });
  }
  const emailData = (await emailRes.json()) as { html?: string | null; text?: string | null };
  const rawEmail = emailData.html ?? emailData.text ?? "";

  // Identify user
  const user = await prisma.user.findFirst({
    where: { email: forwarderEmail },
  });
  if (!user) {
    logger.info("inbound-email:discarded", {
      reason: "user_not_found",
      resendEmailId: data.email_id,
    });
    return NextResponse.json({ ok: true });
  }

  // Resend doesn't expose the original sender domain for forwarded emails,
  // so we can't identify the chain — pass null and let Claude parse without chain hints
  const parsed = await parseConfirmationEmail(rawEmail, null);
  if (!parsed) {
    logger.warn("inbound-email:parse_failed", { userId: user.id, resendEmailId: data.email_id });
    await sendIngestionError({
      to: user.email!,
      reason: "We couldn't recognise the booking details in this email.",
    });
    return NextResponse.json({ ok: true });
  }

  // Create booking
  const { bookingId, duplicate } = await ingestBookingFromEmail(parsed, user.id, null);

  if (duplicate) {
    logger.info("inbound-email:duplicate", {
      bookingId,
      confirmationNumber: parsed.confirmationNumber,
      userId: user.id,
      resendEmailId: data.email_id,
    });
  } else {
    logger.info("inbound-email:booking_created", {
      bookingId,
      property: parsed.propertyName,
      checkIn: parsed.checkIn,
      userId: user.id,
      resendEmailId: data.email_id,
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

export const POST = withAxiom(handler);
