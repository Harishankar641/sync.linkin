/**
 * Diagnostic probes for every external service SyncedIn depends on.
 *
 * Each probe returns a small structured result so the /admin/status page
 * can render a uniform table. Probes never throw — failures are captured
 * and returned as { ok: false, error }. Probes use real fixture inputs
 * (a known LinkedIn handle, a known X handle, etc.) so a successful
 * result means the integration is actually functioning end-to-end, not
 * just that credentials are set.
 *
 * Add a new probe by:
 *   1. Writing a function that returns Promise<ProbeResult>
 *   2. Wrapping the API call in measure() so timing + error capture is uniform
 *   3. Adding it to runAllProbes()
 */
import { exaGetContents } from "@/lib/exa";
import { anthropic, TWIN_MODEL } from "@/lib/anthropic";
import { createServiceClient } from "@/lib/supabase/server";

export type ProbeResult = {
  name: string;
  category: "scraper" | "llm" | "db" | "email" | "other";
  envVar?: string;
  configured: boolean;
  ok: boolean;
  skipped: boolean;
  latencyMs: number;
  sample?: string;
  error?: string;
};

async function measure(
  name: string,
  category: ProbeResult["category"],
  envVar: string | undefined,
  configured: boolean,
  fn: () => Promise<string>
): Promise<ProbeResult> {
  if (!configured) {
    return {
      name,
      category,
      envVar,
      configured: false,
      ok: false,
      skipped: true,
      latencyMs: 0
    };
  }
  const t0 = Date.now();
  try {
    const sample = await fn();
    return {
      name,
      category,
      envVar,
      configured: true,
      ok: true,
      skipped: false,
      latencyMs: Date.now() - t0,
      sample: sample.slice(0, 280)
    };
  } catch (e: any) {
    return {
      name,
      category,
      envVar,
      configured: true,
      ok: false,
      skipped: false,
      latencyMs: Date.now() - t0,
      error: String(e?.message ?? e).slice(0, 400)
    };
  }
}

// Fixture inputs. Pick stable, public-figure handles for the scrapers so a
// rate-limit on one doesn't look like an outage for the whole platform.
const FIXTURES = {
  linkedinHandle: "harqian", // Harrison Quian, the invite that surfaced the bug
  xHandle: "sama",           // Sam Altman, evergreen public account
  igHandle: "instagram",     // Instagram's own canonical profile
  exaUrl: "https://www.anthropic.com/news"
};

async function probeAnthropic(): Promise<ProbeResult> {
  // Historically named/labeled for Anthropic — lib/anthropic.ts is now a
  // multi-provider fallback chain (Gemini → Groq → OpenRouter → Mistral →
  // Cohere, see that file's header comment). "Configured" means at least
  // ONE provider has a key set, not specifically Gemini — a deploy that
  // only set GROQ_API_KEY is healthy, not broken.
  const anyProviderConfigured = [
    "GEMINI_API_KEY",
    "GROQ_API_KEY",
    "OPENROUTER_API_KEY",
    "MISTRAL_API_KEY",
    "COHERE_API_KEY"
  ].some((k) => !!process.env[k]);
  return measure("Anthropic", "llm", "GEMINI_API_KEY (or fallback)", anyProviderConfigured, async () => {
    const res = await anthropic.messages.create({
      model: TWIN_MODEL,
      max_tokens: 8,
      messages: [{ role: "user", content: "Reply with just: ok" }]
    });
    const text = (res.content[0] as any)?.text ?? "";
    return `model=${TWIN_MODEL} reply="${text}"`;
  });
}

async function probeExa(): Promise<ProbeResult> {
  return measure("Exa", "scraper", "EXA_API_KEY", !!process.env.EXA_API_KEY, async () => {
    const txt = await exaGetContents(FIXTURES.exaUrl);
    if (!txt || txt.length < 50) throw new Error(`thin payload (${txt.length} chars)`);
    return txt;
  });
}

