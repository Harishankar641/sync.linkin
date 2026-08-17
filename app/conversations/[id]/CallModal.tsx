"use client";

import { useEffect, useState } from "react";

/**
 * Full-screen call modal. Two iframes side-by-side on desktop, stacked
 * on mobile:
 *  - LEFT: Jitsi Meet (free, no API key). Camera + mic + screenshare +
 *    chat + recording all built in. Both participants land in the
 *    same room because /api/calls/start returns a deterministic-ish
 *    room id for this call.
 *  - RIGHT: tldraw multiplayer canvas — the "context dream board" Jack
 *    asked for. Same room id seeds the same board on both sides.
 *
 * When the user clicks "✓ save context + end call":
 *  - We POST to /api/calls/end with the optional transcript pasted
 *    into the panel. End route appends a "# Call with X on date"
 *    block to BOTH participants' ai_export_blob so their twins
 *    incorporate the call into future negotiations.
 *
 * Why the manual transcript paste (v1)?
 *  - Jitsi public meet exposes a "Start transcription" button that
 *    runs Google Cloud STT in the embedded session; users copy the
 *    transcript out via the recording tray. No server-side recording
 *    pipeline yet.
 *  - Once we move to LiveKit Cloud (or self-host Jitsi with Jibri),
 *    we'll wire a webhook that auto-pushes the transcript so the
 *    user doesn't paste anything.
 */
