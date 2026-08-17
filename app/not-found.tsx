import Link from "next/link";

/**
 * Custom 404 page — on-brand. Auto-rendered by Next.js App Router
 * whenever any page calls `notFound()` or a route doesn't match.
 *
 * Concept: SyncedIn's whole pitch is that two twins meet in the
 * middle and sync up. On a 404, the meeting place is missing —
 * so we show two orbiting avatars (YOU + a counterpart "?") circling
 * a hollow ring where the page that's supposed to be there isn't.
 * Sparkle dots stream out the way they do in the hero video,
 * implying the platform is still very much alive — just this one
 * page is gone.
 *
 * Jack: "Let's make this 404 page animation more relevant to the
 * platform itself. Something that intertwines the vibe of the
 * platform and the thing."
 *
 * Headline plays on the product: "Your twin showed up. The page
 * didn't." Two CTAs (Home / Build my twin) keep the conversion
 * path warm.
 */
export default function NotFound() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 24px",
        background: "var(--bg)",
        color: "var(--text)",
        textAlign: "center",
        overflow: "hidden",
        position: "relative"
      }}
    >
      {/* Ambient floating sparkles — pure CSS, ten dots scattered
          behind the orbit so the whole page reads as "network space"
          rather than an empty page. */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          zIndex: 0
        }}
      >
        <style>{`
          @keyframes nf-float {
            0%, 100% { transform: translateY(0) scale(1);   opacity: 0.55; }
            50%      { transform: translateY(-14px) scale(1.15); opacity: 1; }
          }
          .nf-spark {
            position: absolute;
            width: 4px; height: 4px;
            border-radius: 50%;
            background: radial-gradient(
              circle at 30% 30%,
              #6b95ff 0%,
              #1f59ff 60%,
              transparent 100%
            );
            box-shadow: 0 0 8px rgba(31, 89, 255, 0.5);
            animation: nf-float 5s ease-in-out infinite;
          }
        `}</style>
        {[
          { top: "12%", left: "18%", delay: "0s" },
          { top: "22%", left: "78%", delay: "1.4s" },
          { top: "38%", left: "8%",  delay: "2.7s" },
          { top: "50%", left: "88%", delay: "0.7s" },
          { top: "64%", left: "14%", delay: "3.1s" },
          { top: "72%", left: "82%", delay: "1.1s" },
          { top: "18%", left: "55%", delay: "2.0s" },
          { top: "82%", left: "40%", delay: "0.4s" },
          { top: "8%",  left: "40%", delay: "3.8s" },
          { top: "88%", left: "60%", delay: "2.3s" }
        ].map((s, i) => (
          <span
            key={i}
            className="nf-spark"
            style={{
              top: s.top,
              left: s.left,
              animationDelay: s.delay
            }}
          />
        ))}
      </div>

      {/* The orbit + two avatars + hollow center. Sized large enough
          to read at a glance, small enough to leave room for the
          headline below. */}
      <div
        aria-hidden="true"
        style={{
          position: "relative",
          width: 240,
          height: 240,
          marginBottom: 22,
          zIndex: 1
        }}
      >
        <style>{`
          @keyframes nf-orbit {
            from { transform: rotate(0deg)   translateX(105px) rotate(0deg); }
            to   { transform: rotate(360deg) translateX(105px) rotate(-360deg); }
          }
          @keyframes nf-orbit-reverse {
            from { transform: rotate(180deg) translateX(105px) rotate(-180deg); }
            to   { transform: rotate(540deg) translateX(105px) rotate(-540deg); }
          }
          @keyframes nf-ring-pulse {
            0%, 100% {
              transform: translate(-50%, -50%) scale(1);
              opacity: 0.35;
            }
            50% {
              transform: translate(-50%, -50%) scale(1.06);
              opacity: 0.6;
            }
          }
          @keyframes nf-404-glitch {
            0%, 92%, 100% { transform: translate(-50%, -50%); }
            93%           { transform: translate(-51%, -50%); }
            94%           { transform: translate(-49%, -51%); }
            96%           { transform: translate(-50%, -49%); }
          }
          /* Each avatar sits at the orbit center, then animates out to a
             radius of 105px and around. The two extra "from/to rotate"
             pairs keep the avatar itself upright while orbiting. */
          .nf-avatar {
            position: absolute;
            top: 50%; left: 50%;
            margin-left: -22px;
            margin-top: -22px;
            width: 44px; height: 44px;
            border-radius: 50%;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            color: #fff;
            font-weight: 800;
            font-size: 13px;
            letter-spacing: 0.02em;
            font-family: "IBM Plex Mono", ui-monospace, "SF Mono", Menlo, monospace;
            box-shadow: 0 6px 18px -6px rgba(31, 89, 255, 0.6);
            border: 2px solid var(--bg);
          }
          .nf-avatar.you {
            background: linear-gradient(135deg, #1f59ff 0%, #6b2dc9 100%);
            animation: nf-orbit 7s linear infinite;
          }
          .nf-avatar.them {
            background: linear-gradient(135deg, #5ee5b2 0%, #1f8bff 100%);
            animation: nf-orbit-reverse 7s linear infinite;
          }
          .nf-ring {
            position: absolute;
            top: 50%; left: 50%;
            width: 210px; height: 210px;
            transform: translate(-50%, -50%);
            border-radius: 50%;
            border: 1.5px dashed rgba(31, 89, 255, 0.35);
            animation: nf-ring-pulse 3.6s ease-in-out infinite;
          }
          /* The void in the middle where the page should be. A faint
             radial gradient so it feels like a "hole" the twins are
             trying to meet inside. */
          .nf-void {
            position: absolute;
            top: 50%; left: 50%;
            width: 140px; height: 140px;
            transform: translate(-50%, -50%);
            border-radius: 50%;
            background: radial-gradient(
              circle at center,
              rgba(31, 89, 255, 0.08) 0%,
              rgba(107, 45, 201, 0.04) 50%,
              transparent 100%
            );
            border: 1px solid rgba(31, 89, 255, 0.20);
          }
          .nf-404 {
            position: absolute;
            top: 50%; left: 50%;
            transform: translate(-50%, -50%);
            font-size: 42px;
            font-weight: 900;
            letter-spacing: -0.02em;
            font-family: "IBM Plex Mono", ui-monospace, "SF Mono", Menlo, monospace;
            background: linear-gradient(135deg, #1f59ff 0%, #6b2dc9 100%);
            -webkit-background-clip: text;
            background-clip: text;
            -webkit-text-fill-color: transparent;
            animation: nf-404-glitch 3.2s steps(1) infinite;
          }
          /* The two "links" between the orbiting twins — faint connection
             lines that fade in and out, suggesting a sync that never
             quite completes here. */
          @keyframes nf-link-fade {
            0%, 100% { opacity: 0; }
            45%, 55% { opacity: 0.5; }
          }
          .nf-link {
            position: absolute;
            top: 50%; left: 50%;
            width: 210px; height: 1px;
            transform-origin: 0 50%;
            background: linear-gradient(
              90deg,
              transparent 0%,
              rgba(31, 89, 255, 0.5) 50%,
              transparent 100%
            );
            animation: nf-link-fade 7s linear infinite;
          }
          @media (prefers-reduced-motion: reduce) {
            .nf-avatar, .nf-ring, .nf-404, .nf-link, .nf-spark {
              animation: none !important;
            }
          }
        `}</style>
        <div className="nf-ring" />
        <div className="nf-void" />
        <div className="nf-404">404</div>
        <span className="nf-link" />
        <div className="nf-avatar you" title="You">
          YOU
        </div>
        <div className="nf-avatar them" title="Counterpart not found">
          ?
        </div>
      </div>

      <h1
        style={{
          fontSize: "clamp(28px, 4.5vw, 40px)",
          fontWeight: 900,
          letterSpacing: "-0.02em",
          lineHeight: 1.1,
          margin: 0,
          maxWidth: 620,
          zIndex: 1
        }}
      >
        Your twin showed up. The page didn&apos;t.
      </h1>

      <p
        style={{
          marginTop: 12,
          fontSize: 15,
          lineHeight: 1.6,
          color: "var(--text-dim)",
          maxWidth: 520,
          zIndex: 1
        }}
      >
        Somewhere between two timezones, a Slack notification, and a
        404, this URL ghosted us. Your twin&apos;s still out there
        making win-wins — head home or get one set up in 30 seconds.
      </p>

      <div
        style={{
          marginTop: 28,
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          justifyContent: "center",
          zIndex: 1
        }}
      >
        <Link
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "13px 22px",
            fontSize: 15,
            fontWeight: 700,
            color: "#fff",
            background: "#1f59ff",
            borderRadius: 12,
            textDecoration: "none",
            boxShadow: "0 10px 24px -8px rgba(31, 89, 255, 0.5)"
          }}
        >
          ← Back to homepage
        </Link>
        <Link
          href="/login?next=%2Fonboarding%3Fwelcome%3D1"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "13px 22px",
            fontSize: 15,
            fontWeight: 700,
            color: "var(--text)",
            background: "transparent",
            border: "1.5px solid var(--border)",
            borderRadius: 12,
            textDecoration: "none"
          }}
        >
          Build my twin →
        </Link>
      </div>

      <p
        style={{
          marginTop: 24,
          fontSize: 12,
          color: "var(--text-dim)",
          fontStyle: "italic",
          zIndex: 1
        }}
      >
        (Even your twin couldn&apos;t find this one.)
      </p>
    </main>
  );
}
