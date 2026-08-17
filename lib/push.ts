import { createServiceClient } from "@/lib/supabase/server";
import { createSign } from "crypto";
import * as http2 from "http2";

/**
 * Push dispatch, governed by the NO-SPAM POLICY (Jack: "we don't want
 * to spam"):
 *
 *  - Exactly TWO events push, both deal moments:
 *      push_accept_nudge  → counterpart accepted, one tap to seal
 *      push_sealed        → both sides accepted, deal is real
 *  - Hard dedupe: one push per (event, conversation, recipient), EVER,
 *    via notification_log's unique (user_id, dedupe_key).
 *  - Hard cap: max 3 pushes per user per rolling 24h.
 *  - Everything else (new messages, digests, reminders) stays on email
 *    and in-app red dots. Adding a push event is a deliberate decision,
 *    not a default.
 *
 * Transport:
 *  - iOS    → APNs directly over HTTP/2 (node:http2 + ES256 JWT). No
 *             Firebase pods in the iOS app. Needs APNS_AUTH_KEY_P8 +
 *             APNS_KEY_ID (+ optional APNS_TEAM_ID, defaults to the
 *             known team).
 *  - Android→ FCM HTTP v1 (RS256 service-account JWT → OAuth token).
 *             Needs FIREBASE_SERVICE_ACCOUNT_JSON.
 *
 * Missing env = that platform silently no-ops. Dead tokens are pruned
 * on provider rejection. Never throws to callers.
 */

export type PushEvent = "push_accept_nudge" | "push_sealed";

const DAILY_CAP = 3;
const APNS_TOPIC = "org.syncedin.app";
const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
  "https://syncedin.org";

function b64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/* ----------------------------- APNs (iOS) ----------------------------- */

let apnsJwtCache: { jwt: string; iat: number } | null = null;

function apnsJwt(): string | null {
  const p8 = process.env.APNS_AUTH_KEY_P8;
  const kid = process.env.APNS_KEY_ID;
  const iss = process.env.APNS_TEAM_ID || "XCUTNS56DG";
  if (!p8 || !kid) return null;
  const now = Math.floor(Date.now() / 1000);
  // APNs rejects tokens older than 60 min; refresh at 45.
  if (apnsJwtCache && now - apnsJwtCache.iat < 45 * 60) {
    return apnsJwtCache.jwt;
  }
  const header = b64url(JSON.stringify({ alg: "ES256", kid }));
  const payload = b64url(JSON.stringify({ iss, iat: now }));
  const signer = createSign("SHA256");
  signer.update(`${header}.${payload}`);
  // ES256 for APNs wants the IEEE P1363 (r||s) signature format.
  const sig = signer.sign(
    { key: p8.replace(/\\n/g, "\n"), dsaEncoding: "ieee-p1363" },
    "base64"
  );
  const jwt = `${header}.${payload}.${sig
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")}`;
  apnsJwtCache = { jwt, iat: now };
  return jwt;
}

function sendApns(
  deviceToken: string,
  title: string,
  body: string,
  url: string
): Promise<"ok" | "dead" | "fail"> {
  return new Promise((resolve) => {
    const jwt = apnsJwt();
    if (!jwt) return resolve("fail");
    let settled = false;
    const finish = (v: "ok" | "dead" | "fail") => {
      if (!settled) {
        settled = true;
        try {
          client.close();
        } catch {
          /* already closed */
        }
        resolve(v);
      }
    };
    const client = http2.connect("https://api.push.apple.com");
    client.on("error", () => finish("fail"));
    const timer = setTimeout(() => finish("fail"), 10_000);
    const req = client.request({
      ":method": "POST",
      ":path": `/3/device/${deviceToken}`,
      authorization: `bearer ${jwt}`,
      "apns-topic": APNS_TOPIC,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "content-type": "application/json"
    });
    let status = 0;
    req.on("response", (headers) => {
      status = Number(headers[":status"] ?? 0);
    });
    req.setEncoding("utf8");
    req.on("data", () => {
      /* drain */
    });
    req.on("end", () => {
      clearTimeout(timer);
      if (status === 200) return finish("ok");
      // 410 Unregistered / 400 BadDeviceToken → prune.
      if (status === 410 || status === 400) return finish("dead");
      finish("fail");
    });
    req.on("error", () => {
      clearTimeout(timer);
      finish("fail");
    });
    req.end(
      JSON.stringify({
        aps: {
          alert: { title, body },
          sound: "default",
          badge: 1
        },
        url
      })
    );
  });
}

