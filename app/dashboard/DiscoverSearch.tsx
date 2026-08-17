"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { startConversationWithUser } from "./actions";
import { DotsLoader } from "../DotsLoader";

/**
 * Deterministic "cool default avatar" generator for directory rows
 * where the user hasn't uploaded a photo. Hashes the user id into a
 * 2-stop gradient pulled from the same palette family the SyncMeter
 * uses, then overlays the user's initials. Same user always gets the
 * same avatar — feels intentional, not random.
 */
const AVATAR_PALETTES: [string, string][] = [
  ["#1f8bff", "#6b2dc9"], // signature blue → purple
  ["#ff7849", "#d83bff"], // coral → magenta
  ["#22c55e", "#0ea5e9"], // green → sky
  ["#f59e0b", "#ef4444"], // amber → red
  ["#a855f7", "#ec4899"], // violet → pink
  ["#0ea5e9", "#22d3ee"], // sky → cyan
  ["#7c3aed", "#2563eb"], // indigo
  ["#10b981", "#84cc16"]  // emerald → lime
];

function paletteFor(id: string): [string, string] {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTES[h % AVATAR_PALETTES.length];
}

function initialsOf(name: string | null, email: string): string {
  const src = (name || email || "").trim();
  if (!src) return "??";
  const parts = src.split(/[\s@.]+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return src.slice(0, 2).toUpperCase();
}

function DirectoryAvatar({
  id,
  displayName,
  email,
  avatarUrl,
  size = 40
}: {
  id: string;
  displayName: string | null;
  email: string;
  avatarUrl?: string | null;
  size?: number;
}) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt=""
        width={size}
        height={size}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          objectFit: "cover",
          flexShrink: 0
        }}
      />
    );
  }
  const [a, b] = paletteFor(id);
  const initials = initialsOf(displayName, email);
  return (
    <div
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        background: `linear-gradient(135deg, ${a} 0%, ${b} 100%)`,
        color: "#ffffff",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 800,
        fontSize: size * 0.4,
        letterSpacing: "0.02em",
        flexShrink: 0,
        boxShadow: `0 4px 14px -4px ${a}55`
      }}
    >
      {initials}
    </div>
  );
}

const DISMISSED_KEY = "syncedin.directoryDismissed";

function loadDismissed(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(DISMISSED_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function saveDismissed(s: Set<string>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DISMISSED_KEY, JSON.stringify(Array.from(s)));
  } catch {
    /* ignore quota */
  }
}

type DirectoryUser = {
  id: string;
  display_name: string | null;
  email: string;
  goals: string | null;
  /** First substantive line from ai_export_blob when goals is stale. */
  headline_fallback?: string;
  /** 0-100 token-overlap score with the current user's twin. */
  connection_score?: number;
  avatar_url?: string | null;
  /** Signup timestamp in ms. Used to render a "NEW" pill on rows
   *  created within the last 14 days. */
  created_at_ms?: number;
};
type ExaPerson = { title: string; url: string; highlights: string[] };
type FindResponse = {
  sync_users: { id: string; display_name: string | null; email: string | null }[];
  exa_people: ExaPerson[];
};

const isEmail = (s: string) => /\S+@\S+\.\S+/.test(s);

/**
 * Heuristic for detecting placeholder / in-progress / clearly-not-a-bio
 * goals strings so we don't ship cringey card text like "Trying to get
 * through the sign up page" once a user has actually finished setup.
 *
 * Returns true if the string is OK to display.
 */
function looksLikeRealBio(s: string | null | undefined): boolean {
  if (!s) return false;
  const t = s.trim();
  if (t.length < 15) return false;
  // Common placeholder/draft markers — case-insensitive.
  if (
    /^(trying|testing|test\b|asdf|qwert|placeholder|tbd|wip|in progress|getting through|getting started|just signed up|signing up|setting up|setup|onboarding|loading|todo|coming soon|fill .* later|update .* later)/i.test(
      t
    )
  )
    return false;
  // Obvious self-references to the platform's own UI.
  if (/sign\s*up\s*page|sign\s*in\s*page|onboarding\s*page|magic\s*link/i.test(t))
    return false;
  // Pure punctuation / repetition / single-word filler.
  if (!/[A-Za-z]/.test(t)) return false;
  if (/^(.)\1+$/.test(t)) return false;
  return true;
}

