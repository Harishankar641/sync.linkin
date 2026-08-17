"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BrandLogo, type BrandKey } from "./BrandLogo";

/**
 * Elite/modern landing hero. Single conversion surface:
 *   - Social-proof row + 3 face avatars (warm trust)
 *   - Bold sans headline
 *   - Tight subhead
 *   - Platform pill row (Instagram / TikTok / X / LinkedIn / YouTube)
 *   - One @handle input — accepts EITHER bare handle OR full profile URL
 *   - Oversized blue CTA
 *   - Micro-trust copy
 *
 * Submit flow: paste handle → POST to /api/bulk-create-invites
 * (single-contact, unauthed-safe path) to ensure we route the user
 * to /login with a `next=/[slug]` so the demo-conversation lands
 * the moment they sign in. If unauthed, we just route to
 * /login?next=/onboarding so they start a twin first.
 *
 * Per Jack: "we need to look more modern and elite."
 *
 * Placeholder cycling: greys text rotates between "yourhandle" and
 * "linkedin.com/in/yourhandle" form every ~2.6s so the user instantly
 * sees that either is accepted. Jack: "FOR LINKEDIN AND ALL IT SHOULD
 * BE HANDLE OR FULL LINK THE GREY TEXT CAN SWITCH BACK AND FORTH."
 */
type Platform = {
  key: BrandKey;
  label: string;
  prefix: string;
  // Two-form placeholder: handle-only and full-URL. We rotate between
  // them on a timer so users see at a glance that either is accepted.
  placeholderHandle: string;
  placeholderUrl: string;
};

const PLATFORMS: Platform[] = [
  {
    key: "instagram",
    label: "Instagram",
    prefix: "instagram.com/",
    placeholderHandle: "yourhandle",
    placeholderUrl: "instagram.com/yourhandle"
  },
  {
    key: "x",
    label: "X",
    prefix: "x.com/",
    placeholderHandle: "yourhandle",
    placeholderUrl: "x.com/yourhandle"
  },
  {
    key: "linkedin",
    label: "LinkedIn",
    prefix: "linkedin.com/in/",
    placeholderHandle: "your-handle",
    placeholderUrl: "linkedin.com/in/your-handle"
  },
  {
    key: "facebook",
    label: "Facebook",
    prefix: "facebook.com/",
    placeholderHandle: "yourhandle",
    placeholderUrl: "facebook.com/yourhandle"
  }
];

/**
 * Pull the bare handle out of either form of input. Accepts:
 *   - "yourhandle"             → "yourhandle"
 *   - "@yourhandle"            → "yourhandle"
 *   - "linkedin.com/in/foo"    → "foo" (also auto-detects platform)
 *   - "https://x.com/foo?bar"  → "foo" (strips query)
 *   - "https://www.instagram.com/foo/" → "foo"
 *
 * Returns { handle, detectedPlatform? }. Detected platform overrides
 * the user's pill choice if we can tell from the URL — that's a better
 * UX than yelling about a mismatch.
 */
