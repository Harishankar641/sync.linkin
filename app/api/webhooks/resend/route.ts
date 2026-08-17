import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Resend webhook receiver (#22 — email open/click tracking).
 *
 * Resend signs webhooks with Svix. We verify the signature using
 * RESEND_WEBHOOK_SECRET (the `whsec_...` value shown when you create the
 * webhook in the Resend dashboard), then log the event into email_events
 * so /admin/usage can compute real open / click / bounce rates.
 *
 * No send-site code changes needed: every event Resend reports is keyed
 * by its own message id + recipient.
 *
 * Setup (Jack — one time):
 *   1. Run supabase/migrations/0001_email_events.sql in the SQL editor.
 *   2. Resend → Webhooks → Add endpoint:
 *        URL = https://syncedin.org/api/webhooks/resend
 *        events = email.sent, email.delivered, email.opened,
 *                 email.clicked, email.bounced, email.complained
 *   3. Copy the signing secret (whsec_...) into Vercel env as
 *        RESEND_WEBHOOK_SECRET, then redeploy.
 *   4. Resend → Domains → enable Open + Click tracking on syncedin.org.
 */

export const dynamic = "force-dynamic";

const WEBHOOK_SECRET = process.env.RESEND_WEBHOOK_SECRET;

/**
 * Svix signature verification. The signed content is
 *   `${svix_id}.${svix_timestamp}.${rawBody}`
 * HMAC-SHA256'd with the base64-decoded secret (after the `whsec_`
 * prefix). The svix-signature header is a space-separated list of
 * `v1,<base64sig>` entries; we accept if ANY matches.
 */
function verifySvix(
  rawBody: string,
  headers: { id: string; timestamp: string; signature: string }
): boolean {
  if (!WEBHOOK_SECRET) return true; // dev / unconfigured — accept
  const secretBytes = Buffer.from(
    WEBHOOK_SECRET.replace(/^whsec_/, ""),
    "base64"
  );
  const signedContent = `${headers.id}.${headers.timestamp}.${rawBody}`;
  const expected = crypto
    .createHmac("sha256", secretBytes)
    .update(signedContent)
    .digest("base64");
  const provided = headers.signature
    .split(" ")
    .map((p) => p.split(",")[1])
    .filter(Boolean);
  return provided.some((sig) => {
    try {
      return crypto.timingSafeEqual(
        Buffer.from(sig),
        Buffer.from(expected)
      );
    } catch {
      return false;
    }
  });
}

export async function POST(req: Request) {
  const rawBody = await req.text();

  const id = req.headers.get("svix-id") ?? "";
  const timestamp = req.headers.get("svix-timestamp") ?? "";
  const signature = req.headers.get("svix-signature") ?? "";

  if (WEBHOOK_SECRET && !verifySvix(rawBody, { id, timestamp, signature })) {
    return NextResponse.json({ error: "bad_signature" }, { status: 401 });
  }

  let evt: any;
  try {
    evt = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const eventType: string = evt?.type ?? "unknown";
  const data = evt?.data ?? {};
  // Resend payloads: data.email_id, data.to (array or string), created_at.
  const providerMessageId: string | null = data.email_id ?? null;
  const toRaw = data.to ?? data.recipient ?? null;
  const emailAddress: string | null = Array.isArray(toRaw)
    ? toRaw[0] ?? null
    : typeof toRaw === "string"
    ? toRaw
    : null;
  const occurredAt: string =
    data.created_at ?? evt?.created_at ?? new Date().toISOString();

  try {
    const service = createServiceClient();
    // Upsert on (provider_message_id, event_type) so re-fired webhooks
    // don't inflate the counts.
    const { error } = await service
      .from("email_events")
      .upsert(
        {
          provider_message_id: providerMessageId,
          email_address: emailAddress,
          event_type: eventType,
          occurred_at: occurredAt,
          raw: evt
        },
        { onConflict: "provider_message_id,event_type" }
      );
    if (error) {
      // Fall back to a plain insert if the conflict target isn't present
      // (e.g. null message id rows the partial unique index ignores).
      await service.from("email_events").insert({
        provider_message_id: providerMessageId,
        email_address: emailAddress,
        event_type: eventType,
        occurred_at: occurredAt,
        raw: evt
      });
    }
  } catch (e) {
    console.error("[resend-webhook] log failed", e);
    // Still 200 so Resend doesn't hammer retries on a transient DB blip.
  }

  return NextResponse.json({ ok: true });
}