/**
 * Top-of-dashboard Discover.
 * - Empty input → renders the existing-user directory (finished twins).
 * - Typed input → searches SyncedIn AND the open web (Exa) via
 *   /api/find-counterpart. Existing users get "Open" → start conversation.
 *   Web matches get "Draft invite" → your twin writes the outreach.
 */
export function DiscoverSearch({
  directory
}: {
  directory: DirectoryUser[];
}) {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<FindResponse>({
    sync_users: [],
    exa_people: []
  });
  /**
   * Per-person draft state. The Discover panel previously held ONE
   * `draftFor` / `draftText` / `shortText` / `inviteUrl` state at a time,
   * which meant clicking "Draft invite" on a second person silently
   * cancelled the first person's drafts. The user wants to be able to
   * have multiple drafts in flight at once and tab between them — so we
   * key everything by person.url.
   */
  type DraftState = {
    draftText: string;
    shortText: string;
    inviteUrl: string;
    generating: boolean;
  };
  const [drafts, setDrafts] = useState<Map<string, DraftState>>(new Map());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  function getDraft(url: string): DraftState | undefined {
    return drafts.get(url);
  }
  function setDraft(url: string, patch: Partial<DraftState>) {
    setDrafts((prev) => {
      const next = new Map(prev);
      const current =
        prev.get(url) ?? {
          draftText: "",
          shortText: "",
          inviteUrl: "",
          generating: false
        };
      next.set(url, { ...current, ...patch });
      return next;
    });
  }

  function toggleExpand(url: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  }

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    if (!q.trim()) {
      setResults({ sync_users: [], exa_people: [] });
      return;
    }
    setLoading(true);
    debounce.current = setTimeout(async () => {
      try {
        const r = await fetch("/api/find-counterpart", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ query: q.trim() })
        });
        const j = (await r.json()) as FindResponse;
        setResults({
          sync_users: j.sync_users ?? [],
          exa_people: j.exa_people ?? []
        });
      } catch {
        setResults({ sync_users: [], exa_people: [] });
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [q]);

  async function draftOutreach(p: ExaPerson) {
    // Seed the draft state for THIS person without disturbing any other
    // in-flight draft. The LinkedIn connection note no longer needs the
    // invite URL inline (LinkedIn flags notes containing URLs as spam +
    // the URL goes in the follow-up DM after connection accept anyway).
    setDraft(p.url, {
      draftText: "",
      shortText: "",
      inviteUrl: "",
      generating: true
    });
    try {
      const r = await fetch("/api/exa-draft-outreach", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          person_title: p.title,
          person_url: p.url,
          highlights: p.highlights
        })
      });
      const j = await r.json();
      const url = (j.invite_url ?? "") as string;
      let short = (j.short_message ?? "") as string;
      // LinkedIn caps free-tier connection notes at 200 characters. Hard
      // truncate so the copy-to-clipboard text is paste-safe everywhere.
      if (short.length > 200) {
        short = short.slice(0, 197).trimEnd() + "…";
      }
      setDraft(p.url, {
        draftText: j.message ?? "",
        shortText: short,
        inviteUrl: url,
        generating: false
      });
    } catch {
      setDraft(p.url, { generating: false });
    }
  }

  const copy = (text: string) => navigator.clipboard?.writeText(text);
  const searching = q.trim().length > 0;

  /**
   * Open the recipient's LinkedIn profile in a new tab with the
   * connection note copied to clipboard. LinkedIn deliberately doesn't
   * expose a public URL scheme that pre-fills the connect-with-note
   * modal (would be too easy to abuse), so the best we can do is:
   *   1. Copy the note to clipboard.
   *   2. Open the profile so the user clicks Connect → Add a note → Paste.
   * That's still a single keyboard shortcut for the actual send.
   */
  function openLinkedInWithNote(profileUrl: string, note: string) {
    if (!profileUrl) return;
    try {
      navigator.clipboard?.writeText(note);
    } catch {
      /* clipboard may be blocked — user can still paste their last copy */
    }
    window.open(profileUrl, "_blank", "noopener,noreferrer");
  }
  const isLinkedInUrl = (url: string) =>
    /linkedin\.com\/(?:in|pub)\//i.test(url || "");

  // Twin-suggested connections.
  type Suggestion = {
    rationale: string;
    search_query: string;
    people: ExaPerson[];
  };
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [intent, setIntent] = useState("");
  const [lastIntent, setLastIntent] = useState("");
  // Locally-persisted set of user IDs the viewer has dismissed from the
  // "already on SyncedIn" directory. Stored in localStorage so dismissals
  // stay hidden across page loads without needing a server table.
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  useEffect(() => {
    setDismissed(loadDismissed());
  }, []);
  function dismissUser(id: string) {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(id);
      saveDismissed(next);
      return next;
    });
  }

  // Cycling placeholder examples — rotate every ~3s so users see different
  // ways to use the freeform intent box.
  const SAMPLE_INTENTS = [
    "founders building in fintech right now",
    "investors who back AI music platforms",
    "biotech CEOs with humanitarian focus",
    "engineers shipping agentic infra",
    "operators in vertical SaaS",
    "writers covering the AI agent space",
    "lawyers who advise on token launches",
    "people building knowledge graphs",
    "product designers obsessed with retro UI"
  ];
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  useEffect(() => {
    if (intent.trim()) return; // freeze rotation if user is typing
    const t = setInterval(
      () => setPlaceholderIdx((i) => (i + 1) % SAMPLE_INTENTS.length),
      3000
    );
    return () => clearInterval(t);
  }, [intent]);

  // localStorage cache so Find People doesn't re-burn an Exa call every
  // time the user lands on the dashboard. 60-min TTL: long enough that
  // they get instant paint on repeat visits, short enough that new
  // signups feed back into the suggestions on the same day.
  const FIND_CACHE_KEY = "syncedin.findPeople.v1";
  const FIND_TTL_MS = 60 * 60 * 1000;

  async function askTwin(useIntent: string, useCache = false) {
    setSuggesting(true);
    setLastIntent(useIntent);
    // Cache check (only for the empty-intent auto-load case — if the
    // user typed a specific intent we always hit the server fresh).
    if (useCache && !useIntent) {
      try {
        const raw = localStorage.getItem(FIND_CACHE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as {
            at: number;
            suggestions: Suggestion[];
          };
          if (
            parsed &&
            Date.now() - parsed.at < FIND_TTL_MS &&
            Array.isArray(parsed.suggestions)
          ) {
            setSuggestions(parsed.suggestions);
            setSuggesting(false);
            return;
          }
        }
      } catch {
        /* corrupt cache — fall through and refetch */
      }
    }
    try {
      const r = await fetch("/api/twin-suggest-connections", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(useIntent ? { intent: useIntent } : {})
      });
      const j = await r.json();
      const fresh = j.suggestions ?? [];
      setSuggestions(fresh);
      // Only cache the no-intent default suggestions — intent-specific
      // queries are too varied to keep around.
      if (!useIntent) {
        try {
          localStorage.setItem(
            FIND_CACHE_KEY,
            JSON.stringify({ at: Date.now(), suggestions: fresh })
          );
        } catch {
          /* storage full or disabled — non-fatal */
        }
      }
    } catch {
      setSuggestions([]);
    } finally {
      setSuggesting(false);
    }
  }

  // Auto-fire Find People the first time the dashboard mounts so the
  // user lands on a populated set of suggestions — the primary CTA we
  // want them clicking. Skip if suggestions already loaded (HMR reload)
  // or the user is actively searching by name.
  const autoFired = useRef(false);
  useEffect(() => {
    if (autoFired.current) return;
    if (suggestions !== null) return;
    if (searching) return;
    autoFired.current = true;
    askTwin("", true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section>
      <div className="flex items-baseline justify-between">
        <div className="retro-label">discover</div>
        <div className="retro-dim text-xs">
          {searching ? "searching SyncedIn + web…" : `${directory.length} ready to sync`}
        </div>
      </div>

      <div className="mt-3 relative">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name. Find them on SyncedIn or anywhere on the web."
          className="retro-input"
          style={{ paddingRight: q ? 80 : 16 }}
        />
        {q && (
          <button
            type="button"
            onClick={() => setQ("")}
            className="retro-dim hover:text-white"
            style={{
              position: "absolute",
              right: 8,
              top: "50%",
              transform: "translateY(-50%)",
              fontSize: 12,
              padding: "4px 10px",
              borderRadius: 6,
              border: "1px solid var(--border-bright)",
              background: "var(--panel-2)"
            }}
          >
            × clear
          </button>
        )}
      </div>

      {/* Platform-users directory — Jack's call: ALREADY-ON-SYNCEDIN users
          render ABOVE the Find People (Exa) block. They're a higher-value
          surface (zero invite friction) so they get top placement, even
          before the "your twin says" recommendations. Each row shows the
          connection score on the right. */}
      {!searching && (() => {
        const visible = directory.filter((p) => !dismissed.has(p.id));
        if (visible.length === 0) return null;
        return (
          <div className="mt-4">
            <div className="flex items-baseline justify-between">
              <div
                className="retro-label"
                style={{ color: "var(--amber-bright)" }}
              >
                already on SyncedIn
              </div>
              <div className="retro-dim text-xs">
                {visible.length} {visible.length === 1 ? "twin" : "twins"} you
                haven&apos;t talked to yet
              </div>
            </div>
            <div className="mt-3 space-y-2">
              {visible.slice(0, 12).map((p) => {
                const blurb =
                  (looksLikeRealBio(p.goals) ? p.goals : null) ||
                  p.headline_fallback ||
                  "";
                const score = p.connection_score ?? 0;
                const scoreColor =
                  score >= 50
                    ? "var(--amber-bright)"
                    : score >= 25
                      ? "var(--text)"
                      : "var(--text-dim)";
                return (
                  <form
                    action={startConversationWithUser}
                    key={p.id}
                    className="retro-panel retro-panel-hover p-4 flex items-start gap-3"
                    style={{ position: "relative" }}
                  >
                    {/* Avatar — uploaded photo if available, otherwise a
                        deterministic 2-stop gradient circle with initials.
                        Same user always renders to the same gradient. */}
                    <DirectoryAvatar
                      id={p.id}
                      displayName={p.display_name}
                      email={p.email}
                      avatarUrl={p.avatar_url}
                      size={44}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-sm flex items-center gap-2 flex-wrap">
                        <span>{p.display_name || p.email}</span>
                        {/* NEW pill — surfaces signups from the last 14
                            days so the user knows who's actively building
                            their twin RIGHT NOW. Jack: "move those new
                            people up top." */}
                        {p.created_at_ms &&
                          Date.now() - p.created_at_ms <
                            14 * 86_400_000 && (
                            <span
                              style={{
                                fontSize: 9,
                                fontWeight: 800,
                                letterSpacing: "0.1em",
                                padding: "2px 6px",
                                borderRadius: 999,
                                background: "var(--amber-bright)",
                                color: "#000",
                                textTransform: "uppercase"
                              }}
                            >
                              new
                            </span>
                          )}
                      </div>
                      {blurb && (
                        <div className="retro-dim text-xs mt-1 line-clamp-2">
                          {blurb}
                        </div>
                      )}
                    </div>
                    <input type="hidden" name="userId" value={p.id} />
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <div
                        className="text-xs font-mono"
                        style={{
                          color: scoreColor,
                          letterSpacing: "0.04em",
                          fontWeight: 700
                        }}
                        title="Estimated connection score: how much of your twin's profile overlaps with theirs. Updates as both twins add context."
                      >
                        {score}% sync
                      </div>
                      <button
                        type="submit"
                        className="retro-btn retro-btn-primary text-xs"
                      >
                        connect &gt;
                      </button>
                    </div>
                    {/* Small X — dismiss this user from the directory. Stays
                        hidden across page loads via localStorage. Stops
                        form propagation so it doesn't accidentally fire
                        startConversationWithUser.
                        Positioned at the TOP-LEFT corner (not top-right)
                        so it can't visually overlap the "{score}% sync"
                        label and "connect >" button stacked on the right. */}
                    <button
                      type="button"
                      aria-label={`Dismiss ${p.display_name || p.email}`}
                      title="Not interested — hide this person"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        dismissUser(p.id);
                      }}
                      style={{
                        position: "absolute",
                        top: 6,
                        left: 6,
                        width: 20,
                        height: 20,
                        borderRadius: 10,
                        border: "1px solid var(--border)",
                        background: "var(--panel-solid)",
                        color: "var(--text-dim)",
                        cursor: "pointer",
                        fontSize: 11,
                        lineHeight: 1,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: 0,
                        // Sits above the avatar circle; very low opacity
                        // until row-hover so it doesn't dominate. Mobile
                        // taps still hit it via the 20×20 target.
                        opacity: 0.55,
                        transition: "opacity 120ms ease"
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.opacity = "1";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.opacity = "0.55";
                      }}
                    >
                      ✕
                    </button>
                  </form>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Twin-recommended connections */}
      {!searching && (
        <div className="mt-6">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => askTwin(intent.trim())}
              disabled={suggesting}
              className="retro-btn retro-btn-primary shrink-0"
            >
              {suggesting ? (
                <DotsLoader label="searching" />
              ) : (
                "Find people"
              )}
            </button>
            <input
              value={intent}
              onChange={(e) => setIntent(e.target.value.slice(0, 280))}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  askTwin(intent.trim());
                }
              }}
              placeholder={
                intent
                  ? ""
                  : `e.g. "${SAMPLE_INTENTS[placeholderIdx]}"`
              }
              className="retro-input flex-1"
              maxLength={280}
            />
          </div>
          <div
            className="retro-dim text-xs mt-2"
            style={{ minHeight: 18 }}
          >
            {lastIntent
              ? `searched: "${lastIntent}"`
              : "Leave it blank to let your twin pick. Or type any intent — your twin combines it with your own context to find the right people."}
          </div>

          {suggestions && suggestions.length === 0 && !suggesting && (
            <p className="retro-dim text-sm mt-3">
              Your twin didn&apos;t surface any matches. Try adding more
              context to your twin in onboarding.
            </p>
          )}

          {suggestions && suggestions.length > 0 && (
            <div className="mt-4 space-y-5">
              {suggestions.map((s, idx) => (
                <div key={idx}>
                  {/*
                    Redesigned intent header. Old version used `retro-label`
                    which is the site-wide all-caps mono treatment meant
                    for section TAGS, not actual content — when the
                    rationale was a real sentence ("I need hungry
                    operators who...") it read as scary terminal output
                    and crowded the results below. Now: a rounded "your
                    twin's read" quote card with normal-case prose +
                    a real pill button for re-running the search.
                  */}
                  <div
                    className="rounded-xl p-3"
                    style={{
                      background: "var(--panel-2)",
                      border: "1px solid var(--border)",
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 12
                    }}
                  >
                    <div
                      aria-hidden="true"
                      style={{
                        flexShrink: 0,
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        background: "var(--amber-bright)33",
                        color: "var(--amber-bright)",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 13,
                        fontWeight: 800,
                        fontFamily: "Georgia, serif",
                        lineHeight: 1
                      }}
                    >
                      ‟
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        className="text-xs"
                        style={{
                          color: "var(--text-dim)",
                          textTransform: "uppercase",
                          letterSpacing: "0.08em",
                          fontWeight: 700,
                          marginBottom: 4
                        }}
                      >
                        your twin&apos;s read
                      </div>
                      <div
                        className="text-sm"
                        style={{
                          color: "var(--text)",
                          lineHeight: 1.5
                        }}
                        title={`searched: ${s.search_query}`}
                      >
                        {s.rationale}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => askTwin(s.search_query)}
                      disabled={suggesting}
                      title="Re-run this intent to surface fresh matches"
                      style={{
                        flexShrink: 0,
                        alignSelf: "center",
                        padding: "6px 12px",
                        borderRadius: 999,
                        border: "1px solid var(--border-bright)",
                        background: "var(--panel-solid)",
                        color: "var(--text)",
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: suggesting ? "default" : "pointer",
                        opacity: suggesting ? 0.5 : 1,
                        whiteSpace: "nowrap"
                      }}
                    >
                      ↻ find more
                    </button>
                  </div>
                  {s.people.length === 0 ? (
                    <p className="retro-dim text-sm mt-2">
                      No matches for this one.
                    </p>
                  ) : (
                    <ul className="mt-2 space-y-2">
                      {s.people.slice(0, 4).map((p) => {
                        const isOpen = expanded.has(p.url);
                        const preview = p.highlights[0]
                          ? p.highlights[0].length > 140
                            ? p.highlights[0].slice(0, 140) + "…"
                            : p.highlights[0]
                          : "";
                        return (
                          <li
                            key={p.url}
                            className="retro-panel retro-panel-hover p-3"
                            onClick={() => toggleExpand(p.url)}
                            style={{ cursor: "pointer" }}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="text-left flex-1 min-w-0">
                                <div className="font-semibold text-sm">
                                  {p.title}
                                </div>
                                <a
                                  href={p.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="retro-dim text-xs mt-0.5 underline hover:text-white block"
                                  style={{ wordBreak: "break-all" }}
                                >
                                  {p.url}
                                </a>
                                {!isOpen && preview && (
                                  <div
                                    className="retro-dim text-xs mt-1 line-clamp-2"
                                  >
                                    {preview}
                                  </div>
                                )}
                              </div>
                              <div
                                className="flex items-center gap-2 shrink-0"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  onClick={() => toggleExpand(p.url)}
                                  title={isOpen ? "Collapse details" : "See the full scrape"}
                                  aria-label={
                                    isOpen ? "Collapse details" : "Expand details"
                                  }
                                  style={{
                                    width: 28,
                                    height: 28,
                                    borderRadius: 999,
                                    border: "1px solid var(--border)",
                                    background: "transparent",
                                    color: "var(--text-dim)",
                                    cursor: "pointer",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: 14,
                                    lineHeight: 1
                                  }}
                                >
                                  {isOpen ? "−" : "+"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => draftOutreach(p)}
                                  disabled={!!getDraft(p.url)?.generating}
                                  // Primary CTA — promote the "draft invite"
                                  // action so it's visually the strongest
                                  // affordance on the row, not the equal
                                  // weight retro-btn it was.
                                  className="retro-btn retro-btn-primary text-sm"
                                  style={{ whiteSpace: "nowrap" }}
                                >
                                  {getDraft(p.url)?.generating ? (
                                    <DotsLoader label="Drafting" />
                                  ) : getDraft(p.url)?.draftText ? (
                                    "Redraft"
                                  ) : (
                                    "✎ Draft invite"
                                  )}
                                </button>
                              </div>
                            </div>
                            {isOpen && p.highlights.length > 0 && (
                              <div className="mt-3 space-y-2 text-sm">
                                {p.highlights.map((h, i) => (
                                  <p key={i}>{h}</p>
                                ))}
                              </div>
                            )}
                            {(() => {
                              const d = getDraft(p.url);
                              if (!d || !d.draftText) return null;
                              return (
                                <div
                                  className="mt-3"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {/* Find People rows previously rendered both
                                      a short LinkedIn connection note AND a
                                      long DM with the invite URL. Jack's call
                                      to drop the long DM: these recipients
                                      haven't connected on LinkedIn yet, so a
                                      long DM isn't actionable — the
                                      connection-note path IS the move.
                                      Mobile-friendly two-button row keeps
                                      everything on one line. */}
                                  {d.shortText && (
                                    <div>
                                      <div
                                        className="retro-label"
                                        style={{
                                          color: "var(--amber-bright)"
                                        }}
                                      >
                                        connection note · {d.shortText.length}/200
                                      </div>
                                      <textarea
                                        value={d.shortText}
                                        onChange={(e) =>
                                          setDraft(p.url, {
                                            shortText: e.target.value.slice(
                                              0,
                                              200
                                            )
                                          })
                                        }
                                        rows={3}
                                        className="retro-input mt-1 text-sm"
                                        maxLength={200}
                                        onClick={(e) => e.stopPropagation()}
                                      />
                                      <div className="flex items-center gap-2 mt-2 flex-nowrap">
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            copy(d.shortText);
                                          }}
                                          className="retro-btn text-sm"
                                          style={{ flex: "1 1 auto", minWidth: 0 }}
                                        >
                                          Copy connection note
                                        </button>
                                        {isLinkedInUrl(p.url) && (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              openLinkedInWithNote(
                                                p.url,
                                                d.shortText
                                              );
                                            }}
                                            className="retro-btn retro-btn-primary text-sm"
                                            title="Note copied. LinkedIn opens — click Connect → Add a note → Paste"
                                            aria-label="Open LinkedIn profile"
                                            style={{
                                              flex: "0 0 auto",
                                              display: "inline-flex",
                                              alignItems: "center",
                                              gap: 6,
                                              padding: "8px 12px"
                                            }}
                                          >
                                            <img
                                              src="https://www.google.com/s2/favicons?domain=linkedin.com&sz=32"
                                              alt=""
                                              width={16}
                                              height={16}
                                              style={{
                                                display: "block",
                                                borderRadius: 3
                                              }}
                                            />
                                            <span>Open profile</span>
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Empty state — only shown when there are no platform users left
          to discover. The full directory list now renders above (right
          under the search input) so we only fall through to this when
          everyone you could connect to is already in a conversation. */}
      {!searching && directory.length === 0 && (
        <div className="mt-4">
          <div className="retro-panel p-4 text-sm">
            <div className="font-semibold">
              You&apos;re caught up on platform discovery.
            </div>
            <div className="retro-dim mt-1">
              Search above for anyone — your twin will draft an invite if
              they aren&apos;t on SyncedIn yet.
            </div>
          </div>
        </div>
      )}

      {/* Search results — capped so the chats below stay reachable */}
      {searching && (
        <div
          className="mt-4 space-y-5"
          style={{
            maxHeight: "60vh",
            overflowY: "auto",
            paddingRight: 4
          }}
        >
          {/* Email shortcut */}
          {isEmail(q) && (
            <div className="retro-panel p-3">
              <Link
                href={`/conversations/new?error=`}
                className="retro-btn retro-btn-primary text-sm"
              >
                &gt; Open conversation with {q.trim().toLowerCase()}
              </Link>
            </div>
          )}

          {/* SyncedIn matches */}
          <div>
            <div className="retro-label">on syncedin</div>
            {loading && results.sync_users.length === 0 ? (
              <p className="retro-dim text-sm mt-2">Searching…</p>
            ) : results.sync_users.length === 0 ? (
              <p className="retro-dim text-sm mt-2">No SyncedIn users matched.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {results.sync_users.map((u) => (
                  <li
                    key={u.id}
                    className="retro-panel retro-panel-hover p-3 flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="font-semibold text-sm">
                        {u.display_name || "Unnamed twin"}
                      </div>
                      {u.email && (
                        <div className="retro-dim text-xs">{u.email}</div>
                      )}
                    </div>
                    <form action={startConversationWithUser}>
                      <input type="hidden" name="userId" value={u.id} />
                      <button className="retro-btn retro-btn-primary text-sm">
                        &gt; open
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Exa web results */}
          {!isEmail(q) && (
            <div>
              <div className="retro-label">found on the web</div>
              {loading && results.exa_people.length === 0 ? (
                <p className="retro-dim text-sm mt-2">Checking the web…</p>
              ) : results.exa_people.length === 0 ? (
                <p className="retro-dim text-sm mt-2">
                  No web matches. Try a fuller name or add their company.
                </p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {results.exa_people.map((p) => {
                    const isOpen = expanded.has(p.url);
                    const preview = p.highlights[0]
                      ? p.highlights[0].length > 140
                        ? p.highlights[0].slice(0, 140) + "…"
                        : p.highlights[0]
                      : "";
                    return (
                      <li
                        key={p.url}
                        className="retro-panel retro-panel-hover p-3"
                        onClick={() => toggleExpand(p.url)}
                        style={{ cursor: "pointer" }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="text-left flex-1 min-w-0">
                            <div
                              className="text-left font-semibold text-sm"
                              style={{ color: "var(--text)" }}
                            >
                              {p.title}
                            </div>
                            <a
                              href={p.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="retro-dim text-xs mt-0.5 underline hover:text-white block"
                              style={{ wordBreak: "break-all" }}
                            >
                              {p.url}
                            </a>
                            {!isOpen && preview && (
                              <div
                                className="retro-dim text-xs mt-1 line-clamp-1"
                              >
                                {preview}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleExpand(p.url);
                              }}
                              className="retro-dim text-xs hover:text-white"
                            >
                              {isOpen ? "− collapse" : "+ expand"}
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                draftOutreach(p);
                              }}
                              disabled={!!getDraft(p.url)?.generating}
                              className="retro-btn text-sm"
                            >
                              {getDraft(p.url)?.generating ? (
                                <DotsLoader label="Drafting" />
                              ) : getDraft(p.url)?.draftText ? (
                                "Redraft"
                              ) : (
                                "Draft invite"
                              )}
                            </button>
                          </div>
                        </div>

                        {isOpen && p.highlights.length > 0 && (
                          <div className="mt-3 space-y-2 text-sm">
                            {p.highlights.map((h, i) => (
                              <p key={i}>{h}</p>
                            ))}
                          </div>
                        )}

                        {(() => {
                          const d = getDraft(p.url);
                          if (!d || !d.draftText) return null;
                          return (
                            <div
                              className="mt-3 space-y-3"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {d.shortText && (
                                <div>
                                  <div
                                    className="retro-label flex items-center justify-between"
                                    style={{ color: "var(--amber-bright)" }}
                                  >
                                    <span>
                                      connection note ·{" "}
                                      {d.shortText.length}/200
                                    </span>
                                  </div>
                                  <textarea
                                    value={d.shortText}
                                    onChange={(e) =>
                                      setDraft(p.url, {
                                        shortText: e.target.value.slice(
                                          0,
                                          300
                                        )
                                      })
                                    }
                                    rows={3}
                                    className="retro-input mt-1 text-sm"
                                    maxLength={200}
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                  <div className="flex items-center gap-2 mt-2 flex-nowrap">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        copy(d.shortText);
                                      }}
                                      className="retro-btn text-sm"
                                      style={{ flex: "1 1 auto", minWidth: 0 }}
                                    >
                                      Copy connection note
                                    </button>
                                    {isLinkedInUrl(p.url) && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          openLinkedInWithNote(
                                            p.url,
                                            d.shortText
                                          );
                                        }}
                                        className="retro-btn retro-btn-primary text-sm"
                                        title="Note copied. LinkedIn opens — click Connect → Add a note → Paste"
                                        aria-label="Open LinkedIn profile"
                                        style={{
                                          flex: "0 0 auto",
                                          display: "inline-flex",
                                          alignItems: "center",
                                          gap: 6,
                                          padding: "8px 12px"
                                        }}
                                      >
                                        <img
                                          src="https://www.google.com/s2/favicons?domain=linkedin.com&sz=32"
                                          alt=""
                                          width={16}
                                          height={16}
                                          style={{
                                            display: "block",
                                            borderRadius: 3
                                          }}
                                        />
                                        <span>Open profile</span>
                                      </button>
                                    )}
                                  </div>
                                </div>
                              )}
                              {/* Long DM section removed: recipients in
                                  Find People haven't connected on LinkedIn
                                  yet, so a full DM with the invite URL
                                  isn't actionable until after they accept
                                  the connection. The connection note IS
                                  the entire move. */}
                            </div>
                          );
                        })()}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
