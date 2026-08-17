/**
 * Server-only email send helper.
 *
 * Uses Resend when RESEND_API_KEY is set. If not configured, falls back to a
 * console.log so the app still runs in local dev without an API key.
 *
 * From-address: NOTIFICATION_FROM_EMAIL (default: "SyncedIn <notify@syncedin.org>")
 * The domain must be verified in Resend before sends succeed in production.
 *
 * Deliverability features wired in here (Jack: "I want to make sure that
 * how we're getting people's email will never go to the spam inbox"):
 *   - List-Unsubscribe + List-Unsubscribe-Post headers (Gmail Feb 2024
 *     requirement for bulk senders → one-click unsub from inbox UI)
 *   - Signed unsubscribe token per recipient + per category, no DB lookup
 *     needed to honor the click
 *   - Plain-text alternative (text param) alongside HTML so spam filters
 *     stop flagging as suspicious
 *   - reply_to defaults to a real human address so replies don't black-hole
 */

import crypto from "node:crypto";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL =
  process.env.NOTIFICATION_FROM_EMAIL || "SyncedIn <notify@syncedin.org>";
const APP_URL = (
  process.env.NEXT_PUBLIC_APP_URL || "https://syncedin.org"
).replace(/\/$/, "");
// Used to sign one-click unsubscribe tokens. Falls back to a dev string in
// local; in production this MUST be set or the token-validation will
// silently fail (and unsub links won't work). See app/api/email/unsubscribe.
const UNSUB_SECRET =
  process.env.NOTIFY_HMAC_SECRET || "dev-unsub-secret-do-not-ship";

/**
 * Build a HMAC-signed one-click unsubscribe URL. The token encodes
 * (user_id, category, exp). Verifier rejects if signature mismatches or
 * the URL is older than 30 days.
 */
export function buildUnsubUrl(opts: {
  userId: string;
  category?: string;
}): string {
  const { userId, category = "all" } = opts;
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30; // 30d
  const payload = `${userId}.${category}.${exp}`;
  const sig = crypto
    .createHmac("sha256", UNSUB_SECRET)
    .update(payload)
    .digest("hex")
    .slice(0, 32);
  const token = Buffer.from(`${payload}.${sig}`, "utf8").toString("base64url");
  return `${APP_URL}/api/email/unsubscribe?token=${token}`;
}

/** Verify an unsubscribe token. Returns { userId, category } or null. */
export function verifyUnsubToken(
  token: string
): { userId: string; category: string } | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const parts = decoded.split(".");
    if (parts.length !== 4) return null;
    const [userId, category, expStr, sig] = parts;
    const exp = parseInt(expStr, 10);
    if (!exp || exp < Math.floor(Date.now() / 1000)) return null;
    const expected = crypto
      .createHmac("sha256", UNSUB_SECRET)
      .update(`${userId}.${category}.${expStr}`)
      .digest("hex")
      .slice(0, 32);
    if (
      !crypto.timingSafeEqual(
        Buffer.from(sig, "hex"),
        Buffer.from(expected, "hex")
      )
    ) {
      return null;
    }
    return { userId, category };
  } catch {
    return null;
  }
}

export type SendEmailParams = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
  /**
   * If provided, wire List-Unsubscribe + List-Unsubscribe-Post headers so
   * Gmail / Outlook / Apple Mail surface a native one-click "Unsubscribe"
   * button in the inbox UI. Without these headers, bulk senders are
   * progressively rate-limited and eventually spam-foldered.
   */
  userId?: string;
  category?: string;
};

export type SendEmailResult =
  | { ok: true; id: string | null; skipped?: boolean }
  | { ok: false; error: string };

export async function sendEmail(
  params: SendEmailParams
): Promise<SendEmailResult> {
  const { to, subject, text, html, replyTo, userId, category } = params;
  if (!to || !subject || (!text && !html)) {
    return { ok: false, error: "missing_fields" };
  }

  if (!RESEND_API_KEY) {
    console.log(
      "[email] no RESEND_API_KEY — skipping send.",
      JSON.stringify({ to, subject, replyTo }, null, 0)
    );
    return { ok: true, id: null, skipped: true };
  }

  // Gmail Feb-2024 requires List-Unsubscribe AND List-Unsubscribe-Post
  // for senders >5k/day. We always include them when we have a userId
  // — the cost is one HMAC computation, the benefit is staying out of
  // the spam folder.
  const headers: Record<string, string> = {};
  if (userId) {
    const unsubUrl = buildUnsubUrl({ userId, category });
    headers["List-Unsubscribe"] = `<${unsubUrl}>, <mailto:unsubscribe@syncedin.org>`;
    headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [to],
        subject,
        text,
        html: html || undefined,
        reply_to: replyTo || "jacksonjezio@gmail.com",
        headers: Object.keys(headers).length > 0 ? headers : undefined
      })
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("[email] resend send failed", res.status, detail);
      return { ok: false, error: `resend_${res.status}` };
    }
    const j = (await res.json().catch(() => null)) as { id?: string } | null;
    return { ok: true, id: j?.id ?? null };
  } catch (e) {
    console.error("[email] resend send threw", e);
    return { ok: false, error: "network_error" };
  }
}

