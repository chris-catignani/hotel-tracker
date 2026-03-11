/**
 * Email notifications via Resend.
 *
 * Required env vars:
 *   RESEND_API_KEY   — from resend.com
 *   RESEND_FROM_EMAIL — verified sender address (e.g. "alerts@yourdomain.com")
 */

import { Resend } from "resend";

let _resend: Resend | null = null;

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

  const lines: string[] = [
    `<h2>Price Drop Alert: ${params.propertyName}</h2>`,
    `<p>Dates: ${params.checkIn} → ${params.checkOut}</p>`,
  ];

  if (params.cashPrice !== null && params.cashThreshold !== null) {
    lines.push(
      `<p>💰 Cash rate dropped to <strong>${params.cashCurrency} ${params.cashPrice.toFixed(2)}</strong> (your threshold: ${params.cashCurrency} ${params.cashThreshold.toFixed(2)})</p>`
    );
  }
  if (params.awardPrice !== null && params.awardThreshold !== null) {
    lines.push(
      `<p>🏆 Award rate dropped to <strong>${params.awardPrice.toLocaleString()} points</strong> (your threshold: ${params.awardThreshold.toLocaleString()} pts)</p>`
    );
  }

  lines.push(
    `<p><a href="${process.env.NEXTAUTH_URL ?? "https://your-app.vercel.app"}/bookings/${params.bookingId}">View Booking</a></p>`
  );

  await resend.emails.send({
    from,
    to: params.to,
    subject: `Price drop detected: ${params.propertyName}`,
    html: lines.join("\n"),
  });
}
