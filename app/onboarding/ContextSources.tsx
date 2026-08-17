"use client";

import { useState } from "react";
import { DotsLoader } from "../DotsLoader";

export type Snippet = {
  id: string;
  label: string;
  source: string;
  text: string;
  note?: string;
};

const QUICK_TYPES = [
  {
    key: "linkedin",
    label: "LinkedIn",
    placeholder: "https://linkedin.com/in/your-handle, or just the handle",
    icon: "▣"
  },
  {
    key: "x",
    label: "X / Twitter",
    placeholder: "https://x.com/yourhandle, or just the handle",
    icon: "𝕏"
  },
  {
    key: "instagram",
    label: "Instagram",
    placeholder: "https://instagram.com/yourhandle, or just the handle",
    icon: "□"
  },
  {
    key: "url",
    label: "Any URL",
    placeholder: "https://anywhere.com/about-you",
    icon: "◎"
  }
];

function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function normalizeUrl(raw: string, type: string): string {
  let v = raw.trim().replace(/^@/, "");
  if (!v) return "";
  if (/^https?:\/\//i.test(v)) return v;
  if (/^[a-z0-9-]+\.[a-z]{2,}\//i.test(v)) return `https://${v}`;
  if (v.includes("/") && /^[a-z0-9-]+\.[a-z]{2,}/i.test(v)) {
    return `https://${v}`;
  }
  switch (type) {
    case "linkedin":
      return `https://www.linkedin.com/in/${v}`;
    case "x":
      return `https://x.com/${v}`;
    case "instagram":
      return `https://www.instagram.com/${v}`;
    default:
      return /\./.test(v) ? `https://${v}` : v;
  }
}

/**
 * Universal context-source ingestion. The user can:
 *   - Paste a URL → we fetch + clean via Exa+AI
 *   - Paste a raw blob → the AI cleans it
 *   - Add a "purpose / extra context" note alongside the URL to help the AI
 *     when the scrape is thin (Twitter and Instagram often return little)
 *
 * Every snippet that lands in "Added so far" is fully visible and editable
 * in place. Edits flow back to the parent through `onChange(snippets)`.
 */
export function ContextSources({
  snippets,
  onChange
}: {
  snippets: Snippet[];
  onChange: (next: Snippet[]) => void;
}) {
  const [active, setActive] = useState<string>("linkedin");
  const [input, setInput] = useState("");
  const [purpose, setPurpose] = useState("");
  const [pasted, setPasted] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  // Which snippet bodies are expanded. Default: all collapsed (cards can be
  // very long once Apify pulls in a real X / IG profile worth of posts).
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const current = QUICK_TYPES.find((t) => t.key === active) ?? QUICK_TYPES[0];
  // Note textarea is ONLY meaningful for "Any URL" — for LinkedIn / X /
  // Instagram we scrape the profile directly (Apify + Exa) and use those
  // posts as the user's voice/writing-style signal. No manual note needed.
  const showNoteField = active !== "linkedin" && active !== "x" && active !== "instagram";

  async function submitUrl() {
    if (!input.trim()) return;
    setLoading(true);
    setError(null);
    const url = normalizeUrl(input, active);
    try {
      const r = await fetch("/api/extract-context-source", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: "url",
          value: url,
          note: purpose || undefined
        })
      });
      const j = await r.json();
      if (j.error) {
        setError(j.detail || j.error);
        return;
      }
      // Newest first — so a freshly-added snippet doesn't get lost below
      // existing long blobs that the user has to scroll past.
      onChange([
        {
          id: newId(),
          label: j.label || current.label,
          source: j.source || url,
          text: j.extracted_text || "",
          note: purpose || undefined
        },
        ...snippets
      ]);
      setInput("");
      setPurpose("");
    } catch {
      setError("Couldn't reach the server. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function submitRaw() {
    if (!pasted.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/extract-context-source", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "raw", value: pasted.trim() })
      });
      const j = await r.json();
      if (j.error) {
        setError(j.detail || j.error);
        return;
      }
      onChange([
        {
          id: newId(),
          label: j.label || "Pasted text",
          source: j.source || "manual",
          text: j.extracted_text || ""
        },
        ...snippets
      ]);
      setPasted("");
    } catch {
      setError("Couldn't reach the server. Try again.");
    } finally {
      setLoading(false);
    }
  }

  function updateText(id: string, text: string) {
    onChange(snippets.map((s) => (s.id === id ? { ...s, text } : s)));
  }
  function remove(id: string) {
    onChange(snippets.filter((s) => s.id !== id));
    if (editing === id) setEditing(null);
  }

  return (
    <div>
      <div className="retro-label">add context from anywhere</div>
      <p className="text-xs mt-1" style={{ color: "var(--text-dim)" }}>
        Paste a URL, a handle, or a raw text blob. We&apos;ll fetch it,
        clean it, and feed it to your twin. Everything you add stays
        editable below.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {QUICK_TYPES.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActive(t.key)}
            className="retro-btn text-xs"
            style={{
              padding: "8px 14px",
              borderColor:
                active === t.key
                  ? "var(--amber)"
                  : "var(--border-bright)",
              background:
                active === t.key
                  ? "var(--panel-solid)"
                  : "var(--panel-2)",
              boxShadow:
                active === t.key
                  ? "0 0 0 2px var(--accent-glow)"
                  : undefined
            }}
          >
            <span style={{ marginRight: 6 }}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-3 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submitUrl();
            }
          }}
          placeholder={current.placeholder}
          className="retro-input flex-1"
        />
        <button
          type="button"
          onClick={submitUrl}
          disabled={loading || !input.trim()}
          className="retro-btn retro-btn-primary shrink-0"
        >
          {loading ? <DotsLoader label="fetching" /> : "+ add"}
        </button>
      </div>

      {/* Optional purpose note — only for "Any URL". LinkedIn / X / Instagram
          are scraped directly and used as voice samples; no manual note. */}
      {showNoteField && (
        <div className="mt-2">
          <textarea
            value={purpose}
            onChange={(e) => setPurpose(e.target.value.slice(0, 1500))}
            rows={2}
            placeholder="Optional: a few words on what this link is and why your twin should care about it."
            className="retro-input text-sm"
          />
        </div>
      )}

      <details className="mt-3">
        <summary
          className="text-xs cursor-pointer"
          style={{ color: "var(--text-dim)" }}
        >
          or paste text from a post, screenshot caption, anywhere
        </summary>
        <div className="mt-2">
          <textarea
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            rows={5}
            placeholder="Paste any text about you here. Tweets, captions, an article you wrote, OCR from a screenshot, anything."
            className="retro-input text-sm"
          />
          <button
            type="button"
            onClick={submitRaw}
            disabled={loading || !pasted.trim()}
            className="retro-btn mt-2"
          >
            {loading ? <DotsLoader label="processing" /> : "+ add this"}
          </button>
        </div>
      </details>

      {error && (
        <div
          className="mt-3 text-xs retro-panel p-3"
          style={{ borderColor: "var(--red)", color: "var(--red)" }}
        >
          {error}
        </div>
      )}

      {snippets.length > 0 && (
        <div className="mt-5">
          <div
            className="retro-label"
            style={{ color: "var(--amber-bright)" }}
          >
            added so far ({snippets.length}) · click to edit
          </div>
          <ul className="mt-2 space-y-2">
            {snippets.map((s) => {
              const isEditing = editing === s.id;
              // Currently-editing rows are always open. Otherwise consult
              // the expanded Set. Cards open with a smooth click anywhere.
              const isOpen = isEditing || expanded.has(s.id);
              const preview = s.text.replace(/\s+/g, " ").slice(0, 110);
              const charCount = s.text.length;
              return (
                <li
                  key={s.id}
                  className="retro-panel"
                  style={{ padding: 0, overflow: "hidden" }}
                >
                  <button
                    type="button"
                    onClick={() => toggleExpand(s.id)}
                    className="w-full text-left flex items-start justify-between gap-3 p-3"
                    style={{
                      background: "transparent",
                      border: 0,
                      cursor: "pointer"
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="flex items-center gap-2">
                        <span
                          style={{
                            fontFamily:
                              '"IBM Plex Mono", ui-monospace, monospace',
                            fontSize: 11,
                            color: "var(--text-dim)",
                            width: 12,
                            display: "inline-block"
                          }}
                        >
                          {isOpen ? "−" : "+"}
                        </span>
                        <span
                          className="font-semibold text-sm"
                          style={{ color: "var(--text)" }}
                        >
                          {s.label}
                        </span>
                        <span
                          className="retro-dim text-[10px]"
                          style={{ marginLeft: "auto" }}
                        >
                          {charCount.toLocaleString()} chars
                        </span>
                      </div>
                      {!isOpen && (
                        <div
                          className="retro-dim text-xs mt-1 line-clamp-1"
                          style={{ paddingLeft: 18 }}
                        >
                          {preview}
                          {s.text.length > preview.length ? "…" : ""}
                        </div>
                      )}
                    </div>
                  </button>

                  {isOpen && (
                    <div className="px-3 pb-3">
                      <a
                        href={
                          s.source.startsWith("http") ? s.source : undefined
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="retro-dim text-xs underline inline-block"
                        style={{ wordBreak: "break-all" }}
                      >
                        {s.source}
                      </a>
                      <div className="flex gap-2 mt-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditing(isEditing ? null : s.id);
                          }}
                          className="retro-dim text-xs hover:text-white"
                        >
                          {isEditing ? "done" : "edit"}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            remove(s.id);
                          }}
                          className="text-xs hover:text-white"
                          style={{ color: "var(--red)" }}
                        >
                          remove
                        </button>
                      </div>

                      {isEditing ? (
                        <textarea
                          value={s.text}
                          onChange={(e) => updateText(s.id, e.target.value)}
                          rows={Math.min(
                            20,
                            Math.max(6, s.text.split(/\n/).length + 2)
                          )}
                          className="retro-input text-sm mt-3 font-mono"
                          style={{ minHeight: 180 }}
                          autoFocus
                        />
                      ) : (
                        <div
                          className="mt-3 text-sm"
                          style={{
                            color: "var(--text)",
                            whiteSpace: "pre-wrap",
                            lineHeight: 1.55
                          }}
                        >
                          {s.text}
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