/* ----------------------------- FCM (Android) ----------------------------- */

let fcmTokenCache: { token: string; exp: number } | null = null;

type ServiceAccount = {
  project_id: string;
  client_email: string;
  private_key: string;
  token_uri?: string;
};

function fcmServiceAccount(): ServiceAccount | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    const sa = JSON.parse(raw) as ServiceAccount;
    if (!sa.project_id || !sa.client_email || !sa.private_key) return null;
    return sa;
  } catch {
    return null;
  }
}

async function fcmAccessToken(sa: ServiceAccount): Promise<string | null> {
  const now = Math.floor(Date.now() / 1000);
  if (fcmTokenCache && now < fcmTokenCache.exp - 120) {
    return fcmTokenCache.token;
  }
  const tokenUri = sa.token_uri || "https://oauth2.googleapis.com/token";
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: tokenUri,
      iat: now,
      exp: now + 3600
    })
  );
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${payload}`);
  const sig = signer.sign(sa.private_key.replace(/\\n/g, "\n"), "base64");
  const assertion = `${header}.${payload}.${sig
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")}`;
  try {
    const res = await fetch(tokenUri, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: `grant_type=${encodeURIComponent(
        "urn:ietf:params:oauth:grant-type:jwt-bearer"
      )}&assertion=${encodeURIComponent(assertion)}`
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!j.access_token) return null;
    fcmTokenCache = {
      token: j.access_token,
      exp: now + (j.expires_in ?? 3600)
    };
    return j.access_token;
  } catch {
    return null;
  }
}

async function sendFcm(
  deviceToken: string,
  title: string,
  body: string,
  url: string
): Promise<"ok" | "dead" | "fail"> {
  const sa = fcmServiceAccount();
  if (!sa) return "fail";
  const access = await fcmAccessToken(sa);
  if (!access) return "fail";
  try {
    const res = await fetch(
      `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${access}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          message: {
            token: deviceToken,
            notification: { title, body },
            data: { url },
            android: {
              priority: "HIGH",
              notification: { sound: "default" }
            }
          }
        })
      }
    );
    if (res.ok) return "ok";
    const text = await res.text().catch(() => "");
    if (res.status === 404 || /UNREGISTERED|NOT_FOUND/i.test(text)) {
      return "dead";
    }
    return "fail";
  } catch {
    return "fail";
  }
}

/* ----------------------------- dispatcher ----------------------------- */

export async function sendPushToUser(
  userId: string,
  conversationId: string,
  event: PushEvent,
  title: string,
  body: string
): Promise<void> {
  try {
    const iosReady = !!(process.env.APNS_AUTH_KEY_P8 && process.env.APNS_KEY_ID);
    const androidReady = !!process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!iosReady && !androidReady) return; // push not configured yet

    const service = createServiceClient();

    // Cap: max 3 pushes per rolling 24h per user.
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await service
      .from("notification_log")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .like("kind", "push_%")
      .gte("sent_at", since);
    if ((count ?? 0) >= DAILY_CAP) return;

    // Dedupe: one push per (event, conversation, recipient), ever.
    const { error: logErr } = await service.from("notification_log").insert({
      user_id: userId,
      kind: event,
      subject_id: conversationId,
      dedupe_key: `${event}:${conversationId}:${userId}`,
      email_address: "push"
    });
    if (logErr) return; // duplicate → already pushed

    const { data: tokens } = await service
      .from("push_tokens")
      .select("token, platform")
      .eq("user_id", userId);
    const rows = (tokens ?? []) as Array<{
      token: string;
      platform: "ios" | "android";
    }>;
    if (rows.length === 0) return;

    const url = `${APP_URL}/conversations/${conversationId}`;
    await Promise.all(
      rows.map(async (t) => {
        const result =
          t.platform === "ios"
            ? iosReady
              ? await sendApns(t.token, title, body, url)
              : "fail"
            : androidReady
              ? await sendFcm(t.token, title, body, url)
              : "fail";
        if (result === "dead") {
          await service.from("push_tokens").delete().eq("token", t.token);
        }
      })
    );
  } catch (e) {
    console.warn("[push] send failed", e);
  }
}
