"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { FeedbackComments } from "./FeedbackComments";

type Post = {
  id: string;
  user_id: string | null;
  author_name: string | null;
  title: string;
  body: string | null;
  category: string;
  created_at: string;
  score: number;
  my_vote: 1 | -1 | null;
  status?: string | null;
  admin_reply?: string | null;
  admin_reply_at?: string | null;
};

const CATEGORIES = [
  { key: "idea", label: "Idea", color: "#3a4dff" },
  { key: "feature", label: "Feature", color: "#5ee5b2" },
  { key: "bug", label: "Bug", color: "#ff6b6b" },
  { key: "other", label: "Other", color: "#a060ff" }
];

// Lifecycle filter tabs at the top of the list. "Open" is the default
// for a normal visitor — "what's being asked for"; "Completed" is the
// proof-of-shipping wall.
const STATUSES: Array<{
  key: "all" | "open" | "in_progress" | "completed";
  label: string;
  color: string;
}> = [
  { key: "all", label: "All", color: "var(--text)" },
  { key: "open", label: "Open", color: "#3a4dff" },
  { key: "in_progress", label: "In progress", color: "#f59e0b" },
  { key: "completed", label: "Completed", color: "#10b981" }
];

function statusMeta(s: string | null | undefined) {
  const v = (s ?? "open").toLowerCase();
  if (v === "completed")
    return { label: "✓ shipped", color: "#10b981", bg: "rgba(16,185,129,0.12)" };
  if (v === "in_progress")
    return {
      label: "↻ in progress",
      color: "#f59e0b",
      bg: "rgba(245,158,11,0.12)"
    };
  return { label: "open", color: "#3a4dff", bg: "rgba(58,77,255,0.12)" };
}

