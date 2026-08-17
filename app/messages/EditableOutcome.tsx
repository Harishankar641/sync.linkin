"use client";

import { useRef, useState } from "react";
import { track } from "@/lib/track";

/**
 * EditableOutcome — the proposal outcome shown on each Messages row,
 * directly editable in place (Jack: "make this an editable text box … I
 * don't even need to click edit"). Auto-saves on blur via the same
 * change-proposal endpoint. Locks to read-only once the user has accepted
 * ("unless it's accepted").
 */
export function EditableOutcome({
  conversationId,
  initialText,
  accepted,
  sealed = false
}: {
  conversationId: string;
  initialText: string;
  accepted: boolean;
  /** BOTH sides accepted. Receipts can only be published on sealed deals. */
  sealed?: boolean;
}) {
  const [text, setText] = useState(initialText);
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const saved = useRef(initialText);

  if (accepted) {
    return (
      <div style={{ marginTop: 6 }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "var(--green)"
          }}
        >
          ✓ accepted outcome
        </div>
        <div className="text-xs mt-0.5" style={{ lineHeight: 1.45 }}>
          {initialText}
        </div>
        {sealed && <PublishWin conversationId={conversationId} />}
      </div>
    );
  }

  async function save() {
    const next = text.trim();
    if (!next || next === saved.current.trim()) return;
    setState("saving");
    try {
      const res = await fetch(
        `/api/conversations/${conversationId}/change-proposal`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text: next })
        }
      );
      if (!res.ok) throw new Error();
      saved.current = next;
      setState("saved");
      setTimeout(() => setState("idle"), 1600);
    } catch {
      setState("idle");
    }
  }

  return (
    <div
      style={{ marginTop: 6 }}
      // Keep clicks/typing here from triggering the row's navigation.
      onClick={(e) => e.stopPropagation()}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--amber-bright)",
          display: "flex",
          alignItems: "center",
          gap: 6
        }}
      >
        ✎ editable outcome
        {state === "saving" && (
          <span style={{ color: "var(--text-dim)", fontWeight: 600 }}>
            saving…
          </span>
        )}
        {state === "saved" && (
          <span style={{ color: "var(--green)", fontWeight: 700 }}>saved ✓</span>
        )}
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={save}
        rows={Math.min(6, Math.max(2, Math.ceil(text.length / 70)))}
        className="retro-input"
        style={{
          marginTop: 4,
          fontSize: 13,
          lineHeight: 1.45,
          width: "100%",
          resize: "vertical"
        }}
      />
    </div>
  );
}

/**
 * PublishWin — proof-of-outcome publisher, shown only on ACCEPTED
 * outcomes. One click, explicit named/anonymous choice, lands on the
 * public /wins page. Server re-verifies the caller is a participant.
 */
function PublishWin({ conversationId }: { conversationId: string }) {
  const [mode, setMode] = useState<
    "idle" | "choose" | "busy" | "done" | "fail"
  >("idle");
  const [msg, setMsg] = useState("");

  async function publish(anonymize: boolean) {
    setMode("busy");
    try {
      const res = await fetch("/api/wins/publish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ conversationId, anonymize })
      });
      const j = await res.json().catch(() => ({}) as any);
      if (!res.ok) {
        setMsg(j?.detail || "Couldn't publish, try again.");
        setMode("fail");
        return;
      }
      track("win_published", { anonymize });
      setMode("done");
    } catch {
      setMsg("Couldn't publish, try again.");
      setMode("fail");
    }
  }

  if (mode === "done") {
    return (
      <a
        href="/wins"
        className="text-[11px]"
        style={{
          display: "inline-block",
          marginTop: 6,
          color: "var(--green)",
          textDecoration: "none",
          fontWeight: 700
        }}
      >
        ✓ live on syncedin.org/wins →
      </a>
    );
  }
  if (mode === "busy") {
    return (
      <div className="text-[11px] mt-1.5" style={{ color: "var(--text-dim)" }}>
        publishing…
      </div>
    );
  }
  if (mode === "choose") {
    return (
      <div
        className="text-[11px] mt-1.5"
        style={{ display: "flex", gap: 8, alignItems: "center" }}
      >
        <span style={{ color: "var(--text-dim)" }}>publish as:</span>
        <button
          type="button"
          onClick={() => publish(false)}
          style={{
            background: "transparent",
            border: "1px solid var(--border)",
            borderRadius: 999,
            padding: "2px 10px",
            cursor: "pointer",
            color: "var(--text)",
            fontWeight: 700,
            fontSize: 11
          }}
        >
          with names
        </button>
        <button
          type="button"
          onClick={() => publish(true)}
          style={{
            background: "transparent",
            border: "1px solid var(--border)",
            borderRadius: 999,
            padding: "2px 10px",
            cursor: "pointer",
            color: "var(--text)",
            fontWeight: 700,
            fontSize: 11
          }}
        >
          anonymous
        </button>
        <button
          type="button"
          onClick={() => setMode("idle")}
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: "var(--text-dim)",
            fontSize: 11
          }}
        >
          cancel
        </button>
      </div>
    );
  }
  return (
    <div className="mt-1.5">
      <button
        type="button"
        onClick={() => setMode("choose")}
        className="text-[11px]"
        style={{
          background: "transparent",
          border: "none",
          padding: 0,
          cursor: "pointer",
          color: "var(--amber-bright)",
          fontWeight: 700
        }}
      >
        Publish this win → public receipt on /wins
      </button>
      {mode === "fail" && (
        <span
          className="text-[11px]"
          style={{ marginLeft: 8, color: "var(--red, #ef4444)" }}
        >
          {msg}
        </span>
      )}
    </div>
  );
}
