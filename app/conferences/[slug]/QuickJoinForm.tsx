"use client";

import { useState } from "react";
import Link from "next/link";
import { BrandLogo, type BrandKey } from "../../BrandLogo";

/**
 * QuickJoinForm — the low-friction, logged-out entry point on a room page
 * (Jack). A visitor pastes who they are (about / wants / offers / links,
 * + an optional deep AI dump), clicks Save, and INSTANTLY sees the
 * members they'd win-win with. "View full messages" then pushes them to
 * create an account. The typed context is stashed locally so signup +
 * onboarding can prefill it.
 */
const SOURCES: { key: BrandKey; label: string }[] = [
  { key: "chatgpt", label: "ChatGPT" },
  { key: "claude", label: "Claude" },
  { key: "gemini", label: "Gemini" },
  { key: "perplexity", label: "Perplexity" },
  { key: "grok", label: "Grok" }
];

const COPY_PROMPT =
  "Write a tight dossier of me for a networking twin: what I'm working on right now, exactly what I'm looking for (intros, hires, capital, partners), what I can offer others, and recent concrete wins with names and numbers. Be specific, first-person, no fluff.";

export function QuickJoinForm({
  slug,
  signupHref,
  roomName
}: {
  slug: string;
  signupHref: string;
  roomName: string;
}) {
  const [name, setName] = useState("");
  const [links, setLinks] = useState("");
  const [about, setAbout] = useState("");
  const [wants, setWants] = useState("");
  const [offers, setOffers] = useState("");
  const [dump, setDump] = useState("");
  const [showDump, setShowDump] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [matches, setMatches] = useState<
    { name: string; winwin: string }[] | null
  >(null);
  const [note, setNote] = useState<string | null>(null);

  function context(): string {
    return [
      name && `Name: ${name}`,
      links && `Links: ${links}`,
      about && `About: ${about}`,
      wants && `Wants/needs: ${wants}`,
      offers && `Offers: ${offers}`,
      dump && `More:\n${dump}`
    ]
      .filter(Boolean)
      .join("\n");
  }

  async function save() {
    const ctx = context();
    if (ctx.trim().length < 12) {
      setNote("Add a bit about yourself first.");
      return;
    }
    setBusy(true);
    setNote(null);
    try {
      // Stash so signup / onboarding can prefill the twin.
      try {
        localStorage.setItem(
          `syncedin-quickjoin-${slug}`,
          JSON.stringify({ name, links, about, wants, offers, dump })
        );
      } catch {
        /* storage blocked — fine */
      }
      const res = await fetch(`/api/communities/${slug}/preview-match`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ context: ctx })
      });
      const j = await res.json().catch(() => ({}) as any);
      setMatches(Array.isArray(j.matches) ? j.matches : []);
      if (j.note) setNote(j.note);
    } catch {
      setNote("Couldn't load matches — you can still sign up to connect.");
    } finally {
      setBusy(false);
    }
  }

  const field: React.CSSProperties = { marginTop: 10 };

  return (
    <section className="mt-8 retro-panel" style={{ padding: 22 }}>
      <div className="retro-label" style={{ color: "var(--amber-bright)" }}>
        see who you&apos;d connect with — in 30 seconds
      </div>
      <p
        className="mt-1 text-sm"
        style={{ color: "var(--text-dim)", maxWidth: 640 }}
      >
        Drop in who you are and what you&apos;re looking for. We&apos;ll show
        you the people in {roomName} worth meeting right now — then you can
        claim your spot.
      </p>

      {!matches ? (
        <div style={{ maxWidth: 640 }}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="retro-input"
            style={field}
          />
          <input
            value={links}
            onChange={(e) => setLinks(e.target.value)}
            placeholder="Links — LinkedIn / X / site (paste any)"
            className="retro-input"
            style={field}
          />
          <textarea
            value={about}
            onChange={(e) => setAbout(e.target.value)}
            placeholder="About you — what you're working on"
            rows={2}
            className="retro-input"
            style={field}
          />
          <textarea
            value={wants}
            onChange={(e) => setWants(e.target.value)}
            placeholder="What you want / need (intros, hires, capital, partners…)"
            rows={2}
            className="retro-input"
            style={field}
          />
          <textarea
            value={offers}
            onChange={(e) => setOffers(e.target.value)}
            placeholder="What you offer"
            rows={2}
            className="retro-input"
            style={field}
          />

          <button
            type="button"
            onClick={() => setShowDump((v) => !v)}
            style={{
              marginTop: 10,
              background: "transparent",
              border: "none",
              padding: 0,
              cursor: "pointer",
              color: "var(--amber-bright)",
              fontSize: 12,
              fontWeight: 700
            }}
          >
            {showDump ? "− hide" : "+ paste personal intelligence"} (deeper
            connections)
          </button>

          {showDump && (
            <div style={{ marginTop: 8 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  flexWrap: "wrap",
                  marginBottom: 6
                }}
              >
                <span style={{ fontSize: 12, color: "var(--text-dim)" }}>
                  Pull from:
                </span>
                {SOURCES.map((s) => (
                  <span
                    key={s.key}
                    title={s.label}
                    style={{ display: "inline-flex", alignItems: "center" }}
                  >
                    <BrandLogo brand={s.key} size={18} />
                  </span>
                ))}
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(COPY_PROMPT);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1800);
                    } catch {
                      /* clipboard blocked */
                    }
                  }}
                  className="retro-btn text-xs"
                  style={{ padding: "4px 10px" }}
                >
                  {copied ? "✓ copied" : "Copy prompt"}
                </button>
              </div>
              <textarea
                value={dump}
                onChange={(e) => setDump(e.target.value)}
                placeholder="Paste the output here — it auto-fills your twin and unlocks deeper matches."
                rows={4}
                className="retro-input"
              />
            </div>
          )}

          <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center" }}>
            <button
              type="button"
              onClick={save}
              disabled={busy}
              className="retro-btn retro-btn-primary"
              style={{ fontWeight: 800 }}
            >
              {busy ? "Finding your matches…" : "See my matches →"}
            </button>
          </div>
          {note && (
            <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-dim)" }}>
              {note}
            </div>
          )}
        </div>
      ) : (
        <div style={{ maxWidth: 640 }}>
          {matches.length > 0 ? (
            <>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 800,
                  color: "var(--green)",
                  marginTop: 4
                }}
              >
                ✦ {matches.length} win-win{matches.length === 1 ? "" : "s"}{" "}
                waiting for you in {roomName}
              </div>
              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
                {matches.map((m, i) => (
                  <div
                    key={i}
                    className="retro-panel"
                    style={{ padding: 12, background: "var(--panel-2)" }}
                  >
                    <div style={{ fontWeight: 800, fontSize: 14 }}>{m.name}</div>
                    <div
                      style={{
                        fontSize: 13,
                        color: "var(--text-dim)",
                        lineHeight: 1.5,
                        marginTop: 4
                      }}
                    >
                      {m.winwin}
                    </div>
                    <Link
                      href={signupHref}
                      className="retro-btn retro-btn-primary"
                      style={{
                        marginTop: 8,
                        fontSize: 12,
                        padding: "6px 12px",
                        textDecoration: "none",
                        display: "inline-block"
                      }}
                    >
                      ◌ View full messages →
                    </Link>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 6 }}>
              {note ||
                "We'll surface your matches the moment you join — claim your spot below."}
            </div>
          )}
          <Link
            href={signupHref}
            className="retro-btn retro-btn-primary"
            style={{
              marginTop: 14,
              fontWeight: 800,
              textDecoration: "none",
              display: "inline-block"
            }}
          >
            + Create my account &amp; connect
          </Link>
          <button
            type="button"
            onClick={() => setMatches(null)}
            style={{
              marginLeft: 12,
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "var(--text-dim)",
              fontSize: 12
            }}
          >
            ← edit my info
          </button>
        </div>
      )}
    </section>
  );
}
