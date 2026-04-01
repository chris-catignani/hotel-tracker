/**
 * Manual integration test: runs each fixture through Claude using the real API.
 * Usage: npx tsx --env-file=.env scripts/test-email-parsing.ts
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { simpleParser } from "mailparser";
import { decodeEmailToText, parseConfirmationEmail } from "../src/lib/email-ingestion/email-parser";
import { getChainGuide, extractDomain } from "../src/lib/email-ingestion/chain-guides/index";

/** Parse the raw MIME email and return html ?? text body, just like Resend does in production. */
async function extractEmailBody(raw: string): Promise<string> {
  const parsed = await simpleParser(raw);
  return parsed.html || parsed.text || "";
}

const FIXTURES: { file: string; senderEmail: string }[] = [
  { file: "accor-confirmation-cash", senderEmail: "all@confirmation.all.com" },
  { file: "airbnb-confirmation-cash", senderEmail: "automated@airbnb.com" },
  { file: "airbnb-confirmation-cash-2", senderEmail: "automated@airbnb.com" },
  {
    file: "amex-fhr-confirmation-cash",
    senderEmail: "AmericanExpress@welcome.americanexpress.com",
  },
  {
    file: "amex-thc-confirmation-cash",
    senderEmail: "AmericanExpress@welcome.americanexpress.com",
  },
  { file: "bookingcom-confirmation-cash", senderEmail: "noreply@booking.com" },
  { file: "chase-the-edit-confirmation-cash", senderEmail: "donotreply@chasetravel.com" },
  { file: "gha-confirmation-cash", senderEmail: "explore@email.ghadiscovery.com" },
];

const fixtureDir = resolve(__dirname, "../src/lib/email-ingestion/fixtures");

async function run() {
  for (const { file, senderEmail } of FIXTURES) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`Fixture: ${file}`);
    console.log(`Sender:  ${senderEmail} (domain: ${extractDomain(senderEmail)})`);

    const raw = readFileSync(resolve(fixtureDir, file), "utf-8");
    const body = await extractEmailBody(raw);
    const guide = getChainGuide(senderEmail);
    console.log(`Guide:   ${guide?.chainName ?? "(none)"}`);

    const emailText = decodeEmailToText(body);
    console.log(`Text length: ${emailText.length} chars`);
    console.log(`Text preview (first 300): ${emailText.slice(0, 300)}`);

    const result = await parseConfirmationEmail(body, guide);

    if (!result) {
      console.log("❌ FAILED");
    } else {
      console.log("✅ Parsed:");
      console.log(JSON.stringify(result, null, 2));
    }
  }
}

run().catch(console.error);
