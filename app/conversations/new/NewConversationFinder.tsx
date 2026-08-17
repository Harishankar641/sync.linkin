"use client";

import { useEffect, useRef, useState } from "react";
import { startConversationByUserId, startConversation } from "./actions";

type SyncUser = {
  id: string;
  display_name: string | null;
  email: string | null;
};
type ExaPerson = { title: string; url: string; highlights: string[] };

type FindResponse = { sync_users: SyncUser[]; exa_people: ExaPerson[] };

const isLikelyEmail = (s: string) => /\S+@\S+\.\S+/.test(s);

export default function NewConversationFinder() {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState(false);
  const [results, setResults] = useState<FindResponse>({
    sync_users: [],
    exa_people: []
  });
  const [drafting, setDrafting] = useState<string | null>(null);
  const [draftFor, setDraftFor] = useState<ExaPerson | null>(null);
  const [draftText, setDraftText] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced search.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) {
      setResults({ sync_users: [], exa_people: [] });
      setTouched(false);
      return;
    }
    setTouched(true);
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
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
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [q]);

  async function draftOutreach(p: ExaPerson) {
    setDraftFor(p);
    setDrafting(p.url);
    setDraftText("");
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
      setDraftText(j.message ?? "");
    } catch {
      setDraftText("");
    } finally {
      setDrafting(null);
    }
  }

  function copy(text: string) {
    navigator.clipboard?.writeText(text).catch(() => {});
  }

  const showEmailFallback = isLikelyEmail(q);

  return (
    <div className="space-y-4">
      <div>
        <label className="retro-label">find them</label>
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Their name (or email)"
          className="retro-input mt-1"
        />
        <p className="retro-dim text-xs mt-2">
          Search SyncedIn by name. Not on SyncedIn yet? We&apos;ll find them on
          the web and draft an invite in your voice.
        </p>
      </div>

      {/* Direct email fallback — appears only if the input looks like an email */}
      {showEmailFallback && (
        <form action={startConversation} className="flex gap-2">
          <input type="hidden" name="email" value={q.trim().toLowerCase()} />
          <button className="retro-btn retro-btn-primary flex-1">
            &gt; Open conversation with {q.trim().toLowerCase()}
          </button>
        </form>
      )}

      {/* SyncedIn matches */}
      {touched && (
        <section>
          <div className="retro-label">on syncedin</div>
          {loading && results.sync_users.length === 0 ? (
            <p className="retro-dim text-sm mt-1">Searching…</p>
          ) : results.sync_users.length === 0 ? (
            <p className="retro-dim text-sm mt-1">No SyncedIn users matched.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {results.sync_users.map((u) => (
                <li key={u.id}>
                  <form
                    action={startConversationByUserId}
                    className="flex items-center justify-between gap-4 p-4 retro-panel retro-panel-hover"
                  >
                    <input type="hidden" name="user_id" value={u.id} />
                    <div>
                      <div className="font-semibold text-base">
                        {u.display_name || "Unnamed twin"}
                      </div>
                      {u.email && (
                        <div className="retro-dim text-sm mt-0.5">
                          {u.email}
                        </div>
                      )}
                    </div>
                    <button className="retro-btn retro-btn-primary shrink-0">
                      &gt; Open
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Exa web results */}
      {touched && !showEmailFallback && (
        <section>
          <div className="retro-label">found on the web</div>
          {loading && results.exa_people.length === 0 ? (
            <p className="retro-dim text-sm mt-1">Checking the web…</p>
          ) : results.exa_people.length === 0 ? (
            <p className="retro-dim text-sm mt-1">
              No web matches. Try a fuller name or add their company.
            </p>
          ) : (
            <ul className="mt-2 space-y-2">
              {results.exa_people.map((p) => (
                <li key={p.url} className="p-4 retro-panel retro-panel-hover">
                  <div className="flex items-start justify-between gap-4">
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="font-semibold text-base">{p.title}</div>
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="retro-dim text-sm underline mt-1 inline-block"
                        style={{ wordBreak: "break-all" }}
                      >
                        {p.url}
                      </a>
                      {p.highlights.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {p.highlights.map((h, i) => (
                            <p
                              key={i}
                              className="text-sm"
                              style={{ color: "var(--text)" }}
                            >
                              {h}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => draftOutreach(p)}
                      disabled={drafting === p.url}
                      className="retro-btn shrink-0"
                    >
                      {drafting === p.url ? "Drafting…" : "Draft invite"}
                    </button>
                  </div>

                  {draftFor?.url === p.url && draftText && (
                    <div className="mt-4">
                      <textarea
                        value={draftText}
                        onChange={(e) => setDraftText(e.target.value)}
                        rows={6}
                        className="retro-input"
                      />
                      <div className="flex gap-2 mt-3">
                        <button
                          type="button"
                          onClick={() => copy(draftText)}
                          className="retro-btn retro-btn-primary"
                        >
                          Copy
                        </button>
                        <a
                          href={p.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="retro-btn"
                        >
                          Open profile →
                        </a>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
