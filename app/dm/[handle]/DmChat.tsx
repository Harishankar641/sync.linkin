"use client";

import { useEffect, useRef, useState } from "react";
import { MicButton } from "../../MicButton";

type Msg = { id?: string; role: "visitor" | "twin" | "creator"; body: string };

const STORE_PREFIX = "syncedin_dm_thread_v1::";

/**
 * Public DM chat (#279). Mobile-first by mandate — every dimension
 * tuned for a single-thumb iOS Safari experience first; desktop is the
 * graceful upscale, not the primary target.
 *
 * Visitor sees:
 *  - Creator header (avatar + name + "real reply" link in chat header)
 *  - Empty state with 3 example prompts to tap-and-go
 *  - iMessage-style bubbles (visitor right, twin left)
 *  - Sticky bottom composer always reachable by the keyboard
 *
 * State is stored per-creator in localStorage so refreshes / returning
 * visits resume the same thread.
 */
export function DmChat({
  creatorHandle,
  creatorName,
  creatorAvatarUrl
}: {
  creatorHandle: string;
  creatorName: string;
  creatorAvatarUrl: string | null;
}) {
  const storeKey = STORE_PREFIX + creatorHandle.toLowerCase();
  const [threadId, setThreadId] = useState<string | null>(null);
  const [visitorToken, setVisitorToken] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // Email capture state — surfaced after 2 visitor turns, gates the 3rd.
  const [email, setEmail] = useState("");
  const [emailCaptured, setEmailCaptured] = useState(false);
  const [needsEmail, setNeedsEmail] = useState(false);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);

  // Restore prior session on mount.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storeKey);
      if (!raw) return;
      const stored = JSON.parse(raw) as {
        thread_id: string;
        visitor_token: string;
        messages: Msg[];
        email?: string;
      };
      setThreadId(stored.thread_id);
      setVisitorToken(stored.visitor_token);
      setMessages(stored.messages ?? []);
      if (stored.email) {
        setEmail(stored.email);
        setEmailCaptured(true);
      }
    } catch {
      /* corrupt local state — ignore, start fresh */
    }
  }, [storeKey]);

  // Persist after every change.
  useEffect(() => {
    if (!threadId || !visitorToken) return;
    try {
      window.localStorage.setItem(
        storeKey,
        JSON.stringify({
          thread_id: threadId,
          visitor_token: visitorToken,
          messages,
          email: emailCaptured ? email : undefined
        })
      );
    } catch {
      /* quota or private mode — non-fatal */
    }
  }, [storeKey, threadId, visitorToken, messages, email, emailCaptured]);

  // Scroll to bottom on new message.
  useEffect(() => {
    scrollerRef.current?.scrollTo({
      top: scrollerRef.current.scrollHeight,
      behavior: "smooth"
    });
  }, [messages.length, busy]);

  // After 2 visitor turns, if no email captured, surface the prompt.
  useEffect(() => {
    const visitorCount = messages.filter((m) => m.role === "visitor").length;
    if (visitorCount >= 2 && !emailCaptured) {
      setNeedsEmail(true);
    }
  }, [messages, emailCaptured]);

  async function send(initialBody?: string) {
    const body = (initialBody ?? text).trim();
    if (!body || busy) return;
    // Gate the 3rd send on email if we asked for it.
    if (needsEmail && !emailCaptured) {
      composerRef.current?.focus();
      return;
    }
    setBusy(true);
    setErr(null);
    setMessages((prev) => [...prev, { role: "visitor", body }]);
    setText("");
    try {
      if (!threadId || !visitorToken) {
        // First turn — START thread + get reply in one round trip.
        const res = await fetch("/api/dm/start", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            creator_handle: creatorHandle,
            message: body,
            visitor_email: emailCaptured ? email : undefined
          })
        });
        const j = await res.json();
        if (!res.ok || j.error) {
          setErr(j.detail || j.error || "Couldn't reach the twin.");
          return;
        }
        setThreadId(j.thread_id);
        setVisitorToken(j.visitor_token);
        // Replace the optimistic-then-reply pair with the server-truth.
        setMessages(j.messages);
      } else {
        // Continuation.
        const res = await fetch("/api/dm/respond", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            thread_id: threadId,
            visitor_token: visitorToken,
            message: body,
            visitor_email: emailCaptured ? email : undefined
          })
        });
        const j = await res.json();
        if (!res.ok || j.error) {
          setErr(j.detail || j.error || "Couldn't reach the twin.");
          return;
        }
        setMessages((prev) => [...prev, j.twin_reply]);
      }
    } catch (e: any) {
      setErr(e?.message ?? "Network error.");
    } finally {
      setBusy(false);
    }
  }

  function submitEmail() {
    const e = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(e)) return;
    setEmailCaptured(true);
    setNeedsEmail(false);
  }

  const empty = messages.length === 0;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100dvh",
        width: "100%",
        background: "var(--bg, #f4f5fa)",
        color: "var(--text, #0e1322)"
      }}
    >
      {/* HEADER — sticky, slim, creator identity + boost hint */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          background: "var(--panel-solid, #fff)",
          borderBottom: "1px solid var(--border, #e2e6f0)",
          padding: "10px 14px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          minHeight: 56
        }}
      >
        {creatorAvatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={creatorAvatarUrl}
            alt={creatorName}
            width={36}
            height={36}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              objectFit: "cover",
              border: "1px solid var(--border, #e2e6f0)"
            }}
          />
        ) : (
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              background:
                "linear-gradient(135deg, #2358ff 0%, #6b2dc9 100%)",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 800,
              fontSize: 14
            }}
          >
            {creatorName.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.1 }}>
            {creatorName}'s AI Twin
          </div>
          <div
            style={{
              fontSize: 11,
              color: "var(--text-dim, #6e768c)",
              lineHeight: 1.2
            }}
          >
            free AI reply · paid human reply
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            // Placeholder until Stripe ships — soft surface.
            alert(
              "Boost coming soon — your message will jump to the top of " +
                creatorName +
                "'s inbox."
            );
          }}
          style={{
            padding: "6px 12px",
            borderRadius: 999,
            border: "none",
            background:
              "linear-gradient(135deg, #ffb800 0%, #ff7a00 100%)",
            color: "#fff",
            fontSize: 12,
            fontWeight: 800,
            cursor: "pointer",
            whiteSpace: "nowrap"
          }}
        >
          ⚡ Boost
        </button>
      </header>

      {/* SCROLLER — flex:1 so it fills between header + composer */}
      <div
        ref={scrollerRef}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px 14px 20px",
          display: "flex",
          flexDirection: "column",
          gap: 10
        }}
      >
        {empty && (
          <div style={{ marginTop: "auto", marginBottom: 24 }}>
            <div
              style={{
                fontSize: 14,
                lineHeight: 1.5,
                color: "var(--text-dim, #6e768c)",
                marginBottom: 14
              }}
            >
              Hi — I'm {creatorName}'s AI twin. I can explain their work,
              recommend their links, or route you to the best way to
              connect. Try:
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8
              }}
            >
              {[
                `What is ${creatorName} building right now?`,
                `How can I work with ${creatorName}?`,
                `What should I send ${creatorName}?`
              ].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => send(p)}
                  disabled={busy}
                  style={{
                    textAlign: "left",
                    padding: "12px 14px",
                    borderRadius: 12,
                    border: "1px solid var(--border, #e2e6f0)",
                    background: "var(--panel-solid, #fff)",
                    color: "var(--text, #0e1322)",
                    fontSize: 14,
                    cursor: "pointer"
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <Bubble key={m.id ?? `i-${i}`} m={m} />
        ))}
        {busy && (
          <div
            style={{
              alignSelf: "flex-start",
              fontSize: 12,
              color: "var(--text-dim, #6e768c)",
              padding: "4px 8px"
            }}
          >
            {creatorName}'s twin is typing…
          </div>
        )}
        {err && (
          <div
            style={{
              alignSelf: "flex-start",
              fontSize: 12,
              color: "#ef4444",
              padding: "4px 8px"
            }}
          >
            {err}
          </div>
        )}
      </div>

      {/* EMAIL CAPTURE — surfaces after 2 visitor turns, gates the 3rd */}
      {needsEmail && !emailCaptured && (
        <div
          style={{
            borderTop: "1px solid var(--border, #e2e6f0)",
            background: "var(--panel-solid, #fff)",
            padding: "10px 14px"
          }}
        >
          <div
            style={{
              fontSize: 12,
              color: "var(--text-dim, #6e768c)",
              marginBottom: 6
            }}
          >
            Quick — what email should {creatorName} use to reach you if
            this lands?
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              type="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@gmail.com"
              style={{
                flex: 1,
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid var(--border, #e2e6f0)",
                fontSize: 14,
                background: "var(--bg, #f4f5fa)"
              }}
            />
            <button
              type="button"
              onClick={submitEmail}
              disabled={!/^\S+@\S+\.\S+$/.test(email)}
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                border: "none",
                background: "#2358ff",
                color: "#fff",
                fontWeight: 700,
                fontSize: 14,
                cursor: "pointer",
                opacity: /^\S+@\S+\.\S+$/.test(email) ? 1 : 0.55
              }}
            >
              ok
            </button>
          </div>
        </div>
      )}

      {/* COMPOSER — sticky bottom, sized to thumb */}
      <div
        style={{
          borderTop: "1px solid var(--border, #e2e6f0)",
          background: "var(--panel-solid, #fff)",
          padding: "10px 12px",
          paddingBottom: "calc(10px + env(safe-area-inset-bottom, 0px))",
          display: "flex",
          gap: 8,
          alignItems: "flex-end"
        }}
      >
        <textarea
          ref={composerRef}
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 4000))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder={`Message ${creatorName}'s twin…`}
          rows={1}
          style={{
            flex: 1,
            padding: "10px 12px",
            borderRadius: 18,
            border: "1px solid var(--border, #e2e6f0)",
            background: "var(--bg, #f4f5fa)",
            color: "var(--text, #0e1322)",
            fontSize: 15,
            lineHeight: 1.35,
            minHeight: 40,
            maxHeight: 140,
            resize: "none",
            outline: "none"
          }}
        />
        <MicButton
          onText={(chunk) =>
            setText((t) => `${t}${t && !t.endsWith(" ") ? " " : ""}${chunk}`)
          }
          ariaLabel={`Dictate message to ${creatorName}'s twin`}
          size={40}
        />
        <button
          type="button"
          onClick={() => send()}
          disabled={busy || !text.trim()}
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            border: "none",
            background:
              busy || !text.trim()
                ? "var(--border, #e2e6f0)"
                : "linear-gradient(135deg, #2358ff 0%, #6b2dc9 100%)",
            color: "#fff",
            fontSize: 18,
            cursor: busy ? "wait" : "pointer",
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          ↑
        </button>
      </div>
    </div>
  );
}

function Bubble({ m }: { m: Msg }) {
  const mine = m.role === "visitor";
  return (
    <div
      style={{
        alignSelf: mine ? "flex-end" : "flex-start",
        maxWidth: "min(86%, 560px)"
      }}
    >
      <div
        style={{
          padding: "10px 14px",
          borderRadius: 18,
          background: mine
            ? "linear-gradient(135deg, #2358ff 0%, #4a3dff 100%)"
            : "var(--panel-solid, #fff)",
          color: mine ? "#fff" : "var(--text, #0e1322)",
          border: mine ? "none" : "1px solid var(--border, #e2e6f0)",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          fontSize: 15,
          lineHeight: 1.45
        }}
      >
        {linkify(m.body)}
      </div>
    </div>
  );
}

// Minimal linkifier — twin replies often include the creator's
// existing offer URLs; we want them clickable inline.
function linkify(text: string): React.ReactNode {
  const re = /(https?:\/\/[^\s)]+)/g;
  const out: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const url = m[1];
    out.push(
      <a
        key={`${i++}-${url}`}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: "inherit", textDecoration: "underline" }}
      >
        {url}
      </a>
    );
    last = m.index + url.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
