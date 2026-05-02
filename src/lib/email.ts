/**
 * Email notifications via Resend.
 *
 * Required env vars:
 *   RESEND_API_KEY   — from resend.com
 *   RESEND_FROM_EMAIL — verified sender address (e.g. "alerts@yourdomain.com")
 */

import { Resend } from "resend";

let _resend: Resend | null = null;

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

export interface PriceDropAlertParams {
  to: string;
  propertyName: string;
  checkIn: string; // YYYY-MM-DD
  checkOut: string; // YYYY-MM-DD
  cashPrice: number | null;
  cashCurrency: string;
  cashThreshold: number | null;
  awardPrice: number | null;
  awardThreshold: number | null;
  bookingId: string;
}

export async function sendPriceDropAlert(params: PriceDropAlertParams): Promise<void> {
  const resend = getResend();
  const from = process.env.RESEND_FROM_EMAIL;
  if (!resend || !from) {
    console.warn("[email] Resend not configured — skipping alert");
    return;
  }

  const appUrl = process.env.NEXTAUTH_URL ?? process.env.APP_URL ?? "";
  const safePropertyName = escapeHtml(params.propertyName);
  const safeCheckIn = escapeHtml(params.checkIn);
  const safeCheckOut = escapeHtml(params.checkOut);
  // bookingId is a cuid() — alphanumeric, no escaping risk, but escape for safety
  const safeBookingId = escapeHtml(params.bookingId);

  const lines: string[] = [
    `<h2>Price Drop Alert: ${safePropertyName}</h2>`,
    `<p>Dates: ${safeCheckIn} → ${safeCheckOut}</p>`,
  ];

  if (params.cashPrice !== null && params.cashThreshold !== null) {
    lines.push(
      `<p>💰 Total cash price dropped to <strong>${params.cashCurrency} ${params.cashPrice.toFixed(2)}</strong> (your threshold: ${params.cashCurrency} ${params.cashThreshold.toFixed(2)})</p>`
    );
  }
  if (params.awardPrice !== null && params.awardThreshold !== null) {
    lines.push(
      `<p>🏆 Total award price dropped to <strong>${params.awardPrice.toLocaleString()} points</strong> (your threshold: ${params.awardThreshold.toLocaleString()} pts)</p>`
    );
  }

  if (appUrl) {
    lines.push(`<p><a href="${appUrl}/bookings/${safeBookingId}">View Booking</a></p>`);
  }

  const { error } = await resend.emails.send({
    from,
    to: params.to,
    subject: `Price drop detected: ${safePropertyName}`,
    html: lines.join("\n"),
  });
  if (error) {
    console.error("[email] Failed to send price drop alert", { error });
  }
}

export async function sendIngestionConfirmation({
  to,
  propertyName,
  checkIn,
  checkOut,
  bookingId,
  isUpdate = false,
}: {
  to: string;
  propertyName: string;
  checkIn: string;
  checkOut: string;
  bookingId: string;
  isUpdate?: boolean;
}): Promise<void> {
  const resend = getResend();
  const from = process.env.RESEND_FROM_EMAIL;
  if (!resend || !from) return;
  const appUrl = process.env.NEXTAUTH_URL ?? process.env.VERCEL_URL ?? "http://localhost:3000";
  const bookingUrl = `${appUrl}/bookings/${bookingId}`;

  const subject = isUpdate
    ? `Booking updated: ${escapeHtml(propertyName)}`
    : `Booking created: ${escapeHtml(propertyName)}`;

  const bodyPrefix = isUpdate
    ? `Your booking at <strong>${escapeHtml(propertyName)}</strong> (${escapeHtml(checkIn)} – ${escapeHtml(checkOut)}) has been updated.`
    : `Your booking at <strong>${escapeHtml(propertyName)}</strong> (${escapeHtml(checkIn)} – ${escapeHtml(checkOut)}) has been added to your tracker.`;

  const bodySuffix = isUpdate
    ? `Please review the changes to ensure everything is correct.`
    : `Open it to add your credit card and any missing details.`;

  await resend.emails.send({
    from,
    to,
    subject,
    html:
      `<p>${bodyPrefix}</p>` +
      `<p><a href="${escapeHtml(bookingUrl)}">View &amp; verify the booking →</a></p>` +
      `<p style="color:#92400e;font-size:0.875rem;">This booking was ${isUpdate ? "updated" : "created"} from a forwarded email. ` +
      `${bodySuffix}</p>`,
  });
}

export async function sendIngestionError({
  to,
  reason,
}: {
  to: string;
  reason: string;
}): Promise<void> {
  const resend = getResend();
  const from = process.env.RESEND_FROM_EMAIL;
  if (!resend || !from) return;
  const appUrl = process.env.NEXTAUTH_URL ?? process.env.VERCEL_URL ?? "http://localhost:3000";
  const newBookingUrl = `${appUrl}/bookings/new`;
  await resend.emails.send({
    from,
    to,
    subject: "Could not parse your hotel confirmation email",
    html:
      `<p>We received your forwarded hotel confirmation email but couldn't create a booking automatically.</p>` +
      `<p>Reason: ${escapeHtml(reason)}</p>` +
      `<p><a href="${escapeHtml(newBookingUrl)}">Create the booking manually →</a></p>`,
  });
}
