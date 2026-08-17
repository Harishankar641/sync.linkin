"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Community comments under a feedback request. Jack: "add the ability
 * for replies on these from general people."
 *
 * Lazy-mounts per post — fetches comments on first render (cheap, one
 * query per post). Signed-in users can post a reply; admins are
 * tagged with a "★ admin" pill so their voice still stands out.
 *
 * Storage: feedback_comments table. Schema-safe — degrades silently
 * if the table doesn't exist yet.
 */

type Comment = {
  id: string;
  user_id: string | null;
  author_name: string | null;
  body: string;
  created_at: string;
  is_admin: boolean;
};

export function FeedbackComments({
  postId,
  signedIn,
  userId,
  adminIsViewer
}: {
  postId: string;
  signedIn: boolean;
  userId: string | null;
  adminIsViewer: boolean;
}) {
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const fetched = useRef(false);

  // Lazy first fetch.
  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(
          `/api/feedback/comments?post_id=${encodeURIComponent(postId)}`,
          { cache: "no-store" }
        );
        if (!r.ok) {
          // 404 / 500 — fail silently. Comments are an enhancement,
          // not the primary content.
          if (!cancelled) setComments([]);
          return;
        }
        const j = await r.json();
        if (!cancelled) setComments(j.comments ?? []);
      } catch {
        if (!cancelled) setComments([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [postId]);

  async function submit() {
    if (!draft.trim() || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/feedback/comments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ post_id: postId, body: draft.trim() })
      });
      const j = await r.json();
      if (!r.ok) {
        throw new Error(j.detail || j.error || `HTTP ${r.status}`);
      }
      // Append the new comment locally so the user sees it instantly
      // (router.refresh would re-fetch the entire feedback page).
      setComments((prev) => [
        ...(prev ?? []),
        {
          id: j.id || `local-${Date.now()}`,
          user_id: userId,
          author_name: j.author_name ?? null,
          body: draft.trim(),
          created_at: new Date().toISOString(),
          is_admin: adminIsViewer
        }
      ]);
      setDraft("");
    } catch (e: any) {
      setErr(e?.message || "Couldn't post the comment.");
    } finally {
      setBusy(false);
    }
  }

  // Don't render the section if there are no comments AND the user
  // can't post one. Keeps the post card compact for anon viewers.
  const isLoading = comments === null;
  const list = comments ?? [];
  if (!isLoading && list.length === 0 && !signedIn) return null;

  return (
    <div
      className="mt-3"
      style={{
        padding: "10px 12px",
        borderRadius: 10,
        border: "1px solid var(--border)",
        background: "var(--panel-2)"
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "var(--text-dim)",
          marginBottom: 8
        }}
      >
        community discussion{list.length > 0 ? ` · ${list.length}` : ""}
      </div>

      {isLoading ? (
        <div style={{ fontSize: 12, color: "var(--text-dim)" }}>
          loading…
        </div>
      ) : list.length === 0 ? (
        <div style={{ fontSize: 12, color: "var(--text-dim)" }}>
          No replies yet. Be the first.
        </div>
      ) : (
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            display: "flex",
            flexDirection: "column",
            gap: 8
          }}
        >
          {list.map((c) => (
            <li
              key={c.id}
              style={{
                padding: "8px 10px",
                borderRadius: 8,
                background: c.is_admin
                  ? "rgba(245, 158, 11, 0.08)"
                  : "var(--panel-solid)",
                border: c.is_admin
                  ? "1px solid rgba(245, 158, 11, 0.35)"
                  : "1px solid var(--border)"
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 3,
                  fontSize: 11
                }}
              >
                <span
                  style={{
                    fontWeight: 700,
                    color: c.is_admin
                      ? "#f59e0b"
                      : "var(--text)"
                  }}
                >
                  {c.author_name || "anon"}
                </span>
                {c.is_admin && (
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 800,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      padding: "1px 6px",
                      borderRadius: 999,
                      background: "rgba(245, 158, 11, 0.15)",
                      color: "#f59e0b"
                    }}
                  >
                    ★ admin
                  </span>
                )}
                <span style={{ color: "var(--text-dim)" }}>
                  · {new Date(c.created_at).toLocaleDateString()}
                </span>
              </div>
              <div
                style={{
                  fontSize: 13,
                  lineHeight: 1.55,
                  color: "var(--text)",
                  whiteSpace: "pre-wrap"
                }}
              >
                {c.body}
              </div>
            </li>
          ))}
        </ul>
      )}

      {signedIn && (
        <div style={{ marginTop: 10 }}>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, 4000))}
            rows={2}
            placeholder="Add your take…"
            className="retro-input"
            style={{ fontSize: 13 }}
          />
          <div
            style={{
              marginTop: 6,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between"
            }}
          >
            <span style={{ fontSize: 11, color: "var(--text-dim)" }}>
              {draft.length}/4000
            </span>
            <button
              type="button"
              onClick={submit}
              disabled={busy || !draft.trim()}
              className="retro-btn retro-btn-primary"
              style={{ fontSize: 12, padding: "6px 12px" }}
            >
              {busy ? "posting…" : "post reply"}
            </button>
          </div>
          {err && (
            <div
              style={{
                marginTop: 6,
                fontSize: 11,
                color: "#ef4444",
                whiteSpace: "pre-wrap"
              }}
            >
              {err}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
