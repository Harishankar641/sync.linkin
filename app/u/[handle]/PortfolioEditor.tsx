"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Theme = {
  accent?: string;
  bg?: string;
  banner_emoji?: string;
  vibe?: string;
};

/**
 * Owner-only inline editor for the portfolio page. Direct fields version —
 * the prompt-driven "describe what you want and the AI rewrites your page"
 * editor lands in a follow-up; this gives the user immediate manual
 * control so the page is editable on day one.
 *
 * On save, also fires a context-append so the twin's ai_export_blob picks
 * up the new about copy as a `# Portfolio about` block. That's the
 * "editing your portfolio also updates your twin's context" loop.
 */
export function PortfolioEditor({
  handle,
  initialAbout,
  initialTheme
}: {
  handle: string;
  initialAbout: string;
  initialTheme: Theme;
}) {
  const router = useRouter();
  const [about, setAbout] = useState(initialAbout);
  const [vibe, setVibe] = useState(initialTheme.vibe ?? "");
  const [emoji, setEmoji] = useState(initialTheme.banner_emoji ?? "✦");
  const [accent, setAccent] = useState(initialTheme.accent ?? "#6b2dc9");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<null | "ok" | "err">(null);
  const [, startTransition] = useTransition();

  async function save() {
    setBusy(true);
    setSaved(null);
    try {
      const res = await fetch("/api/portfolio/update", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          about,
          theme: { vibe, banner_emoji: emoji, accent }
        })
      });
      setSaved(res.ok ? "ok" : "err");
      if (res.ok) {
        startTransition(() => router.refresh());
      }
    } catch {
      setSaved("err");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <div className="mt-6">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="retro-btn"
          style={{ fontSize: 12 }}
        >
          ✎ edit your portfolio
        </button>
      </div>
    );
  }

  return (
    <section className="mt-6 retro-panel p-5">
      <div className="flex items-baseline justify-between">
        <div className="retro-label">editing · only you see this panel</div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs"
          style={{ color: "var(--text-dim)" }}
        >
          close
        </button>
      </div>

      <label className="block mt-3 text-xs font-semibold">about</label>
      <textarea
        value={about}
        onChange={(e) => setAbout(e.target.value)}
        rows={5}
        placeholder="The MySpace blurb at the top of the page. A paragraph about who you are, what you're up to, what you'd love to talk about. This also becomes context your twin uses when it talks to others."
        className="retro-input mt-1 w-full"
        style={{ fontSize: 14, padding: 10 }}
      />

      <div className="mt-3 grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-semibold">vibe</label>
          <input
            type="text"
            value={vibe}
            onChange={(e) => setVibe(e.target.value)}
            maxLength={40}
            placeholder="founder-in-flight"
            className="retro-input mt-1 w-full"
            style={{ fontSize: 13, padding: 8 }}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold">banner emoji</label>
          <input
            type="text"
            value={emoji}
            onChange={(e) => setEmoji(e.target.value.slice(0, 4))}
            placeholder="✦"
            className="retro-input mt-1 w-full"
            style={{ fontSize: 18, padding: 6, textAlign: "center" }}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold">accent</label>
          <input
            type="color"
            value={accent}
            onChange={(e) => setAccent(e.target.value)}
            className="mt-1 w-full"
            style={{
              height: 36,
              border: "1px solid var(--border)",
              borderRadius: 6
            }}
          />
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="retro-btn retro-btn-primary"
        >
          {busy ? "saving…" : "save"}
        </button>
        {saved === "ok" && (
          <span className="text-xs" style={{ color: "var(--green)" }}>
            saved · your twin's context updated too
          </span>
        )}
        {saved === "err" && (
          <span className="text-xs" style={{ color: "#ef4444" }}>
            save failed — try again
          </span>
        )}
        <span className="text-xs ml-auto" style={{ color: "var(--text-dim)" }}>
          /u/{handle}
        </span>
      </div>
    </section>
  );
}
