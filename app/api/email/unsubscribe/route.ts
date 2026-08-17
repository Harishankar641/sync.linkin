import { NextResponse } from "next/server";
import { verifyUnsubToken } from "@/lib/email";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * One-click unsubscribe handler. Honors BOTH:
 *   - HTTP POST from "List-Unsubscribe-Post: List-Unsubscribe=One-Click"
 *     (Gmail / Outlook / Apple Mail call this directly from the inbox UI)
 *   - HTTP GET from the unsubscribe link in the email footer (user clicks
 *     the link manually)
 *
 * Token decoding via lib/email.ts verifyUnsubToken — signed HMAC, 30-day
 * expiry, no DB lookup needed to honor the click. The DB write happens
 * AFTER verification: flip the matching notification_preferences column
 * (or all columns when category=all) to false.
 *
 * Returns HTML page on GET (so the user sees confirmation), JSON on POST
 * (per the One-Click spec — mail clients just need a 200).
 */
async function processUnsub(token: string): Promise<{
  ok: boolean;
  category?: string;
  email?: string | null;
  reason?: string;
}> {
  const parsed = verifyUnsubToken(token);
  if (!parsed) return { ok: false, reason: "invalid_or_expired_token" };
  const { userId, category } = parsed;

  const service = createServiceClient();

  // Find the row in notification_preferences (or create one).
  const { data: existing } = await service
    .from("notification_preferences")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  // Map category → column flips. "all" turns off everything. Column
  // names mirror the existing notification_preferences schema:
  // on_new_message / on_new_connection / on_agreement_accepted /
  // on_call_scheduled / on_new_match + the new on_weekly_digest.
  const off: Record<string, boolean> =
    category === "all"
      ? {
          on_new_message: false,
          on_new_connection: false,
          on_agreement_accepted: false,
          on_call_scheduled: false,
          on_new_match: false,
          on_weekly_digest: false
        }
      : category === "new_message"
        ? { on_new_message: false }
        : category === "new_connection"
          ? { on_new_connection: false }
          : category === "agreement_accepted" ||
              category === "new_proposal"
            ? { on_agreement_accepted: false }
            : category === "new_match"
              ? { on_new_match: false }
              : category === "weekly_digest"
                ? { on_weekly_digest: false }
                : { on_new_message: false };

  if (existing) {
    await service
      .from("notification_preferences")
      .update(off)
      .eq("user_id", userId);
  } else {
    await service.from("notification_preferences").insert({ user_id: userId, ...off });
  }

  // Look up the email for the confirmation page (best-effort).
  let email: string | null = null;
  try {
    const { data: p } = await service
      .from("profiles")
      .select("email")
      .eq("id", userId)
      .maybeSingle();
    email = ((p as any)?.email as string) ?? null;
  } catch {
    /* don't care */
  }

  return { ok: true, category, email };
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") || "";
  const result = await processUnsub(token);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, reason: result.reason },
      { status: 400 }
    );
  }
  return NextResponse.json({ ok: true, category: result.category });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") || "";
  const result = await processUnsub(token);

  const successHtml = `<!doctype html><html><head><title>Unsubscribed · SyncedIn</title><meta name="viewport" content="width=device-width,initial-scale=1"/></head><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f7f7ff;color:#0b0f17;margin:0;padding:48px 20px;min-height:100vh;">
<div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:18px;padding:32px;text-align:center;box-shadow:0 14px 34px -16px rgba(15,23,42,0.18);">
  <div style="font-size:11px;font-weight:800;letter-spacing:0.14em;color:#1f59ff;text-transform:uppercase;margin-bottom:14px;">syncedin</div>
  <div style="font-size:48px;margin-bottom:14px;">📭</div>
  <h1 style="font-size:24px;font-weight:900;letter-spacing:-0.015em;margin:0 0 10px 0;">You're unsubscribed.</h1>
  <p style="font-size:15px;line-height:1.55;color:#475569;margin:0 0 22px 0;">
    ${
      result.category === "all"
        ? "We won't email you anymore."
        : `We won't send you <code style="background:#f3f4f6;padding:2px 6px;border-radius:4px;font-size:13px;">${result.category ?? "those"}</code> notifications anymore.`
    }
    ${result.email ? `<br/><span style="font-size:13px;color:#6b7280;">(${result.email})</span>` : ""}
  </p>
  <p style="font-size:13px;color:#6b7280;margin:0 0 22px 0;line-height:1.5;">
    Change your mind later in <a href="https://syncedin.org/settings/notifications" style="color:#1f59ff;text-decoration:none;font-weight:700;">notification settings</a>.
  </p>
  <a href="https://syncedin.org" style="display:inline-block;padding:12px 22px;background:#1f59ff;color:#ffffff;font-weight:800;border-radius:12px;text-decoration:none;font-size:14px;">← Back to SyncedIn</a>
</div>
</body></html>`;

  const failHtml = `<!doctype html><html><head><title>Link expired · SyncedIn</title><meta name="viewport" content="width=device-width,initial-scale=1"/></head><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f7f7ff;color:#0b0f17;margin:0;padding:48px 20px;min-height:100vh;">
<div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:18px;padding:32px;text-align:center;">
  <div style="font-size:48px;margin-bottom:14px;">⌛</div>
  <h1 style="font-size:22px;font-weight:800;margin:0 0 10px 0;">That link expired.</h1>
  <p style="font-size:14px;line-height:1.55;color:#475569;margin:0 0 22px 0;">
    Unsubscribe links are valid for 30 days. Update your preferences directly in
    <a href="https://syncedin.org/settings/notifications" style="color:#1f59ff;font-weight:700;">notification settings</a>.
  </p>
</div>
</body></html>`;

  return new Response(result.ok ? successHtml : failHtml, {
    status: result.ok ? 200 : 400,
    headers: { "content-type": "text/html; charset=utf-8" }
  });
}