/**
 * Branded HTML email wrapper. Inline styles only (most email clients
 * strip <style> blocks). Table-based layout so Gmail + Outlook render
 * correctly.
 *
 * Cool extras (all optional, all email-client-safe):
 *  - Gradient hero band with the SyncedIn wordmark + tagline
 *  - Avatar-pair visual showing the connection ("you ↔ them") when
 *    avatar URLs are passed in
 *  - Sync % chip when available
 *  - Quoted message-preview block when there's a snippet to show
 *
 * Designed to make "SyncedIn just connected you with X" feel like a
 * real platform event, not a transactional notification.
 */
export function renderEmailHtml(opts: {
  preheader?: string;
  heading: string;
  body: string;
  ctaText?: string;
  ctaUrl?: string;
  footerNote?: string;
  // — NEW optional extras —
  // Small label above the heading, e.g. "NEW CONNECTION" / "PROPOSAL".
  kicker?: string;
  // Renders the iconic "two avatars + arc between" visual when both
  // URLs are passed. Mine = left (you), theirs = right (counterpart).
  heroAvatars?: { mine?: string | null; theirs?: string | null };
  // Pulled-out quote block — perfect for showing a message preview or
  // the proposed deal text.
  previewQuote?: string | null;
  // 0-100 sync score chip rendered next to the avatar pair when present.
  syncScore?: number | null;
}): string {
  const {
    preheader,
    heading,
    body,
    ctaText,
    ctaUrl,
    footerNote,
    kicker,
    heroAvatars,
    previewQuote,
    syncScore
  } = opts;
  const escaped = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  // Avatar pair — renders whenever we have AT LEAST one avatar OR the
  // initials needed for the missing side. Previously this hid the
  // whole pair if either side was missing, which meant new users (no
  // uploaded photo yet) got naked text emails. Now the missing side
  // falls back to a gradient initials circle so the visual still
  // lands.
  const initialsMine = (heroAvatars as any)?.mineInitials as
    | string
    | undefined;
  const initialsTheirs = (heroAvatars as any)?.theirsInitials as
    | string
    | undefined;
  const haveAnyAvatar =
    !!(heroAvatars?.mine || heroAvatars?.theirs);
  const renderAvatarCell = (
    url: string | null | undefined,
    initials: string | undefined,
    alt: string
  ) => {
    if (url) {
      return `<img src="${escaped(
        url
      )}" width="56" height="56" alt="${escaped(
        alt
      )}" style="display:block;width:56px;height:56px;border-radius:28px;border:2px solid #ffffff;object-fit:cover;background:#ffffff;" />`;
    }
    const safeInitials = escaped(
      ((initials || alt) ?? "?").trim().slice(0, 2).toUpperCase()
    );
    return `<div style="display:flex;align-items:center;justify-content:center;width:56px;height:56px;border-radius:28px;border:2px solid #ffffff;background:linear-gradient(135deg,#1f8bff 0%,#6b2dc9 60%,#d83bff 100%);color:#ffffff;font-weight:800;font-size:20px;line-height:56px;text-align:center;letter-spacing:-0.5px;">${safeInitials}</div>`;
  };
  const avatarPairHtml = haveAnyAvatar || initialsMine || initialsTheirs
    ? `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 18px auto;">
      <tr>
        <td style="padding:0 4px;">
          ${renderAvatarCell(
            heroAvatars?.mine ?? null,
            initialsMine,
            "you"
          )}
        </td>
        <td style="padding:0;vertical-align:middle;">
          <!--[if !mso]><!-->
          <svg xmlns="http://www.w3.org/2000/svg" width="56" height="40" viewBox="0 0 56 40" style="display:block;">
            <defs>
              <linearGradient id="syncedin-arc" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stop-color="#ffffff" stop-opacity="0.55"/>
                <stop offset="50%" stop-color="#ffd966" stop-opacity="0.95"/>
                <stop offset="100%" stop-color="#ffffff" stop-opacity="0.55"/>
              </linearGradient>
            </defs>
            <path d="M 4 20 Q 28 -4 52 20" fill="none" stroke="url(#syncedin-arc)" stroke-width="2" stroke-linecap="round"/>
            <circle cx="28" cy="8" r="2.4" fill="#ffd966"/>
          </svg>
          <!--<![endif]-->
        </td>
        <td style="padding:0 4px;">
          ${renderAvatarCell(
            heroAvatars?.theirs ?? null,
            initialsTheirs,
            "them"
          )}
        </td>
      </tr>
    </table>`
    : "";

  const syncChipHtml =
    typeof syncScore === "number" && syncScore >= 0 && syncScore <= 100
      ? `<div style="display:inline-block;margin:0 0 14px 0;padding:5px 12px;background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.25);border-radius:999px;font-size:11px;font-weight:800;letter-spacing:0.1em;color:#ffffff;text-transform:uppercase;">${syncScore}% sync</div>`
      : "";

  const previewQuoteHtml = previewQuote
    ? `
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:18px 0 4px 0;">
        <tr>
          <td style="border-left:3px solid #f59e0b;padding:10px 14px;background:rgba(245,158,11,0.06);border-radius:0 8px 8px 0;font-size:14px;line-height:1.6;color:#e7eaf0;font-style:italic;">
            ${escaped(previewQuote)}
          </td>
        </tr>
      </table>`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<!-- This email is DESIGNED dark. Opt OUT of automatic dark-mode color
     inversion (Gmail/Apple Mail) — that inversion was flipping the white
     hero heading to near-black while leaving the bright gradient behind
     it untouched, which is what made the "new match" email look broken.
     "only light" tells clients to render exactly as authored. -->
<meta name="color-scheme" content="only light">
<meta name="supported-color-schemes" content="only light">
<style>:root{color-scheme:only light;supported-color-schemes:only light;}</style>
</head>
<body style="margin:0;padding:0;background:#0b0f17;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#e7eaf0;color-scheme:only light;">
${preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;font-size:1px;color:#0b0f17;">${escaped(preheader)}</div>` : ""}
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#0b0f17;padding:24px 16px 32px 16px;">
  <tr><td align="center">

    <!-- BRAND BAR — small wordmark above the card so the email is
         immediately recognizable as SyncedIn in the preview pane. -->
    <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;margin:0 0 14px 0;">
      <tr><td align="left" style="padding:0 6px;">
        <a href="https://syncedin.org" style="text-decoration:none;color:inherit;display:inline-block;">
          <img src="https://syncedin.org/icons/icon-192.png" width="26" height="26" alt="SyncedIn" style="vertical-align:middle;border-radius:6px;margin-right:8px;display:inline-block;" />
          <span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:18px;font-weight:800;letter-spacing:-0.01em;color:#ffffff;vertical-align:middle;">Synced</span><span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:18px;font-weight:800;letter-spacing:-0.01em;color:#a5b4fc;vertical-align:middle;">In</span>
        </a>
      </td></tr>
    </table>

    <!-- MAIN CARD: gradient hero band stacked above a dark body card -->
    <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;background:#121826;border:1px solid #1f2937;border-radius:16px;overflow:hidden;">

      <!-- HERO BAND -->
      <tr>
        <td align="center" style="padding:32px 28px 28px 28px;background:#6366f1;background-image:linear-gradient(135deg,#6366f1 0%,#7c5cf0 55%,#8b5cf6 100%);">
          ${avatarPairHtml}
          ${syncChipHtml}
          ${
            kicker
              ? `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:11px;font-weight:800;letter-spacing:0.18em;color:rgba(255,255,255,0.85);text-transform:uppercase;margin:0 0 10px 0;">${escaped(kicker)}</div>`
              : ""
          }
          <h1 style="margin:0;font-size:24px;font-weight:800;color:#ffffff;line-height:1.25;letter-spacing:-0.01em;text-shadow:0 1px 6px rgba(0,0,0,0.35);">${escaped(heading)}</h1>
        </td>
      </tr>

      <!-- BODY -->
      <tr>
        <td style="padding:24px 28px 28px 28px;">
          <div style="font-size:15px;line-height:1.65;color:#d6dae5;">${body}</div>
          ${previewQuoteHtml}
          ${
            ctaText && ctaUrl
              ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 4px 0;"><tr><td style="border-radius:12px;background:#6366f1;background-image:linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%);">
                  <a href="${escaped(ctaUrl)}" style="display:inline-block;padding:14px 26px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;font-weight:800;color:#ffffff;text-decoration:none;border-radius:12px;letter-spacing:-0.005em;">${escaped(ctaText)} →</a>
                </td></tr></table>`
              : ""
          }
          ${
            footerNote
              ? `<div style="margin-top:22px;padding-top:16px;border-top:1px solid #1f2937;font-size:12px;color:#7c8499;line-height:1.55;">${footerNote}</div>`
              : ""
          }
        </td>
      </tr>
    </table>

    <!-- FOOTER — accent line + brand links. The 1px gradient line is
         a subtle nod to the brand without screaming. -->
    <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;margin:18px 0 0 0;">
      <tr><td align="center" style="padding:0 0 8px 0;">
        <div style="display:inline-block;width:120px;height:2px;background:#1f59ff;background-image:linear-gradient(90deg,#1f59ff 0%,#6b2dc9 50%,#f59e0b 100%);border-radius:2px;opacity:0.6;"></div>
      </td></tr>
      <tr><td align="center" style="padding-top:8px;font-size:11px;color:#6b7280;line-height:1.6;">
        <a href="https://syncedin.org/settings/notifications" style="color:#7c8499;text-decoration:none;">notification settings</a>
        &nbsp;·&nbsp;
        <a href="https://syncedin.org" style="color:#7c8499;text-decoration:none;">syncedin.org</a>
        <div style="margin-top:6px;color:#52596d;font-size:10px;letter-spacing:0.04em;">the AI relationship layer</div>
      </td></tr>
    </table>

  </td></tr>
</table>
</body></html>`;
}
