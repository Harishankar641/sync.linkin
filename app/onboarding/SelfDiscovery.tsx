"use client";

import { useEffect, useRef, useState } from "react";
import { DotsLoader } from "../DotsLoader";

type Candidate = {
  title: string;
  url: string;
  highlights: string[];
};

/**
 * Step 1 helper. As the user types their name, we debounce and ask Exa for
 * candidates. The user picks "this is me" on the matching card and we pull
 * a clean first-person dossier for them, which the wizard appends to their
 * twin context blob and (optionally) pre-fills their avatar.
 */
/**
 * localStorage key — persists the "this is me" choice across remounts so
 * navigating back to step 1 doesn't re-prompt the user to confirm again.
 * Keyed by name so the cache only applies to the same identity.
 */
const SELF_CONFIRMED_KEY = "syncedin.selfDiscovery.confirmed.v1";

type StoredConfirmation = {
  name: string;
  url: string;
};

function loadStoredConfirmation(): StoredConfirmation | null {
  try {
    const raw = localStorage.getItem(SELF_CONFIRMED_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredConfirmation;
    if (parsed && typeof parsed.url === "string" && parsed.url) return parsed;
    return null;
  } catch {
    return null;
  }
}

function saveStoredConfirmation(c: StoredConfirmation) {
  try {
    localStorage.setItem(SELF_CONFIRMED_KEY, JSON.stringify(c));
  } catch {
    /* storage disabled — non-fatal, choice just won't persist */
  }
}

export function SelfDiscovery({
  name,
  onConfirm,
  onAdvance
}: {
  name: string;
  onConfirm: (snippet: string, source: string) => void;
  onAdvance?: () => void;
}) {
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSearched = useRef<string>("");

  // Hydrate persisted confirmation on mount so coming back to step 1
  // doesn't re-run the search or re-prompt. The dossier was already
  // appended to the user's blob on first confirm — we just need to keep
  // showing the ✓ state.
  useEffect(() => {
    const stored = loadStoredConfirmation();
    if (stored && stored.name === name.trim()) {
      setConfirmed(stored.url);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    const trimmed = name.trim();
    if (trimmed.length < 4 || trimmed.split(/\s+/).length < 2 || dismissed) {
      setCandidates(null);
      return;
    }
    // Already confirmed for this exact name — skip the search entirely.
    if (confirmed) {
      setCandidates(null);
      return;
    }
    if (trimmed === lastSearched.current) return;
    debounce.current = setTimeout(() => {
      lastSearched.current = trimmed;
      runSearch(trimmed);
    }, 700);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, dismissed, confirmed]);

  async function runSearch(q: string) {
    setSearching(true);
    setError(null);
    try {
      const r = await fetch("/api/exa-self-research", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: q })
      });
      const j = await r.json();
      if (j.candidates) {
        setCandidates(j.candidates.slice(0, 5));
      } else {
        setCandidates([]);
      }
    } catch {
      setError("Couldn't reach the web. You can keep going manually.");
    } finally {
      setSearching(false);
    }
  }

  function confirmCandidate(c: Candidate) {
    // Optimistic confirm: seed the blob with what we already know from
    // the candidate highlights so the user gets instant feedback, persist
    // the choice so a re-mount doesn't re-prompt, then advance to the
    // next step. The richer dossier fetch happens in the background and
    // appends a second snippet when it returns. The user no longer has
    // to wait staring at the spinner — clicking "this is me" is
    // committed in one motion.
    setError(null);
    setConfirmed(c.url);
    saveStoredConfirmation({ name: name.trim(), url: c.url });

    // Build a fast snippet from the highlights so the blob is non-empty
    // immediately. Server fetch may return a richer dossier that we
    // append on top.
    const quickSnippet = `${c.title}\n\n${(c.highlights || [])
      .filter(Boolean)
      .join("\n\n")}`.trim();
    if (quickSnippet) {
      onConfirm(quickSnippet, c.url);
    }

    // Advance the wizard immediately — don't gate forward motion on a
    // network round-trip.
    if (onAdvance) onAdvance();

    // Background fetch — enrich the blob with the full dossier when it
    // arrives. If it fails, we already have the quick snippet so the
    // user isn't blocked.
    setConfirming(c.url);
    (async () => {
      try {
        const r = await fetch("/api/exa-self-research", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name,
            confirmed_url: c.url,
            confirmed_title: c.title,
            confirmed_highlights: c.highlights
          })
        });
        const j = await r.json();
        if (j.dossier && j.dossier.trim() !== quickSnippet.trim()) {
          // Use a distinct source string so the wizard doesn't dedupe
          // the enrichment against the quick snippet.
          onConfirm(j.dossier, `${c.url}#dossier`);
        }
      } catch {
        /* quick snippet is already in the blob — nothing more to do */
      } finally {
        setConfirming(null);
      }
    })();
  }

  if (dismissed || confirmed) {
    return confirmed ? (
      <div
        className="retro-panel p-3 text-sm"
        style={{
          borderColor: "var(--green)",
          color: "var(--text)",
          marginTop: 16
        }}
      >
        ✓ Pulled your public footprint. The dossier is in your context now —
        you can review and edit it on the next step.
      </div>
    ) : null;
  }

  if (name.trim().split(/\s+/).length < 2) return null;

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between">
        <div className="retro-label">is this you?</div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="retro-dim text-xs hover:text-white"
        >
          skip
        </button>
      </div>

      {searching && (
        <div
          className="retro-panel p-3 text-sm mt-2"
          style={{ color: "var(--text-dim)" }}
        >
          <DotsLoader label="Looking you up on the web" />
        </div>
      )}

      {!searching && candidates && candidates.length === 0 && (
        <p className="text-sm mt-2" style={{ color: "var(--text-dim)" }}>
          No public matches yet. That&apos;s fine — keep going and add
          context yourself.
        </p>
      )}

      {!searching && candidates && candidates.length > 0 && (
        <ul className="mt-2 space-y-2">
          {candidates.map((c) => {
            const preview = c.highlights?.[0]
              ? c.highlights[0].length > 130
                ? c.highlights[0].slice(0, 130) + "…"
                : c.highlights[0]
              : "";
            const isLoading = confirming === c.url;
            return (
              <li
                key={c.url}
                className="retro-panel retro-panel-hover p-3 flex items-start gap-3"
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="font-semibold text-sm">{c.title}</div>
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="retro-dim text-xs underline mt-0.5 inline-block"
                    style={{ wordBreak: "break-all" }}
                  >
                    {c.url}
                  </a>
                  {preview && (
                    <p
                      className="text-xs mt-1"
                      style={{ color: "var(--text-dim)" }}
                    >
                      {preview}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => confirmCandidate(c)}
                  disabled={!!confirming}
                  className="retro-btn retro-btn-primary text-sm shrink-0"
                >
                  {isLoading ? (
                    <DotsLoader label="pulling" />
                  ) : (
                    "✓ this is me"
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {error && (
        <p
          className="text-xs mt-2 retro-panel p-2"
          style={{ borderColor: "var(--red)", color: "var(--red)" }}
        >
          {error}
        </p>
      )}
    </div>
  );
}