async function probeScrapingDogLinkedIn(): Promise<ProbeResult> {
  const key = process.env.SCRAPINGDOG_API_KEY;
  return measure(
    "ScrapingDog · LinkedIn",
    "scraper",
    "SCRAPINGDOG_API_KEY",
    !!key,
    async () => {
      const url = `https://api.scrapingdog.com/linkedin?api_key=${encodeURIComponent(
        key!
      )}&type=profile&linkId=${encodeURIComponent(FIXTURES.linkedinHandle)}&premium=false`;
      const res = await fetch(url, { method: "GET" });
      const body = await res.text();
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
      }
      let parsed: any;
      try {
        parsed = JSON.parse(body);
      } catch {
        throw new Error(`non-JSON response: ${body.slice(0, 200)}`);
      }
      const p = Array.isArray(parsed) ? parsed[0] : parsed;
      const name =
        p?.fullName || p?.full_name || `${p?.first_name || ""} ${p?.last_name || ""}`.trim();
      const headline = p?.headline || p?.title;
      const hasSubstance = !!(name || headline || p?.about || p?.summary || p?.experience);
      if (!hasSubstance) {
        throw new Error(`empty profile for ${FIXTURES.linkedinHandle}: ${body.slice(0, 200)}`);
      }
      return `name="${name}" headline="${String(headline || "").slice(0, 120)}"`;
    }
  );
}

async function probeScrapingDogX(): Promise<ProbeResult> {
  const key = process.env.SCRAPINGDOG_API_KEY;
  return measure(
    "ScrapingDog · X",
    "scraper",
    "SCRAPINGDOG_API_KEY",
    !!key,
    async () => {
      const url = `https://api.scrapingdog.com/twitter/profile?api_key=${encodeURIComponent(
        key!
      )}&handle=${encodeURIComponent(FIXTURES.xHandle)}`;
      const res = await fetch(url, { method: "GET" });
      const body = await res.text();
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
      let parsed: any;
      try {
        parsed = JSON.parse(body);
      } catch {
        throw new Error(`non-JSON response: ${body.slice(0, 200)}`);
      }
      const p = Array.isArray(parsed) ? parsed[0] : parsed;
      const name = p?.name || p?.screen_name || p?.username;
      const bio = p?.description || p?.bio;
      if (!name && !bio) throw new Error(`empty profile: ${body.slice(0, 200)}`);
      return `@${FIXTURES.xHandle} name="${name || ""}" bio="${String(bio || "").slice(0, 100)}"`;
    }
  );
}

async function probeScrapingDogInstagram(): Promise<ProbeResult> {
  const key = process.env.SCRAPINGDOG_API_KEY;
  return measure(
    "ScrapingDog · Instagram",
    "scraper",
    "SCRAPINGDOG_API_KEY",
    !!key,
    async () => {
      const url = `https://api.scrapingdog.com/instagram/profile?api_key=${encodeURIComponent(
        key!
      )}&username=${encodeURIComponent(FIXTURES.igHandle)}`;
      const res = await fetch(url, { method: "GET" });
      const body = await res.text();
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
      let parsed: any;
      try {
        parsed = JSON.parse(body);
      } catch {
        throw new Error(`non-JSON response: ${body.slice(0, 200)}`);
      }
      // ScrapingDog wraps the profile in several possible keys. Probe a few.
      const p =
        parsed?.data ||
        parsed?.profile ||
        parsed?.user ||
        (Array.isArray(parsed) ? parsed[0] : parsed);
      const name = p?.full_name || p?.username;
      const bio = p?.biography || p?.bio;
      if (!name && !bio) throw new Error(`empty profile: ${body.slice(0, 200)}`);
      return `@${FIXTURES.igHandle} name="${name || ""}" bio="${String(bio || "").slice(0, 100)}"`;
    }
  );
}

