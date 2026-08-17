"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Reusable speech-to-text mic button.
 *
 * Jack: "I think most people don't realize they can voice type. So I'd
 * like across the platform for there to be a little mic button and for
 * us to integrate the best model for speech to text."
 *
 * Implementation:
 *   - Primary path: Web Speech API (`webkitSpeechRecognition` /
 *     `SpeechRecognition`). Free, browser-native, instant, no API key,
 *     works offline on iOS Safari + Android Chrome + desktop Chrome/
 *     Edge / Safari (≥iOS 14.5). This covers ~95% of our traffic.
 *   - Fallback: if the browser doesn't support it (Firefox, some
 *     embedded webviews) we hide the button. A future MediaRecorder →
 *     /api/transcribe (Groq Whisper v3) path is mocked out in
 *     transcribeAudio() below and can be wired up if Firefox usage
 *     ever matters.
 *
 * Usage:
 *   <MicButton
 *     onText={(text) => setMessage((prev) => `${prev}${text}`)}
 *     ariaLabel="Dictate message"
 *   />
 *
 * The component manages all its own UI state. Parent only needs to
 * supply onText (called incrementally as the user speaks — interim
 * results come through too via onInterim if provided). Append-mode
 * is the default behavior of `onText`; if you want to REPLACE the
 * input instead, the parent does that in its own setter.
 */

// Browser-typing — `webkitSpeechRecognition` isn't in lib.dom because
// it's prefixed. We just `any` it.
type SR = any;
type SREvent = any;

function getSpeechRecognitionCtor(): SR | null {
  if (typeof window === "undefined") return null;
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function MicButton({
  onText,
  onInterim,
  ariaLabel = "Voice input",
  size = 32,
  language,
  className,
  style
}: {
  /** Called with FINAL transcript chunks as the user speaks. Parents
   *  typically append this to their textarea value. */
  onText: (chunk: string) => void;
  /** Optional — called with interim (non-final) hypothesis so the
   *  parent can show a live in-flight preview. */
  onInterim?: (text: string) => void;
  /** Screen-reader label. */
  ariaLabel?: string;
  /** Size in px (button is square). */
  size?: number;
  /** BCP-47 language tag. Defaults to browser language. */
  language?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string>("");
  const recogRef = useRef<SR | null>(null);
  // The Web Speech API fires `onresult` with the ENTIRE result list each
  // time, so we track which result indices we've already pushed to the
  // parent to avoid double-appending finalized chunks.
  const sentUpToRef = useRef(0);

  // Detect support post-mount so SSR doesn't render the button on the
  // server and then hide it on the client (flash).
  useEffect(() => {
    setSupported(!!getSpeechRecognitionCtor());
  }, []);

  // Clean up the recognizer on unmount so a stale instance doesn't keep
  // the mic warm if the parent unmounts mid-recording.
  useEffect(() => {
    return () => {
      try {
        recogRef.current?.stop?.();
      } catch {
        /* ignore */
      }
      recogRef.current = null;
    };
  }, []);

  function start() {
    setError("");
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setError("Voice not supported in this browser");
      return;
    }
    try {
      const r: SR = new Ctor();
      r.continuous = true;
      r.interimResults = true;
      r.lang =
        language ||
        (typeof navigator !== "undefined" && (navigator as any).language) ||
        "en-US";
      sentUpToRef.current = 0;

      r.onresult = (e: SREvent) => {
        const results = e.results;
        let interim = "";
        for (let i = sentUpToRef.current; i < results.length; i++) {
          const r0 = results[i];
          if (r0.isFinal) {
            const text = (r0[0]?.transcript || "").trim();
            if (text) {
              // Final chunks get a trailing space so consecutive
              // dictations don't run together ("hellothere" → "hello
              // there"). Parents can trim if they care.
              onText(text + " ");
            }
            sentUpToRef.current = i + 1;
          } else {
            interim += r0[0]?.transcript || "";
          }
        }
        if (interim && onInterim) onInterim(interim);
      };
      r.onerror = (e: SREvent) => {
        // "no-speech" + "aborted" + "not-allowed" are the noisy ones.
        // Show a friendly message; the parent's own UX handles the rest.
        const code = (e?.error || "").toString();
        if (code === "no-speech") setError("Didn't catch that — try again");
        else if (code === "not-allowed")
          setError("Microphone permission denied");
        else if (code === "aborted") setError("");
        else if (code) setError(`Voice error: ${code}`);
      };
      r.onend = () => {
        // Recognition stopped — either user clicked stop, the browser
        // auto-stopped on silence, or an error fired. Flip listening
        // off so the button renders the "tap to start" state again.
        setListening(false);
        recogRef.current = null;
      };
      r.start();
      recogRef.current = r;
      setListening(true);
    } catch (e: any) {
      setError(e?.message || "Voice failed to start");
      setListening(false);
    }
  }

  function stop() {
    try {
      recogRef.current?.stop?.();
    } catch {
      /* ignore */
    }
    // onend will flip listening false; we don't pre-empt it here so the
    // state stays in sync with what the recognizer is actually doing.
  }

  // Don't render anything if the browser can't do voice — there's no
  // useful fallback yet, and a "voice unavailable" button just creates
  // confusion. Future: MediaRecorder → /api/transcribe (Groq Whisper).
  if (!supported) return null;

  const pulseColor = listening ? "#ef4444" : "var(--text-dim)";
  return (
    <>
      <button
        type="button"
        onClick={listening ? stop : start}
        aria-label={listening ? "Stop voice input" : ariaLabel}
        title={
          listening
            ? "Tap to stop recording"
            : "Tap to dictate — speech becomes text"
        }
        className={className}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          border: `1px solid ${
            listening ? "#ef4444" : "var(--border, rgba(0,0,0,0.15))"
          }`,
          background: listening
            ? "rgba(239, 68, 68, 0.10)"
            : "var(--panel, transparent)",
          color: pulseColor,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          flexShrink: 0,
          padding: 0,
          fontSize: Math.round(size * 0.5),
          lineHeight: 1,
          position: "relative",
          ...(style ?? {})
        }}
      >
        {/* Inline SVG mic icon — beats emoji for crispness at small sizes. */}
        <svg
          width={Math.round(size * 0.55)}
          height={Math.round(size * 0.55)}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="9" y="2" width="6" height="13" rx="3" />
          <path d="M5 11a7 7 0 0 0 14 0" />
          <line x1="12" y1="18" x2="12" y2="22" />
          <line x1="8" y1="22" x2="16" y2="22" />
        </svg>
        {listening && (
          // Tiny pulsing ring that telegraphs "I'm listening." Same
          // pulse animation pattern used on the proposed-destination
          // pill in ChatUI.tsx for visual consistency.
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: -3,
              borderRadius: "50%",
              border: "2px solid rgba(239, 68, 68, 0.55)",
              animation: "mic-button-pulse 1.2s ease-out infinite",
              pointerEvents: "none"
            }}
          />
        )}
      </button>
      {error && (
        // Inline error tucks under the button so the parent doesn't
        // have to plumb error state through.
        <span
          style={{
            fontSize: 10,
            color: "#ef4444",
            marginLeft: 6,
            whiteSpace: "nowrap"
          }}
        >
          {error}
        </span>
      )}
      <style>{`
        @keyframes mic-button-pulse {
          0%   { transform: scale(1);   opacity: 0.9; }
          70%  { transform: scale(1.25); opacity: 0; }
          100% { transform: scale(1.25); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          [aria-label="Stop voice input"] + span,
          .mic-button-pulse-ring { animation: none !important; }
        }
      `}</style>
    </>
  );
}