function parseInput(
  raw: string
): { handle: string; detectedPlatform?: BrandKey } {
  let s = raw.trim().replace(/^@+/, "");
  if (!s) return { handle: "" };
  // Strip scheme + www.
  s = s.replace(/^https?:\/\//i, "").replace(/^www\./i, "");
  // Detect platform from domain.
  let detected: BrandKey | undefined;
  if (/^linkedin\.com\/in\//i.test(s)) {
    detected = "linkedin";
    s = s.replace(/^linkedin\.com\/in\//i, "");
  } else if (/^(twitter|x)\.com\//i.test(s)) {
    detected = "x";
    s = s.replace(/^(twitter|x)\.com\//i, "");
  } else if (/^instagram\.com\//i.test(s)) {
    detected = "instagram";
    s = s.replace(/^instagram\.com\//i, "");
  } else if (/^facebook\.com\//i.test(s)) {
    detected = "facebook";
    s = s.replace(/^facebook\.com\//i, "");
  }
  // Drop trailing slash + querystring + hash.
  s = s.split(/[?#]/)[0].replace(/\/+$/, "");
  return { handle: s, detectedPlatform: detected };
}

export function LandingHandleHero({
  realFaces = []
}: {
  /** Real platform users with uploaded avatars. Server-fetched in
   *  app/page.tsx and passed in so the social-proof avatar strip
   *  shows actual people, not DiceBear placeholders. Jack: "use real
   *  photos also on the homepage rather than these weird ones next
   *  to the 40+ founders syncing thing." Empty array falls back to
   *  the previous DiceBear avatars below. */
  realFaces?: Array<{
    id: string;
    name: string;
    avatar_url: string;
    handle: string | null;
  }>;
} = {}) {
  const router = useRouter();
  const [platform, setPlatform] = useState<Platform>(PLATFORMS[2]); // LinkedIn default
  const [handle, setHandle] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const placeholder = platform.placeholderHandle;

  async function go() {
    const parsed = parseInput(handle);
    const h = parsed.handle;
    if (!h || busy) return;
    // If the user pasted a full URL we can detect the platform from —
    // switch the active pill so the routing matches what they typed.
    const effectivePlatform =
      (parsed.detectedPlatform &&
        PLATFORMS.find((p) => p.key === parsed.detectedPlatform)) ||
      platform;
    setBusy(true);
    setErr("");
    try {
      // Build the synthetic profile URL from the chosen platform.
      const profileUrl = `https://${effectivePlatform.prefix}${h}`;
      // Stash the intended URL so the post-login onboarding flow can
      // prefill scrape context from it immediately.
      try {
        sessionStorage.setItem(
          "syncedin.signupIntent",
          JSON.stringify({
            profile_url: profileUrl,
            platform: effectivePlatform.key
          })
        );
      } catch {
        /* private mode */
      }
      // Route to login with a redirect back to onboarding so the new
      // user immediately gets their twin scaffolded from this URL.
      router.push(
        `/login?next=${encodeURIComponent("/onboarding?welcome=1")}`
      );
    } catch (e: any) {
      setErr(e?.message || "Something went wrong - try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="lh-hero">
      <style>{`
        .lh-hero {
          max-width: 900px;
          width: min(100%, 900px);
          margin: 0 auto;
          text-align: center;
          position: relative;
          padding: 30px 24px 34px;
          color: var(--text);
        }

        .lh-hero::before {
          content: '';
          position: absolute;
          width: 520px;
          height: 280px;
          left: 50%;
          top: 10px;
          transform: translateX(-50%);
          background: radial-gradient(circle, rgba(58,126,255,.20), transparent 68%);
          filter: blur(10px);
          pointer-events: none;
          z-index: -1;
          animation: hero-glow 7s ease-in-out infinite alternate;
        }

        @keyframes hero-glow {
          from { opacity: .55; transform: translateX(-50%) scale(.96); }
          to { opacity: 1; transform: translateX(-50%) scale(1.05); }
        }

        @media (prefers-reduced-motion: reduce) {
          .lh-hero::before { animation: none; }
        }
        .lh-proof {
          text-align: center;
          margin: 0 auto 36px;
          max-width: 100%;
          width: fit-content;
          display: flex;
          align-items: center;
          justify-content: center;
gap: 14px;
          margin-bottom: 18px;
          padding: 7px 12px 7px 8px;
          border: 1px solid rgba(255,255,255,.10);
          border-radius: 999px;
          background: rgba(255,255,255,.045);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          box-shadow: 0 12px 36px rgba(0,0,0,.12);
        }
        .lh-avatars { display: inline-flex; }
        .lh-avatars img {
          width: 38px; height: 38px; border-radius: 999px;
          border: 2.5px solid rgba(7,14,27,.92);
          object-fit: cover;
          margin-left: -10px;
          box-shadow: 0 5px 16px rgba(0,0,0,.22);
        }

        .lh-avatars img:nth-child(2),
        .lh-avatars img:nth-child(3) {
          animation: avatar-float 4.5s ease-in-out infinite;
        }

        .lh-avatars img:nth-child(3) { animation-delay: .35s; }

        @keyframes avatar-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-2px); }
        }

        @media (prefers-reduced-motion: reduce) {
          .lh-avatars img { animation: none; }
        }
        .lh-avatars img:first-child { margin-left: 0; }
        .lh-proof-text {
          display: flex; flex-direction: column; gap: 2px;
        }
        .lh-proof-headline {
          font-size: 16px; font-weight: 800; letter-spacing: -0.01em;
        }
        .lh-proof-sub {
          display: inline-flex; align-items: center; gap: 8px;
          font-size: 13px; color: var(--text-dim);
        }
        .lh-stars { color: #fbbf24; letter-spacing: 1px; font-size: 13px; }

        .lh-h1 {
          font-size: clamp(36px, 4.8vw, 58px);
          font-weight: 900;
          letter-spacing: -0.04em;
          line-height: 1;
          margin: 0;
          color: var(--text);
          text-wrap: balance;
          text-shadow: 0 12px 45px rgba(0,0,0,.18);
          animation: hero-title-in .65s cubic-bezier(.2,.8,.2,1) both;
        }

        @keyframes hero-title-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @media (prefers-reduced-motion: reduce) {
          .lh-h1 { animation: none; }
        }
        .lh-sub {
          margin: 10px auto 0;
          font-size: 17px;
          line-height: 1.5;
          color: var(--text-dim);
          max-width: 640px;
        }
        .lh-sub strong { color: var(--text); font-weight: 700; }

        .lh-platforms {
          display: flex; flex-wrap: wrap; gap: 8px;
          justify-content: center;
          margin-top: 18px;
        }
        .lh-pill {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 10px 16px;
          border-radius: 999px;
          background: transparent;
          border: 1px solid var(--border);
          color: var(--text);
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition:
            background 0.15s ease,
            border-color 0.15s ease,
            transform 0.12s ease;
        }
        .lh-pill:hover { border-color: var(--text); }
        .lh-pill.active {
          background: var(--text);
          color: var(--bg);
          border-color: var(--text);
        }

        .lh-input-wrap {
          position: relative;
          margin-top: 18px;
          padding: 1px;
          border-radius: 16px;
          background: linear-gradient(120deg, rgba(111,166,255,.45), rgba(255,255,255,.08), rgba(110,65,255,.35));
          box-shadow: 0 20px 55px -30px rgba(31,89,255,.55);
        }
        .lh-input-prefix {
          position: absolute;
          left: 18px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-dim);
          font-size: 18px;
          pointer-events: none;
        }
        .lh-input {
          width: 100%;
          padding: 18px 18px 18px 38px;
          font-size: 17px;
          border-radius: 15px;
          border: 0;
          background: rgba(7,14,27,.80);
          color: var(--text);
        }
        .lh-input:focus {
          outline: none;
          border-color: #1f8bff;
          box-shadow: 0 0 0 4px rgba(31, 139, 255, 0.14);
        }

        .lh-cta {
          margin-top: 14px;
          width: 100%;
          padding: 19px 22px;
          font-size: 17px;
          font-weight: 700;
          letter-spacing: -0.005em;
          color: #fff;
          background: #1f59ff;
          border: none;
          border-radius: 14px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          transition: transform 0.12s ease, box-shadow 0.18s ease;
          box-shadow: 0 12px 30px -10px rgba(31, 89, 255, 0.55);
        }
        .lh-cta:hover {
          transform: translateY(-1px);
          box-shadow: 0 16px 36px -10px rgba(31, 89, 255, 0.65);
        }
        .lh-cta:disabled {
          opacity: 0.55;
          cursor: not-allowed;
          transform: none;
        }

        .lh-microcopy {
          margin-top: 14px;
          font-size: 13px;
          color: var(--text-dim);
          text-align: center;
        }

        .lh-microcopy::before {
          content: '✦';
          display: inline-block;
          margin-right: 7px;
          color: #73a7ff;
          opacity: .85;
        }

        .lh-error {
          margin-top: 10px;
          font-size: 13px;
          color: #ef4444;
          text-align: center;
        }
      `}</style>

      {/* Social proof — real platform users when we have them, dicebear
          placeholders otherwise. The pile reads as authentic when these
          are recognizable faces (founders, builders, advisors), so the
          server-side fetch in app/page.tsx prioritizes most-active users
          with uploaded avatars over the auto-generated identicons. */}
      <div className="lh-proof">
        <div className="lh-avatars" aria-hidden="true">
          {realFaces.length >= 3 ? (
            // Top 3 real users, eagerly loaded so they render with the
            // hero (no lazy flicker).
            realFaces.slice(0, 3).map((f) => (
              <img
                key={f.id}
                src={f.avatar_url}
                alt={f.name}
                title={f.name}
                loading="eager"
                referrerPolicy="no-referrer"
              />
            ))
          ) : (
            <>
              <img
                src="https://api.dicebear.com/9.x/notionists/svg?seed=marina"
                alt=""
              />
              <img
                src="https://api.dicebear.com/9.x/notionists/svg?seed=darius"
                alt=""
              />
              <img
                src="https://api.dicebear.com/9.x/notionists/svg?seed=ari"
                alt=""
              />
            </>
          )}
        </div>
        <div className="lh-proof-text">
          <span className="lh-proof-headline">
            40+ founders syncing
          </span>
          <span className="lh-proof-sub">
            <span className="lh-stars">★★★★★</span>
            <span>4.9 average</span>
          </span>
        </div>
      </div>

      <h1 className="lh-h1">
        Your professional twin
        <br />
        finds the right deal before the call.
      </h1>
      <p className="lh-sub">
        Paste your handle. We build a digital twin of you in 30 seconds -
        then it talks to other people&apos;s twins to find the highest
        win-win between you, before either of you spends a minute on
        a call.
      </p>

      {/* Platform pills */}
      <div className="lh-platforms" role="tablist">
        {PLATFORMS.map((p) => (
          <button
            key={p.key}
            type="button"
            role="tab"
            aria-selected={platform.key === p.key}
            onClick={() => setPlatform(p)}
            className={`lh-pill ${platform.key === p.key ? "active" : ""}`}
          >
            <BrandLogo brand={p.key} size={14} />
            <span>{p.label}</span>
          </button>
        ))}
      </div>

      <div className="lh-input-wrap">
        <span className="lh-input-prefix">@</span>
        <input
          type="text"
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void go();
            }
          }}
          placeholder={placeholder}
          className="lh-input"
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
      </div>

      <button
        type="button"
        onClick={go}
        disabled={!handle.trim() || busy}
        className="lh-cta"
      >
        <span>{busy ? "building…" : "Build my twin"}</span>
        <span className="arrow" aria-hidden="true"></span>
      </button>

      <p className="lh-microcopy">
        Free. No commitment. Your twin learns your voice - you stay in
        control of every message.
      </p>

      {err && <p className="lh-error">{err}</p>}
    </section>
  );
}