export function FeedbackList({
  signedIn,
  userId,
  isAdmin = false,
  posts
}: {
  signedIn: boolean;
  userId: string | null;
  isAdmin?: boolean;
  posts: Post[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("idea");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voting, setVoting] = useState<string | null>(null);
  const [filter, setFilter] = useState<
    "all" | "open" | "in_progress" | "completed"
  >("all");
  // Optimistic vote state
  const [optimistic, setOptimistic] = useState<
    Record<string, { score: number; my_vote: 1 | -1 | null }>
  >({});
  // Admin reply drafts: keyed by post id. Lets Jack type replies inline
  // without losing state when other posts re-render after vote refresh.
  const [draftReply, setDraftReply] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [adminError, setAdminError] = useState<string | null>(null);

  function viewOf(p: Post) {
    const o = optimistic[p.id];
    return o
      ? { score: o.score, my_vote: o.my_vote }
      : { score: p.score, my_vote: p.my_vote };
  }

  async function submit() {
    if (!title.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const r = await fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: title.trim(), body: body.trim(), category })
      });
      const j = await r.json();
      if (j.error) {
        setError(j.detail || j.error);
        return;
      }
      setTitle("");
      setBody("");
      setCategory("idea");
      router.refresh();
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setSubmitting(false);
    }
  }

  async function vote(post: Post, value: 1 | -1) {
    if (!signedIn) {
      window.location.href = "/login";
      return;
    }
    setVoting(post.id);
    const prevMy = post.my_vote;
    let nextMy: 1 | -1 | null;
    let delta = 0;
    if (prevMy === value) {
      nextMy = null;
      delta = -value;
    } else if (prevMy === null) {
      nextMy = value;
      delta = value;
    } else {
      nextMy = value;
      delta = 2 * value;
    }
    setOptimistic((o) => ({
      ...o,
      [post.id]: { score: post.score + delta, my_vote: nextMy }
    }));
    try {
      await fetch("/api/feedback/vote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ post_id: post.id, value })
      });
      router.refresh();
    } catch {
      setOptimistic((o) => {
        const { [post.id]: _, ...rest } = o;
        return rest;
      });
    } finally {
      setVoting(null);
    }
  }

  async function saveAdmin(post: Post, patch: { reply?: string; status?: string }) {
    setSavingId(post.id);
    setAdminError(null);
    try {
      const r = await fetch("/api/admin/feedback-update", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          post_id: post.id,
          reply: patch.reply,
          status: patch.status
        })
      });
      const j = await r.json();
      if (!r.ok) {
        setAdminError(j.detail || j.error || `HTTP ${r.status}`);
        return;
      }
      // Clear draft if reply was saved, then refresh server data.
      if (typeof patch.reply === "string") {
        setDraftReply((d) => ({ ...d, [post.id]: "" }));
      }
      router.refresh();
    } catch (e: any) {
      setAdminError(e?.message || "Save failed.");
    } finally {
      setSavingId(null);
    }
  }

  // Count per status for the tab pill badges.
  const counts = useMemo(() => {
    const c = { all: posts.length, open: 0, in_progress: 0, completed: 0 };
    for (const p of posts) {
      const s = (p.status ?? "open").toLowerCase();
      if (s === "in_progress") c.in_progress += 1;
      else if (s === "completed") c.completed += 1;
      else c.open += 1;
    }
    return c;
  }, [posts]);

  const visible = useMemo(() => {
    if (filter === "all") return posts;
    return posts.filter((p) => (p.status ?? "open").toLowerCase() === filter);
  }, [posts, filter]);

  return (
    <>
      {/* Admin badge — only Jack sees this. Sits inline so it's obvious
          which session is admin without leaking that info to others. */}
      {isAdmin && (
        <div
          className="mt-4"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "5px 12px",
            borderRadius: 999,
            background: "rgba(245, 158, 11, 0.12)",
            border: "1px solid #f59e0b",
            color: "#f59e0b",
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.12em",
            textTransform: "uppercase"
          }}
        >
          <span aria-hidden="true">★</span> admin · you can reply &amp; mark shipped
        </div>
      )}

      {/* Submission form */}
      <section className="mt-8 retro-panel retro-shadow p-5">
        <div className="retro-label">submit a request</div>
        {!signedIn ? (
          <p
            className="text-sm mt-2"
            style={{ color: "var(--text-dim)" }}
          >
            <a
              href="/login"
              className="underline"
              style={{ color: "var(--amber-bright)" }}
            >
              Sign in
            </a>{" "}
            to post a request or vote.
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, 200))}
              placeholder="A short title — what should we build?"
              className="retro-input"
              maxLength={200}
            />
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value.slice(0, 4000))}
              rows={3}
              placeholder="Optional: any details, why this matters, who it's for."
              className="retro-input"
              maxLength={4000}
            />
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex gap-1.5">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => setCategory(c.key)}
                    className="text-xs"
                    style={{
                      padding: "5px 10px",
                      borderRadius: 999,
                      border: `1.5px solid ${
                        category === c.key ? c.color : "var(--border-bright)"
                      }`,
                      background:
                        category === c.key
                          ? `${c.color}22`
                          : "transparent",
                      color: category === c.key ? c.color : "var(--text-dim)",
                      fontWeight: 700,
                      cursor: "pointer"
                    }}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={submit}
                disabled={submitting || !title.trim()}
                className="retro-btn retro-btn-primary ml-auto"
              >
                {submitting ? "posting…" : "+ post request"}
              </button>
            </div>
            {error && (
              <div
                className="text-xs p-2 retro-panel"
                style={{ borderColor: "var(--red)", color: "var(--red)" }}
              >
                {error}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Filter tabs — group requests by lifecycle so completed items
          read as a "shipped" wall instead of cluttering the active list. */}
      <section className="mt-8">
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
            marginBottom: 14
          }}
        >
          {STATUSES.map((s) => {
            const active = filter === s.key;
            const n = counts[s.key as keyof typeof counts];
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => setFilter(s.key)}
                style={{
                  padding: "7px 14px",
                  borderRadius: 999,
                  border: `1.5px solid ${
                    active ? s.color : "var(--border-bright)"
                  }`,
                  background: active ? `${s.color}1f` : "transparent",
                  color: active ? s.color : "var(--text-dim)",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8
                }}
              >
                <span>{s.label}</span>
                <span
                  style={{
                    fontSize: 10,
                    padding: "1px 7px",
                    borderRadius: 999,
                    background: active ? s.color : "var(--panel-2)",
                    color: active ? "#fff" : "var(--text-dim)",
                    fontWeight: 800
                  }}
                >
                  {n}
                </span>
              </button>
            );
          })}
        </div>

        <div className="retro-label flex items-baseline justify-between">
          <span>community requests · sorted by upvotes</span>
          <span
            className="text-xs font-normal"
            style={{ color: "var(--text-dim)", letterSpacing: 0 }}
          >
            {visible.length} of {posts.length}
          </span>
        </div>

        {adminError && (
          <div
            className="mt-3 text-xs p-3 retro-panel whitespace-pre-wrap"
            style={{ borderColor: "var(--red)", color: "var(--red)" }}
          >
            {adminError}
          </div>
        )}

        {visible.length === 0 ? (
          <p
            className="mt-5 text-sm"
            style={{ color: "var(--text-dim)" }}
          >
            Nothing here yet.
          </p>
        ) : (
          <ul className="mt-5 space-y-3">
            {visible.map((p) => {
              const view = viewOf(p);
              const cat =
                CATEGORIES.find((c) => c.key === p.category) ?? CATEGORIES[0];
              const sm = statusMeta(p.status);
              const isMine = !!userId && p.user_id === userId;
              const draft = draftReply[p.id] ?? "";
              return (
                <li
                  key={p.id}
                  className="retro-panel p-4 flex items-stretch gap-4"
                >
                  {/* Vote column */}
                  <div className="flex flex-col items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => vote(p, 1)}
                      disabled={voting === p.id}
                      aria-label="upvote"
                      style={{
                        background: "transparent",
                        border: 0,
                        padding: 0,
                        cursor: "pointer",
                        color:
                          view.my_vote === 1
                            ? "var(--amber-bright)"
                            : "var(--text-dim)",
                        fontSize: 22,
                        lineHeight: 1
                      }}
                    >
                      ▲
                    </button>
                    <div
                      style={{
                        fontWeight: 800,
                        fontSize: 16,
                        fontFamily:
                          '"IBM Plex Mono", ui-monospace, monospace',
                        color:
                          view.score > 0
                            ? "var(--text)"
                            : view.score < 0
                            ? "var(--red)"
                            : "var(--text-dim)"
                      }}
                    >
                      {view.score > 0 ? `+${view.score}` : view.score}
                    </div>
                    <button
                      type="button"
                      onClick={() => vote(p, -1)}
                      disabled={voting === p.id}
                      aria-label="downvote"
                      style={{
                        background: "transparent",
                        border: 0,
                        padding: 0,
                        cursor: "pointer",
                        color:
                          view.my_vote === -1
                            ? "var(--red)"
                            : "var(--text-dim)",
                        fontSize: 22,
                        lineHeight: 1
                      }}
                    >
                      ▼
                    </button>
                  </div>

                  {/* Post body */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="text-[10px]"
                        style={{
                          padding: "2px 8px",
                          borderRadius: 4,
                          background: `${cat.color}22`,
                          color: cat.color,
                          fontWeight: 700,
                          letterSpacing: "0.08em",
                          textTransform: "uppercase"
                        }}
                      >
                        {cat.label}
                      </span>
                      <span
                        className="text-[10px]"
                        style={{
                          padding: "2px 8px",
                          borderRadius: 4,
                          background: sm.bg,
                          color: sm.color,
                          fontWeight: 700,
                          letterSpacing: "0.08em",
                          textTransform: "uppercase"
                        }}
                      >
                        {sm.label}
                      </span>
                      <span
                        className="text-[11px]"
                        style={{ color: "var(--text-dim)" }}
                      >
                        {p.author_name || "anon"} ·{" "}
                        {new Date(p.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <div
                      className="font-semibold text-base mt-1.5"
                      style={{ color: "var(--text)" }}
                    >
                      {p.title}
                    </div>
                    {p.body && (
                      <div
                        className="text-sm mt-1.5 whitespace-pre-wrap"
                        style={{ color: "var(--text-dim)" }}
                      >
                        {p.body}
                      </div>
                    )}

                    {/* Existing admin reply — shown to EVERYONE so the
                        original poster + the community see how Jack
                        responded. Distinctive gold border so it reads
                        as the canonical answer, not just a comment.
                        Labelled "ADMIN INTELLIGENCE" per Jack's rename:
                        positions Jack's responses as the canonical
                        roadmap signal, not just a personal note. */}
                    {p.admin_reply && (
                      <div
                        className="mt-3"
                        style={{
                          padding: "10px 12px",
                          borderRadius: 10,
                          background: "rgba(245, 158, 11, 0.08)",
                          border: "1px solid rgba(245, 158, 11, 0.45)",
                          color: "var(--text)",
                          fontSize: 13,
                          lineHeight: 1.5
                        }}
                      >
                        <div
                          style={{
                            fontSize: 10,
                            fontWeight: 800,
                            letterSpacing: "0.12em",
                            textTransform: "uppercase",
                            color: "#f59e0b",
                            marginBottom: 5,
                            display: "flex",
                            alignItems: "center",
                            gap: 6
                          }}
                        >
                          <span aria-hidden="true">★</span>
                          <span>admin intelligence</span>
                          {isMine && (
                            <span
                              style={{
                                color: "var(--text-dim)",
                                fontWeight: 600,
                                letterSpacing: 0,
                                textTransform: "none"
                              }}
                            >
                              · replying to you
                            </span>
                          )}
                          {p.admin_reply_at && (
                            <span
                              style={{
                                color: "var(--text-dim)",
                                fontWeight: 400,
                                marginLeft: "auto",
                                letterSpacing: 0,
                                textTransform: "none"
                              }}
                            >
                              {new Date(p.admin_reply_at).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        <div style={{ whiteSpace: "pre-wrap" }}>
                          {p.admin_reply}
                        </div>
                      </div>
                    )}

                    {/* Community comments — anyone signed in can reply.
                        Mounted below admin intelligence so the canonical
                        answer reads first, the open thread reads under
                        it. Comments + form lazy-mount per post. */}
                    <FeedbackComments
                      postId={p.id}
                      signedIn={signedIn}
                      userId={userId}
                      adminIsViewer={isAdmin}
                    />


                    {/* Admin-only controls — reply textarea + status
                        buttons. Hidden from every non-Jack viewer. */}
                    {isAdmin && (
                      <div
                        className="mt-3"
                        style={{
                          padding: 10,
                          borderRadius: 10,
                          background: "var(--panel-2)",
                          border: "1px dashed var(--border-bright)"
                        }}
                      >
                        <div
                          style={{
                            fontSize: 10,
                            fontWeight: 800,
                            letterSpacing: "0.12em",
                            textTransform: "uppercase",
                            color: "var(--text-dim)",
                            marginBottom: 6
                          }}
                        >
                          admin controls
                        </div>
                        <textarea
                          value={draft}
                          onChange={(e) =>
                            setDraftReply((d) => ({
                              ...d,
                              [p.id]: e.target.value.slice(0, 4000)
                            }))
                          }
                          rows={2}
                          placeholder={
                            p.admin_reply
                              ? "Edit your reply…"
                              : "Reply publicly to this request…"
                          }
                          className="retro-input"
                          style={{ fontSize: 13 }}
                        />
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: 6,
                            marginTop: 8,
                            alignItems: "center"
                          }}
                        >
                          <button
                            type="button"
                            onClick={() =>
                              saveAdmin(p, { reply: draft })
                            }
                            disabled={
                              savingId === p.id ||
                              (draft.trim().length === 0 &&
                                !p.admin_reply)
                            }
                            className="retro-btn retro-btn-primary"
                            style={{ fontSize: 12, padding: "6px 12px" }}
                          >
                            {savingId === p.id ? "saving…" : "save reply"}
                          </button>
                          <span
                            style={{
                              marginLeft: 4,
                              fontSize: 10,
                              color: "var(--text-dim)",
                              letterSpacing: "0.1em",
                              textTransform: "uppercase"
                            }}
                          >
                            status
                          </span>
                          {(["open", "in_progress", "completed"] as const).map(
                            (s) => {
                              const meta = statusMeta(s);
                              const active = (p.status ?? "open") === s;
                              return (
                                <button
                                  key={s}
                                  type="button"
                                  onClick={() => saveAdmin(p, { status: s })}
                                  disabled={savingId === p.id || active}
                                  style={{
                                    padding: "5px 10px",
                                    borderRadius: 999,
                                    fontSize: 11,
                                    fontWeight: 700,
                                    border: `1px solid ${
                                      active ? meta.color : "var(--border-bright)"
                                    }`,
                                    background: active
                                      ? meta.bg
                                      : "transparent",
                                    color: active ? meta.color : "var(--text-dim)",
                                    cursor:
                                      savingId === p.id || active
                                        ? "default"
                                        : "pointer"
                                  }}
                                >
                                  {meta.label}
                                </button>
                              );
                            }
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
