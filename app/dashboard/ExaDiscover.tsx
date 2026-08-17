"use client";

import { useState } from "react";
import { BrandLogo } from "../BrandLogo";

type Person = {
  title: string;
  url: string;
  highlights: string[];
};

type DraftState = {
  loading: boolean;
  message: string | null;
  copied: boolean;
};

export function ExaDiscover() {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [people, setPeople] = useState<Person[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, DraftState>>({});

  async function search() {
    if (!query.trim()) return;
    setSearching(true);
    setError(null);
    setPeople(null);
    setDrafts({});
    try {
      const res = await fetch("/api/exa-search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || json.error || "search failed");
      setPeople(json.people ?? []);
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setSearching(false);
    }
  }

  async function draft(p: Person) {
    setDrafts((d) => ({
      ...d,
      [p.url]: { loading: true, message: null, copied: false }
    }));
    try {
      const res = await fetch("/api/exa-draft-outreach", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          person_title: p.title,
          person_url: p.url,
          highlights: p.highlights
        })
      });
      const json = await res.json();
      if (!res.ok)
        throw new Error(json.detail || json.error || "draft failed");
      setDrafts((d) => ({
        ...d,
        [p.url]: { loading: false, message: json.message, copied: false }
      }));
    } catch (e: any) {
      setDrafts((d) => ({
        ...d,
        [p.url]: { loading: false, message: `! ${e.message}`, copied: false }
      }));
    }
  }

  async function copyDraft(url: string) {
    const d = drafts[url];
    if (!d?.message) return;
    try {
      await navigator.clipboard.writeText(d.message);
      setDrafts((prev) => ({
        ...prev,
        [url]: { ...prev[url], copied: true }
      }));
      setTimeout(
        () =>
          setDrafts((prev) => ({
            ...prev,
            [url]: { ...prev[url], copied: false }
          })),
        1600
      );
    } catch {
      /* clipboard blocked */
    }
  }

  return (
    <div className="retro-panel p-4">
      <div className="retro-label">discover with exa</div>
      <p className="mt-2 retro-dim text-xs leading-relaxed">
        Describe the kind of person you want to connect with. Your twin
        searches the open web, finds real matches, and drafts the first
        message — so the reach-out is one paste away.
      </p>

      <div className="mt-3 flex items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              search();
            }
          }}
          placeholder="e.g. seed investor backing AI agent startups"
          className="retro-input text-sm flex-1"
        />
        <button
          onClick={search}
          disabled={searching || !query.trim()}
          className="retro-btn retro-btn-primary text-sm shrink-0"
        >
          {searching ? "searching…" : "search"}
        </button>
      </div>

      {error && (
        <div
          className="mt-3 p-2 retro-panel"
          style={{ borderColor: "var(--red)" }}
        >
          <p className="text-xs retro-red">{error}</p>
        </div>
      )}

      {people && people.length === 0 && (
        <p className="mt-3 retro-dim text-sm">
          No matches — try a broader or differently-worded description.
        </p>
      )}

      {people && people.length > 0 && (
        <div className="mt-3 space-y-2">
          {people.map((p) => {
            const d = drafts[p.url];
            return (
              <div key={p.url} className="retro-panel p-3">
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10
                  }}
                >
                  <div className="font-semibold text-sm" style={{ minWidth: 0, flex: 1 }}>
                    {p.title}
                  </div>
                  {/* Clickable LinkedIn logo — Jack: "if someone clicks
                      that logo, it goes to that person's LinkedIn." Only
                      rendered when the result URL is actually a LinkedIn
                      profile (Exa returns mixed sources). The whole
                      anchor is the click target. */}
                  {/linkedin\.com\/in\//i.test(p.url) && (
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Open LinkedIn profile"
                      title="Open LinkedIn profile"
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        padding: 6,
                        borderRadius: 8,
                        background: "rgba(10, 102, 194, 0.10)",
                        border: "1px solid rgba(10, 102, 194, 0.28)",
                        textDecoration: "none"
                      }}
                    >
                      <BrandLogo brand="linkedin" size={18} />
                    </a>
                  )}
                </div>
                <a
                  href={p.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="retro-amber text-[11px] break-all"
                >
                  {p.url}
                </a>
                {p.highlights.length > 0 && (
                  <div className="retro-dim text-xs mt-1.5 line-clamp-3">
                    {p.highlights.join(" · ")}
                  </div>
                )}

                {!d && (
                  <button
                    onClick={() => draft(p)}
                    className="retro-btn text-xs mt-2"
                  >
                    draft outreach &gt;
                  </button>
                )}
                {d?.loading && (
                  <p className="retro-dim text-xs mt-2">
                    your twin is drafting…
                  </p>
                )}
                {d?.message && (
                  <div className="mt-2 retro-panel p-2.5">
                    <p
                      className="text-sm whitespace-pre-wrap"
                      style={{
                        fontFamily:
                          '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
                      }}
                    >
                      {d.message}
                    </p>
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => copyDraft(p.url)}
                        className="retro-btn retro-btn-primary text-xs"
                      >
                        {d.copied ? "✓ copied" : "copy message"}
                      </button>
                      <button
                        onClick={() => draft(p)}
                        className="retro-btn text-xs"
                      >
                        redraft
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
