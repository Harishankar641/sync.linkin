"use client";

import { useState } from "react";
import Link from "next/link";
import { BrandLogo, type BrandKey } from "../BrandLogo";
import { track } from "@/lib/track";
import { TrustNote } from "../TrustNote";

/**
 * GeneratePortfolioForm — the conversion engine for the
 * /generate-free-portfolio funnel. Paste personal intelligence → instant
 * portfolio teaser → claim it (sign up). The paste is stashed locally so
 * onboarding prefills the twin + builds the full portfolio.
 */
const SOURCES: { key: BrandKey; label: string }[] = [
  { key: "chatgpt", label: "ChatGPT" },
  { key: "claude", label: "Claude" },
  { key: "gemini", label: "Gemini" },
  { key: "perplexity", label: "Perplexity" },
  { key: "grok", label: "Grok" }
];

const COPY_PROMPT =
  "Write a tight dossier of me: who I am, what I'm working on, what I'm looking for, what I can offer, and my concrete wins with names and numbers. Specific, first-person, no fluff.";

export function GeneratePortfolioForm() {
  const [name, setName] = useState("");
  const [dump, setDump] = useState("");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<{
    headline: string;
    about: string;
    highlights: string[];
  } | null>(null);

  async function generate() {
    if (dump.trim().length < 20) {
      setErr("Paste a bit more about yourself first.");
      return;
    }
    setBusy(true);
    setErr(null);
    track("generate_started", { chars: dump.length });
    try {
      // Stash so signup → onboarding prefills the twin + full portfolio.
      try {
        localStorage.setItem(
          "syncedin-portfolio-seed",
          JSON.stringify({ name, dump })
        );
      } catch {
        /* storage blocked — still works, just no prefill */
      }
      const res = await fetch("/api/portfolio-preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, dump })
      });
      const j = await res.json().catch(() => ({}) as any);
      if (j?.error) {
        setErr(j.detail || "Couldn't generate — add a little more and retry.");
        return;
      }
      setResult({
        headline: j.headline || "",
        about: j.about || "",
        highlights: Array.isArray(j.highlights) ? j.highlights : []
      });
      track("generate_done", { chars: dump.length });
    } catch {
      setErr("Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    return (
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <div className="retro-label" style={{ color: "var(--green)" }}>
          ✦ your portfolio, generated
        </div>
        <div
          className="retro-panel retro-shadow"
          style={{ marginTop: 12, padding: 24 }}
        >
          <div
            style={{
              fontSize: 26,
              fontWeight: 850,
              letterSpacing: "-0.02em",
              lineHeight: 1.1,
              color: "var(--text)"
            }}
          >
            {name || "Your portfolio"}
          </div>
          {result.headline && (
            <div
              style={{
                marginTop: 8,
                fontSize: 16,
                color: "var(--amber-bright)",
                fontWeight: 700
              }}
            >
              {result.headline}
            </div>
          )}
          {result.about && (
            <p style={{ marginTop: 12, fontSize: 15, lineHeight: 1.6, color: "var(--text)" }}>
              {result.about}
            </p>
          )}
          {result.highlights.length > 0 && (
            <ul style={{ marginTop: 14, paddingLeft: 18, lineHeight: 1.7, color: "var(--text-dim)" }}>
              {result.highlights.map((h, i) => (
                <li key={i} style={{ fontSize: 14 }}>
                  {h}
                </li>
              ))}
            </ul>
          )}
        </div>
        <Link
          href="/login?next=/onboarding"
          onClick={() => track("claim_clicked")}
          className="retro-btn retro-btn-primary"
          style={{
            marginTop: 16,
            width: "100%",
            textAlign: "center",
            textDecoration: "none",
            padding: "14px 16px",
            fontSize: 16,
            fontWeight: 800,
            display: "block"
          }}
        >
          Claim my free portfolio →
        </Link>
        <p
          style={{ marginTop: 8, fontSize: 12, color: "var(--text-dim)", textAlign: "center" }}
        >
          Free. Sign up to publish it at syncedin.org/u/you and let your twin
          start finding win-wins.
        </p>
        <button
          type="button"
          onClick={() => setResult(null)}
          style={{
            marginTop: 8,
            width: "100%",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: "var(--text-dim)",
            fontSize: 12
          }}
        >
          ← edit what I pasted
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Your name"
        className="retro-input"
        style={{ marginTop: 4 }}
      />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
          margin: "12px 0 6px"
        }}
      >
        <span style={{ fontSize: 12, color: "var(--text-dim)", fontWeight: 600 }}>
          Pull yours from:
        </span>
        {SOURCES.map((s) => (
          <span key={s.key} title={s.label} style={{ display: "inline-flex" }}>
            <BrandLogo brand={s.key} size={18} />
          </span>
        ))}
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(COPY_PROMPT);
              setCopied(true);
              track("prompt_copied");
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
        rows={7}
        placeholder="Paste your personal intelligence — your ChatGPT/Claude memory, your bio, or just everything about what you do, what you want, and what you offer."
        className="retro-input"
        style={{ fontSize: 14, lineHeight: 1.5 }}
      />
      <TrustNote />
      <button
        type="button"
        onClick={generate}
        disabled={busy}
        className="retro-btn retro-btn-primary"
        style={{
          marginTop: 12,
          width: "100%",
          padding: "14px 16px",
          fontSize: 16,
          fontWeight: 800
        }}
      >
        {busy ? "Generating your portfolio…" : "✦ Generate my free portfolio →"}
      </button>
      {err && (
        <div style={{ marginTop: 8, fontSize: 13, color: "var(--red, #ef4444)" }}>
          {err}
        </div>
      )}
      <p style={{ marginTop: 8, fontSize: 12, color: "var(--text-dim)", textAlign: "center" }}>
        Free, no account needed to preview. Takes ~10 seconds.
      </p>
    </div>
  );
}