export function CallModal({
  conversationId,
  otherName,
  kind,
  onClose
}: {
  conversationId: string;
  otherName: string;
  kind: "audio" | "video";
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [callId, setCallId] = useState<string | null>(null);
  const [jitsiUrl, setJitsiUrl] = useState<string | null>(null);
  const [boardUrl, setBoardUrl] = useState<string | null>(null);
  const [transcript, setTranscript] = useState("");
  const [saving, setSaving] = useState(false);
  const [showBoard, setShowBoard] = useState(true);
  // External meeting URL + read.ai bot dispatch state. Users who prefer
  // Zoom / Google Meet / MS Teams over the embedded Jitsi can paste their
  // meeting link and send a read.ai recording bot. Bot transcribes
  // automatically; transcript flows back into both twins on call end.
  const [externalUrl, setExternalUrl] = useState("");
  const [dispatching, setDispatching] = useState(false);
  const [readAiStatus, setReadAiStatus] = useState<string | null>(null);
  const [readAiErr, setReadAiErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/calls/start", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ conversation_id: conversationId, kind })
        });
        const j = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(j.detail || j.error || `HTTP ${res.status}`);
          setLoading(false);
          return;
        }
        setCallId(j.call_id);
        // Append Jitsi config hints to autostart with audio-only when
        // kind === 'audio'. Anyone in the room can re-enable video.
        const cfg =
          kind === "audio"
            ? "#config.startWithVideoMuted=true&config.startAudioOnly=true"
            : "";
        setJitsiUrl(`${j.jitsi_url}${cfg}`);
        setBoardUrl(j.board_url);
        setLoading(false);
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message || "Couldn't start the call.");
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [conversationId, kind]);

  async function dispatchReadAi() {
    if (!callId || !externalUrl.trim()) return;
    setDispatching(true);
    setReadAiErr(null);
    setReadAiStatus(null);
    try {
      const r = await fetch("/api/calls/dispatch-read-ai-bot", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          call_id: callId,
          meeting_url: externalUrl.trim()
        })
      });
      const j = await r.json();
      if (j.ok) {
        setReadAiStatus(
          j.read_ai_meeting_id
            ? `✓ Read AI bot dispatched to ${j.platform.toUpperCase()}. Recording + transcribing in the background.`
            : "✓ Meeting URL saved. Read AI bot dispatch in progress."
        );
      } else {
        setReadAiErr(j.detail || j.error || `HTTP ${r.status}`);
      }
    } catch (e: any) {
      setReadAiErr(e?.message || "Couldn't reach the dispatch endpoint.");
    } finally {
      setDispatching(false);
    }
  }

  async function endCall() {
    if (!callId) {
      onClose();
      return;
    }
    setSaving(true);
    try {
      await fetch("/api/calls/end", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          call_id: callId,
          transcript: transcript.trim() || undefined
        })
      });
    } catch {
      /* fire-and-forget — closing the modal is more important */
    } finally {
      setSaving(false);
      onClose();
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        background: "rgba(8, 11, 24, 0.88)",
        display: "flex",
        flexDirection: "column",
        padding: 12
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 12px",
          color: "#fff"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 18 }}>
            {kind === "audio" ? "□" : "□"}
          </span>
          <span style={{ fontWeight: 700, fontSize: 14 }}>
            {kind === "audio" ? "Audio call" : "Video call"} · with {otherName}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            type="button"
            onClick={() => setShowBoard((v) => !v)}
            style={{
              padding: "6px 12px",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 700,
              background: showBoard ? "rgba(31, 139, 255, 0.18)" : "transparent",
              color: "#fff",
              border: "1px solid rgba(255,255,255,0.2)",
              cursor: "pointer"
            }}
          >
            {showBoard ? "× hide dream board" : "✦ show dream board"}
          </button>
          <button
            type="button"
            onClick={endCall}
            disabled={saving}
            style={{
              padding: "6px 14px",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 800,
              background: "#ef4444",
              color: "#fff",
              border: 0,
              cursor: saving ? "wait" : "pointer"
            }}
          >
            {saving ? "saving…" : "✓ end call"}
          </button>
        </div>
      </div>

      {error && (
        <div
          style={{
            margin: 12,
            padding: 14,
            borderRadius: 10,
            background: "rgba(239, 68, 68, 0.12)",
            border: "1px solid rgba(239, 68, 68, 0.4)",
            color: "#fee",
            fontSize: 13
          }}
        >
          {error}
        </div>
      )}

      {!error && (
        <div
          style={{
            flex: 1,
            display: "grid",
            gap: 10,
            gridTemplateColumns: showBoard ? "minmax(0, 1.4fr) minmax(0, 1fr)" : "minmax(0, 1fr)",
            minHeight: 0
          }}
          className="syncedin-call-grid"
        >
          {/* JITSI ROOM */}
          <div
            style={{
              borderRadius: 14,
              overflow: "hidden",
              background: "#000",
              border: "1px solid rgba(255,255,255,0.08)",
              minHeight: 400
            }}
          >
            {loading ? (
              <div
                style={{
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#888"
                }}
              >
                opening call…
              </div>
            ) : jitsiUrl ? (
              <iframe
                src={jitsiUrl}
                allow="camera; microphone; fullscreen; display-capture; autoplay; clipboard-write"
                style={{ width: "100%", height: "100%", border: 0 }}
                title="Call"
              />
            ) : null}
          </div>

          {/* DREAM BOARD */}
          {showBoard && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                minHeight: 0
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,0.7)",
                  padding: "0 4px"
                }}
              >
                ✦ context dream board
              </div>
              <div
                style={{
                  flex: 1,
                  borderRadius: 14,
                  overflow: "hidden",
                  background: "#fff",
                  border: "1px solid rgba(255,255,255,0.08)",
                  minHeight: 280
                }}
              >
                {boardUrl ? (
                  <iframe
                    src={boardUrl}
                    allow="clipboard-write; clipboard-read"
                    style={{ width: "100%", height: "100%", border: 0 }}
                    title="Dream board"
                  />
                ) : null}
              </div>
              {/* PREFER A REAL MEETING — paste a Zoom / Meet / Teams
                  link to send a read.ai recording bot. Bot joins,
                  transcribes, and the transcript flows back into both
                  twins automatically. Falls back gracefully if the
                  READ_AI_API_KEY env var isn't set. */}
              <div
                style={{
                  padding: 10,
                  borderRadius: 10,
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.12)"
                }}
              >
                <label
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: "rgba(255,255,255,0.65)",
                    display: "block",
                    marginBottom: 4
                  }}
                >
                  □ auto-record a zoom / meet / teams call
                </label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <input
                    type="url"
                    value={externalUrl}
                    onChange={(e) => setExternalUrl(e.target.value)}
                    placeholder="https://meet.google.com/abc-defg-hij"
                    style={{
                      flex: "1 1 200px",
                      minWidth: 0,
                      borderRadius: 8,
                      padding: "8px 10px",
                      fontSize: 12,
                      background: "rgba(255,255,255,0.06)",
                      color: "#fff",
                      border: "1px solid rgba(255,255,255,0.18)"
                    }}
                  />
                  <button
                    type="button"
                    onClick={dispatchReadAi}
                    disabled={dispatching || !externalUrl.trim()}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 700,
                      background:
                        dispatching || !externalUrl.trim()
                          ? "rgba(255,255,255,0.08)"
                          : "linear-gradient(135deg, #1f8bff 0%, #6b2dc9 100%)",
                      color: "#fff",
                      border: 0,
                      cursor:
                        dispatching || !externalUrl.trim() ? "not-allowed" : "pointer"
                    }}
                  >
                    {dispatching ? "sending bot…" : "send read.ai bot"}
                  </button>
                </div>
                {readAiStatus && (
                  <p
                    style={{
                      marginTop: 6,
                      fontSize: 11,
                      color: "#5ee5b2",
                      lineHeight: 1.4
                    }}
                  >
                    {readAiStatus}
                  </p>
                )}
                {readAiErr && (
                  <p
                    style={{
                      marginTop: 6,
                      fontSize: 11,
                      color: "#fca5a5",
                      lineHeight: 1.4,
                      whiteSpace: "pre-wrap"
                    }}
                  >
                    {readAiErr}
                  </p>
                )}
              </div>

              {/* Transcript paste — saved to both twins on end */}
              <div>
                <label
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: "rgba(255,255,255,0.65)",
                    display: "block",
                    marginBottom: 4
                  }}
                >
                  paste transcript / notes before ending
                </label>
                <textarea
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  rows={4}
                  placeholder={
                    "Paste the Jitsi transcript or jot a few bullets — what got decided, what you each committed to, who's doing what next. Saves to BOTH twins so future negotiations have this context."
                  }
                  style={{
                    width: "100%",
                    borderRadius: 10,
                    padding: "10px 12px",
                    fontSize: 12,
                    lineHeight: 1.4,
                    background: "rgba(255,255,255,0.06)",
                    color: "#fff",
                    border: "1px solid rgba(255,255,255,0.18)",
                    resize: "vertical"
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      <style>{`
        @media (max-width: 720px) {
          .syncedin-call-grid {
            grid-template-columns: minmax(0, 1fr) !important;
          }
        }
      `}</style>
    </div>
  );
}
