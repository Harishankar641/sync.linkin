/**
 * WelcomeSplash — first-impression hero on /onboarding for brand-new
 * users. Server component, renders only when `?welcome=1` is present so
 * returning users editing their twin never see it.
 *
 * Layout:
 *   - Big gradient halo
 *   - "Welcome, <FirstName>." headline
 *   - One-line manifesto: "Prepare for a synchronous future where the
 *     people you want to connect with and create magic with are found
 *     with ease."
 *   - If the user arrived via a claimed invite, a soft line acknowledging
 *     the inviter and a "your first conversation is ready" anchor.
 *   - Avatar peek (recipient_avatar_url that the claim route prefilled)
 *
 * Intentionally NOT a client component — no interactivity, just trust-
 * building copy + visuals.
 */
export function WelcomeSplash({
  firstName,
  avatarUrl,
  inviterName,
  conversationId
}: {
  firstName: string;
  avatarUrl: string | null;
  inviterName: string | null;
  conversationId: string | null;
}) {
  const greetName = firstName && firstName.trim().length > 0 ? firstName : "friend";

  return (
    <section
      style={{
        position: "relative",
        marginTop: 16,
        marginBottom: 24,
        padding: "22px 24px",
        borderRadius: 18,
        border: "1px solid var(--border)",
        background:
          "radial-gradient(800px 400px at 20% 0%, rgba(58,77,255,0.18), transparent 60%), radial-gradient(600px 400px at 90% 100%, rgba(216,59,255,0.16), transparent 60%), var(--panel-solid)",
        overflow: "hidden"
      }}
    >
      {/* Subtle scan line so it reads as sci-fi-welcome not generic card */}
      <span
        aria-hidden
        className="ws-scan"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: "50%",
          height: 1,
          background:
            "linear-gradient(90deg, transparent, rgba(94, 110, 255, 0.45), transparent)",
          opacity: 0.55
        }}
      />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 18,
          position: "relative",
          zIndex: 1,
          flexWrap: "wrap"
        }}
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={greetName}
            className="ws-avatar"
            width={64}
            height={64}
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              objectFit: "cover",
              border: "2px solid var(--amber, #5e6eff)",
              boxShadow: "0 0 0 4px rgba(94,110,255,0.18)",
              flexShrink: 0
            }}
          />
        ) : (
          <div
            className="ws-avatar"
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              background: "var(--panel-2)",
              border: "2px solid var(--amber, #5e6eff)",
              fontSize: 24,
              fontWeight: 700,
              color: "var(--text)",
              flexShrink: 0
            }}
          >
            {greetName.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            className="retro-label ws-rise-1"
            style={{ color: "var(--amber-bright, #94a4ff)" }}
          >
            welcome
          </div>
          <h2
            className="retro-h1 ws-rise-2"
            style={{
              fontSize: 28,
              lineHeight: 1.15,
              marginTop: 4,
              letterSpacing: "-0.01em"
            }}
          >
            Welcome, {greetName}.
          </h2>
          <p
            className="ws-rise-3"
            style={{
              marginTop: 8,
              fontSize: 14,
              lineHeight: 1.55,
              color: "var(--text-dim)",
              maxWidth: 620
            }}
          >
            Prepare for a synchronous future where the people you want to
            connect with and create magic with are found with ease.
          </p>
        </div>
      </div>

      {inviterName && (
        <div
          className="ws-rise-4"
          style={{
            marginTop: 16,
            padding: "10px 14px",
            borderRadius: 12,
            background: "rgba(94,110,255,0.08)",
            border: "1px solid rgba(94,110,255,0.18)",
            fontSize: 13,
            lineHeight: 1.5,
            color: "var(--text)",
            position: "relative",
            zIndex: 1
          }}
        >
          <strong>{inviterName}</strong> already has a conversation waiting
          for you. Spin up your twin below and it&apos;ll be ready to talk
          to theirs the moment you&apos;re done
          {conversationId ? "." : "."}
        </div>
      )}

      {/* Entrance choreography: pure CSS so this stays a server
          component. Label, headline, manifesto, and invite line rise in
          sequence; the scan line sweeps; the avatar ring breathes. */}
      <style>{`
        @keyframes ws-in {
          0% { opacity: 0; transform: translateY(10px); }
          100% { opacity: 1; transform: none; }
        }
        .ws-rise-1 { animation: ws-in 0.5s ease 0.05s both; }
        .ws-rise-2 { animation: ws-in 0.55s cubic-bezier(0.2, 0.9, 0.3, 1) 0.16s both; }
        .ws-rise-3 { animation: ws-in 0.55s ease 0.3s both; }
        .ws-rise-4 { animation: ws-in 0.55s ease 0.46s both; }
        @keyframes ws-scan-sweep {
          0% { transform: translateY(-42px); opacity: 0; }
          30% { opacity: 0.55; }
          100% { transform: translateY(46px); opacity: 0; }
        }
        .ws-scan { animation: ws-scan-sweep 3s ease-in-out 0.5s infinite; }
        @keyframes ws-avatar-pulse {
          0%, 100% { box-shadow: 0 0 0 4px rgba(94, 110, 255, 0.18); }
          50% { box-shadow: 0 0 0 10px rgba(94, 110, 255, 0.06); }
        }
        .ws-avatar { animation: ws-avatar-pulse 3s ease infinite; }
        @media (prefers-reduced-motion: reduce) {
          .ws-rise-1, .ws-rise-2, .ws-rise-3, .ws-rise-4, .ws-scan, .ws-avatar {
            animation: none;
          }
        }
      `}</style>
    </section>
  );
}
