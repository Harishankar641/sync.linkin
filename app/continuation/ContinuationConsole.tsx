"use client";

import { useRef, useState } from "react";

type ContinuationLine = { speaker: string; body: string };

type ApiResult = {
  ok?: boolean;
  format?: string;
  you_name?: string | null;
  other_name?: string | null;
  continuation?: ContinuationLine[];
  raw_text?: string;
  error?: string;
  detail?: string;
};

/**
 * Per-platform export instructions. Most users have NEVER exported a
 * chat thread before — without explicit instructions this whole feature
 * is invisible. Jack: "we need to explain how to export easiest all the
 * chats from each place."
 */
const EXPORT_GUIDES: Array<{
  key: string;
  label: string;
  steps: string[];
  hint?: string;
}> = [
  {
    key: "imessage",
    label: "iMessage / Messages (Mac)",
    steps: [
      "Open Messages on your Mac (signed into the same iCloud as your iPhone).",
      "Click into the conversation you want to export.",
      "Select all messages with Cmd+A, then Cmd+C to copy.",
      "Paste into the box above. (Time-stamps + sender names come through.)"
    ],
    hint:
      "Power-user: the free iMazing app exports entire threads as .txt in two clicks — drop the file in below."
  },
  {
    key: "whatsapp",
    label: "WhatsApp",
    steps: [
      "Open the chat on your phone.",
      "Tap the contact name at the top → Export Chat → Without Media.",
      "Choose Mail → send the .txt to yourself, then drop it in the upload field above."
    ]
  },
  {
    key: "telegram",
    label: "Telegram",
    steps: [
      "Telegram Desktop → click the chat → 3-dot menu → Export Chat History.",
      "Choose 'Machine-readable JSON' or 'HTML', uncheck media types you don't need.",
      "Hit Export, then upload the produced file above."
    ]
  },
  {
    key: "sms",
    label: "SMS / Android",
    steps: [
      "Install 'SMS Backup & Restore' on Android (free).",
      "Back up just the conversation you want, choose XML/TXT, save to a file.",
      "Upload the file above. (iOS users: see the iMessage path.)"
    ]
  }
];

/**
 * Client UI for /continuation (#166). Three states: idle (file or paste),
 * generating (spinner), done (render the modeled next-N messages with
 * a Copy + Share affordance).
 */