async function probeApifyX(): Promise<ProbeResult> {
  const tok = process.env.APIFY_TOKEN;
  return measure("Apify · X", "scraper", "APIFY_TOKEN", !!tok, async () => {
    // run-sync-get-dataset-items against the X scraper actor. Tight limit
    // so we don't burn credits on a probe — 1 tweet is enough to confirm
    // the actor + token work.
    const url = `https://api.apify.com/v2/acts/apidojo~twitter-scraper-lite/run-sync-get-dataset-items?token=${encodeURIComponent(
      tok!
    )}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        startUrls: [`https://x.com/${FIXTURES.xHandle}`],
        maxItems: 1
      })
    });
    const body = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
    let arr: any[];
    try {
      arr = JSON.parse(body);
    } catch {
      throw new Error(`non-JSON: ${body.slice(0, 200)}`);
    }
    if (!Array.isArray(arr) || arr.length === 0) {
      throw new Error("0 items returned");
    }
    const first = arr[0];
    return `items=${arr.length} sample author=${first?.author?.userName || first?.user?.screen_name || "?"}`;
  });
}

async function probeApifyInstagram(): Promise<ProbeResult> {
  const tok = process.env.APIFY_TOKEN;
  return measure(
    "Apify · Instagram",
    "scraper",
    "APIFY_TOKEN",
    !!tok,
    async () => {
      const url = `https://api.apify.com/v2/acts/apify~instagram-profile-scraper/run-sync-get-dataset-items?token=${encodeURIComponent(
        tok!
      )}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ usernames: [FIXTURES.igHandle] })
      });
      const body = await res.text();
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
      let arr: any[];
      try {
        arr = JSON.parse(body);
      } catch {
        throw new Error(`non-JSON: ${body.slice(0, 200)}`);
      }
      if (!Array.isArray(arr) || arr.length === 0) {
        throw new Error("0 items returned");
      }
      const first = arr[0];
      return `items=${arr.length} sample @${first?.username || "?"} name="${first?.fullName || ""}"`;
    }
  );
}

async function probeSupabase(): Promise<ProbeResult> {
  return measure(
    "Supabase",
    "db",
    "SUPABASE_SERVICE_ROLE_KEY",
    !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    async () => {
      const service = createServiceClient();
      const { count, error } = await service
        .from("profiles")
        .select("id", { count: "exact", head: true });
      if (error) throw new Error(error.message);
      return `profiles.count=${count}`;
    }
  );
}

async function probeResend(): Promise<ProbeResult> {
  const key = process.env.RESEND_API_KEY;
  return measure("Resend", "email", "RESEND_API_KEY", !!key, async () => {
    const res = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${key}` }
    });
    const body = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
    let parsed: any;
    try {
      parsed = JSON.parse(body);
    } catch {
      throw new Error(`non-JSON: ${body.slice(0, 200)}`);
    }
    const domains = (parsed?.data ?? []) as any[];
    return `domains=${domains.length} ${domains
      .map((d) => `${d.name}:${d.status}`)
      .join(", ")
      .slice(0, 200)}`;
  });
}

async function probeInviteHealth(): Promise<ProbeResult> {
  // Read-only sanity check on the bulk-invite pipeline output: look at the
  // last 25 invites and report how many have a real outbound message
  // (signals the scrape + LLM step worked) vs how many fell back to the
  // generic template (signals the scrape failed silently).
  return measure(
    "Recent Invites",
    "other",
    undefined,
    true,
    async () => {
      const service = createServiceClient();
      const { data, error } = await service
        .from("pending_invites")
        .select("slug, outbound_message, person_highlights, created_at")
        .order("created_at", { ascending: false })
        .limit(25);
      if (error) throw new Error(error.message);
      const total = data?.length || 0;
      const withOutbound = (data || []).filter((r: any) => !!r.outbound_message).length;
      const withHighlights = (data || []).filter((r: any) => {
        const h = r.person_highlights;
        if (Array.isArray(h)) return h.length > 0;
        if (h && typeof h === "object") return Object.keys(h).length > 0;
        return false;
      }).length;
      return `last 25: outbound=${withOutbound}/${total}, with-scrape=${withHighlights}/${total}`;
    }
  );
}

export async function runAllProbes(): Promise<ProbeResult[]> {
  const probes = await Promise.all([
    probeSupabase(),
    probeAnthropic(),
    probeExa(),
    probeScrapingDogLinkedIn(),
    probeScrapingDogX(),
    probeScrapingDogInstagram(),
    probeApifyX(),
    probeApifyInstagram(),
    probeResend(),
    probeInviteHealth()
  ]);
  return probes;
}
