"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Reusable voice-to-text mic button. Uses the browser-native Web Speech
 * API (`SpeechRecognition` / `webkitSpeechRecognition`) — no third-party
 * dep, no API key, no latency over the network. Works in Chrome, Safari,
 * Edge; gracefully no-ops in Firefox + browsers without support.
 *
 * Behavior:
 *   - Tap to start recording. Mic turns red + pulses.
 *   - Interim transcripts stream while you speak (so the host textarea
 *     reflects your words live). Final transcript replaces the interim
 *     once the recognizer is confident.
 *   - Tap again (or stay silent for ~2s after a pause) to stop.
 *   - All text is appended to the existing value via onTranscript,
 *     prefixed with a space if needed so multi-burst dictation stitches
 *     cleanly.
 *
 * Renders nothing if SpeechRecognition isn't available — the host
 * textarea continues to work normally. Mounts the button inline (host
 * controls positioning).
 */
export function VoiceInputButton({
  value,
  onTranscript,
  size = 28,
  className,
  style,
  title = "Speak instead of type"
}: {
  /** Current value of the input/textarea — used so we can append cleanly */
  value: string;
  /** Called with the new full value (existing + transcribed). */
  onTranscript: (next: string) => void;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
}) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [listening, setListening] = useState(false);
  const [err, setErr] = useState<string>("");
  const recognitionRef = useRef<any>(null);
  // Capture the value at the moment recording started so interim
  // updates don't keep multiplying the existing text.
  const baselineRef = useRef<string>("");

  // Detect support on mount (client-only).
  useEffect(() => {
    if (typeof window === "undefined") {
      setSupported(false);
      return;
    }
    const W = window as any;
    setSupported(Boolean(W.SpeechRecognition || W.webkitSpeechRecognition));
  }, []);

  const stop = useCallback(() => {
    const r = recognitionRef.current;
    if (r) {
      try {
        r.stop();
      } catch {
        /* already stopped */
      }
    }
    setListening(false);
  }, []);

  const start = useCallback(() => {
    if (typeof window === "undefined") return;
    const W = window as any;
    const Ctor = W.SpeechRecognition || W.webkitSpeechRecognition;
    if (!Ctor) return;
    if (listening) {
      stop();
      return;
    }
    setErr("");
    baselineRef.current = value;
    const r = new Ctor();
    r.lang =
      (typeof navigator !== "undefined" && navigator.language) || "en-US";
    r.continuous = true;
    r.interimResults = true;

    r.onresult = (event: any) => {
      let interim = "";
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        if (res.isFinal) final += res[0].transcript;
        else interim += res[0].transcript;
      }
      const combined = (final + interim).trim();
      if (!combined) return;
      // Stitch: append to baseline with a space separator if the
      // baseline doesn't already end in whitespace/punctuation.
      const base = baselineRef.current;
      const needsSpace =
        base.length > 0 && !/[\s\-—]$/.test(base) ? " " : "";
      const next = base + needsSpace + combined;
      onTranscript(next);
      // If a chunk goes final, fold it into baseline so subsequent
      // interim updates layer on top of the committed text, not on
      // top of the original.
      if (final) {
        baselineRef.current = next;
      }
    };
    r.onerror = (e: any) => {
      const code = e?.error || "unknown";
      // "no-speech" + "aborted" are normal user behavior — don't show
      // an error for those, just stop.
      if (code !== "no-speech" && code !== "aborted") {
        setErr(code === "not-allowed" ? "mic blocked" : code);
      }
      setListening(false);
    };
    r.onend = () => {
      setListening(false);
    };

    try {
      r.start();
      recognitionRef.current = r;
      setListening(true);
    } catch (e: any) {
      setErr(e?.message || "couldn't start");
      setListening(false);
    }
  }, [listening, onTranscript, stop, value]);

  // Clean up on unmount so the mic releases.
  useEffect(() => () => stop(), [stop]);

  if (supported === false) return null;

  return (
    <>
      <style>{`
        .vib {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          border: 1px solid var(--border);
          background: var(--panel-2);
          color: var(--text-dim);
          cursor: pointer;
          padding: 0;
          transition: all 0.15s ease;
          line-height: 0;
        }
        .vib:hover {
          color: var(--text);
          border-color: #1f8bff;
        }
        .vib.listening {
          background: linear-gradient(135deg, #ff3b30, #d63029);
          border-color: rgba(255, 59, 48, 0.55);
          color: #fff;
          animation: vib-pulse 1.2s ease-in-out infinite;
        }
        @keyframes vib-pulse {
          0%, 100% {
            box-shadow: 0 0 0 0 rgba(255, 59, 48, 0.6);
          }
          50% {
            box-shadow: 0 0 0 6px rgba(255, 59, 48, 0);
          }
        }
        .vib-err {
          font-size: 10px;
          color: #ef4444;
          margin-left: 6px;
          letter-spacing: 0.02em;
        }
      `}</style>
      <button
        type="button"
        onClick={start}
        title={listening ? "stop dictation" : title}
        aria-label={listening ? "stop dictation" : title}
        className={`vib ${listening ? "listening" : ""} ${className ?? ""}`}
        style={{
          width: size,
          height: size,
          ...style
        }}
      >
        <svg
          width={Math.round(size * 0.5)}
          height={Math.round(size * 0.5)}
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z" />
        </svg>
      </button>
      {err && <span className="vib-err">{err}</span>}
    </>
  );
}

/**
 * Convenience wrapper that positions the mic absolutely in the
 * bottom-right corner of a relatively-positioned host (textarea wrap).
 * Use the bare VoiceInputButton if you want inline placement instead.
 */
export function VoiceInputCornerWrap({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <div style={{ position: "relative" }}>
      {children}
    </div>
  );
}