export function ContinuationConsole() {
  const [yourName, setYourName] = useState("");
  const [pasted, setPasted] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<ApiResult | null>(null);
  // Post-result actions — "save as twin context" + "make shareable link"
  // surface AFTER the continuation lands. State here so the parent
  // controls both the saved-flag and the generated invite URL.
  const [savingContext, setSavingContext] = useState(false);
  const [savedContext, setSavedContext] = useState(false);
  const [makingLink, setMakingLink] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [openedGuide, setOpenedGuide] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  async function run(blob: { file?: File; text?: string }) {
    if (busy) return;
    setBusy(true);
    setErr(null);
    setResult(null);
    try {
      const form = new FormData();
      if (yourName) form.set("your_name", yourName);
      if (blob.file) form.set("file", blob.file);
      if (blob.text) form.set("text", blob.text);
      const res = await fetch("/api/chat-continuation", {
        method: "POST",
        body: form
      });
      const j: ApiResult = await res.json();
      if (!res.ok || j.error) {
        setErr(j.detail || j.error || "Couldn't generate.");
      } else {
        setResult(j);
      }
    } catch (e: any) {
      setErr(e?.message ?? "Network error.");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setResult(null);
    setErr(null);
    setPasted("");
    setSavedContext(false);
    setShareUrl(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  // Save the full transcript + projection into the user's twin context
  // (ai_export_blob). This is Jack's "context import mechanism" lever —
  // every existing chat the user has had becomes deeper twin training.
  async function saveAsTwinContext() {
    if (!result?.continuation?.length || savingContext) return;
    setSavingContext(true);
    const transcript =
      (pasted ? pasted + "\n\n---\n\n" : "") +
      result.continuation
        .map((l) => `${l.speaker}: ${l.body}`)
        .join("\n");
    try {
      const res = await fetch("/api/continuation-save-context", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          transcript_text: transcript,
          other_name: result.other_name ?? null
        })
      });
      if (res.ok) setSavedContext(true);
    } catch {
      /* swallow — keep button enabled for retry */
    } finally {
      setSavingContext(false);
    }
  }

  // Mint a public shareable invite URL pre-loaded with the continuation
  // as the landing-page opener. The other person hits the URL → sees
  // exactly the thread we projected → signs up to make it real.
  async function makeShareableLink() {
    if (!result?.continuation?.length || makingLink) return;
    setMakingLink(true);
    try {
      const res = await fetch("/api/continuation-invite", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          you_name: result.you_name ?? yourName ?? null,
          other_name: result.other_name ?? null,
          original_text: pasted || null,
          continuation_lines: result.continuation
        })
      });
      const j = await res.json();
      if (res.ok && j?.public_url) {
        setShareUrl(j.public_url as string);
      }
    } catch {
      /* swallow */
    } finally {
      setMakingLink(false);
    }
  }

  // Copy the rendered continuation as plain text — useful for sharing
  // directly with the counterpart on whatever platform you talk on.
  async function copyAll() {
    if (!result?.continuation?.length) return;
    const head = `Where this is heading (${result.you_name ?? "you"} ↔ ${
      result.other_name ?? "them"
    }):\n\n`;
    const body = result.continuation
      .map((l) => `${l.speaker}: ${l.body}`)
      .join("\n");
    try {
      await navigator.clipboard.writeText(head + body);
    } catch {
      /* clipboard may be blocked — copy button just no-ops */
    }
  }

  if (busy) {
    return (
      <div
        className="retro-panel"
        style={{ padding: 20, textAlign: "center" }}
      >
        <div className="text-sm">Reading the thread…</div>
        <div className="retro-dim text-xs mt-2">
          Modeling both voices, projecting the next moves.
        </div>
      </div>
    );
  }

  if (result?.continuation?.length) {
    const isMe = (s: string) =>
      result.you_name && s.toLowerCase() === result.you_name.toLowerCase();
    return (
      <div className="retro-panel" style={{ padding: 16 }}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="retro-label">where it goes next</div>
            <div className="text-sm font-semibold mt-1">
              {result.you_name ?? "you"} ↔ {result.other_name ?? "them"}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={copyAll}
              className="retro-btn text-xs"
            >
              Copy all
            </button>
            <button
              type="button"
              onClick={reset}
              className="retro-btn text-xs"
            >
              Start over
            </button>
          </div>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            maxHeight: "62dvh",
            overflowY: "auto",
            padding: 4
          }}
        >
          {result.continuation.map((line, i) => {
            const mine = isMe(line.speaker);
            return (
              <div
                key={i}
                style={{
                  alignSelf: mine ? "flex-end" : "flex-start",
                  maxWidth: "min(86%, 560px)"
                }}
              >
                <div
                  className="retro-dim text-[10px]"
                  style={{ textAlign: mine ? "right" : "left", marginBottom: 2 }}
                >
                  {line.speaker}
                </div>
                <div
                  style={{
                    padding: "8px 12px",
                    borderRadius: 14,
                    background: mine
                      ? "var(--blue, #2358ff)"
                      : "var(--panel-solid)",
                    color: mine ? "#fff" : "var(--text)",
                    border: mine ? "none" : "1px solid var(--border)",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    fontSize: 14,
                    lineHeight: 1.45
                  }}
                >
                  {line.body}
                </div>
              </div>
            );
          })}
        </div>
        {/* POST-RESULT ACTIONS — context import + viral shareable link.
            Jack: "this is also a context import mechanism and just one that
            provides a lot of shareable links." */}
        <div
          className="mt-4 pt-3 flex flex-wrap items-center gap-2"
          style={{ borderTop: "1px dashed var(--border)" }}
        >
          <button
            type="button"
            onClick={saveAsTwinContext}
            disabled={savingContext || savedContext}
            className="retro-btn text-xs"
            title="Append this thread + continuation to your twin context so it informs future conversations"
          >
            {savedContext
              ? "✓ saved to twin"
              : savingContext
              ? "Saving…"
              : "◎ Save as twin context"}
          </button>
          <button
            type="button"
            onClick={makeShareableLink}
            disabled={makingLink || !!shareUrl}
            className="retro-btn text-xs"
            title="Generate a public link to share with the other person — they sign up and make this real"
          >
            {shareUrl ? "✓ link ready" : makingLink ? "Generating…" : "↗ Make shareable link"}
          </button>
          {shareUrl && (
            <div
              className="flex items-center gap-2 flex-1 min-w-[260px]"
              style={{
                background: "var(--panel-solid)",
                padding: "6px 10px",
                borderRadius: 8,
                border: "1px solid var(--border)"
              }}
            >
              <code
                style={{
                  fontSize: 12,
                  flex: 1,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap"
                }}
              >
                {shareUrl}
              </code>
              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(shareUrl).catch(() => {})}
                className="retro-btn text-xs"
              >
                Copy
              </button>
            </div>
          )}
        </div>
        <div className="retro-dim text-[11px] mt-3">
          Note: this is a model&apos;s best guess at trajectory based on the
          tone + topics of your real thread. Treat it as a probe — not a
          script — when you actually message them.
        </div>
      </div>
    );
  }

  return (
    <div className="retro-panel" style={{ padding: 16 }}>
      {/* HOW TO EXPORT — collapsible per-platform guide. Most users have
          NEVER exported a chat thread before; without this they bounce. */}
      <details className="mb-4" style={{ background: "var(--panel-solid)", borderRadius: 8, padding: "8px 12px", border: "1px solid var(--border)" }}>
        <summary className="text-sm font-semibold" style={{ cursor: "pointer" }}>
          How to export from iMessage / WhatsApp / Telegram / SMS
        </summary>
        <div className="mt-3 grid sm:grid-cols-2 gap-3">
          {EXPORT_GUIDES.map((g) => (
            <button
              key={g.key}
              type="button"
              onClick={() =>
                setOpenedGuide(openedGuide === g.key ? null : g.key)
              }
              className="text-left"
              style={{
                background:
                  openedGuide === g.key
                    ? "var(--blue, #2358ff)"
                    : "var(--bg)",
                color: openedGuide === g.key ? "#fff" : "var(--text)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "8px 10px",
                fontSize: 13
              }}
            >
              {g.label}
            </button>
          ))}
        </div>
        {openedGuide && (
          <div
            className="mt-3"
            style={{
              background: "var(--bg)",
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid var(--border)"
            }}
          >
            <ol style={{ paddingLeft: 20, fontSize: 13, lineHeight: 1.55 }}>
              {EXPORT_GUIDES.find((g) => g.key === openedGuide)?.steps.map(
                (s, i) => (
                  <li key={i} style={{ marginBottom: 4 }}>
                    {s}
                  </li>
                )
              )}
            </ol>
            {EXPORT_GUIDES.find((g) => g.key === openedGuide)?.hint && (
              <div
                className="retro-dim text-[11px] mt-2"
                style={{ fontStyle: "italic" }}
              >
                {EXPORT_GUIDES.find((g) => g.key === openedGuide)?.hint}
              </div>
            )}
          </div>
        )}
      </details>

      <label className="block">
        <div className="text-sm font-semibold">
          Your name in the conversation (optional but helps)
        </div>
        <input
          value={yourName}
          onChange={(e) => setYourName(e.target.value)}
          placeholder="e.g. Jack"
          className="retro-input mt-1"
        />
      </label>

      <div className="mt-4">
        <div className="text-sm font-semibold">Paste the conversation</div>
        <textarea
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          rows={8}
          placeholder={`[3/14/26, 10:14 AM] Jack: hey i had an idea\n[3/14/26, 10:18 AM] Alex: tell me…`}
          className="retro-input mt-1"
          style={{ fontFamily: "monospace", fontSize: 13 }}
        />
        <div className="flex gap-2 mt-2">
          <button
            type="button"
            onClick={() => run({ text: pasted })}
            disabled={!pasted.trim()}
            className="retro-btn retro-btn-primary text-sm"
          >
            Continue from pasted text
          </button>
        </div>
      </div>

      <div
        className="mt-5 pt-4"
        style={{ borderTop: "1px dashed var(--border)" }}
      >
        <div className="text-sm font-semibold">…or upload an export file</div>
        <div className="retro-dim text-xs mt-1">
          iMessage / WhatsApp / Telegram / SMS — any .txt or .csv export will
          work. We never store the file; it&apos;s processed once and
          discarded.
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".txt,.csv,text/plain,text/csv,.json,application/json"
          className="mt-2 text-sm"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void run({ file: f });
          }}
        />
      </div>

      {err && (
        <div
          className="mt-3 text-xs"
          style={{ color: "var(--red, #d44)" }}
        >
          {err}
        </div>
      )}
    </div>
  );
}
