/**
 * Custom-site renderer. Turns the structured JSON from
 * /api/portfolio-generate into a rich multi-section page. Per-user
 * accent color, varied section layouts, dynamic typography pair.
 *
 * Jack: "Portfolio page is still the same trash its always been not
 * a custom awesome website." This component is the answer — same
 * page route, but every user gets a different headline ordering,
 * different layouts, different accent, different vibe. Two similar
 * bios still produce visibly different sites.
 */

import { Avatar } from "../../Avatar";

type SectionHero = {
  kind: "hero";
  layout: "split" | "centered" | "magazine";
  headline: string;
  subhead: string;
  tagline?: string;
};
type SectionStory = {
  kind: "story";
  layout: "prose" | "timeline";
  title: string;
  paragraphs: string[];
};
type SectionProjects = {
  kind: "projects";
  layout: "grid" | "list";
  title: string;
  items: Array<{ name: string; line: string }>;
};
type SectionWins = {
  kind: "wins";
  layout: "stat-row" | "list";
  title: string;
  items: Array<{ label: string; value: string }>;
};
type SectionSeeking = {
  kind: "seeking";
  layout: "callout" | "bullets";
  title: string;
  body: string;
  bullets?: string[];
};
type SectionValues = {
  kind: "values";
  layout: "cards" | "list";
  title: string;
  items: Array<{ label: string; body: string }>;
};
type SectionQuote = {
  kind: "quote";
  layout: "pull";
  quote: string;
  attribution?: string;
};
type SectionContact = {
  kind: "contact";
  layout: "cta";
  title: string;
  body: string;
  cta_label: string;
};
type Section =
  | SectionHero
  | SectionStory
  | SectionProjects
  | SectionWins
  | SectionSeeking
  | SectionValues
  | SectionQuote
  | SectionContact;

export type PortfolioPage = {
  accent_color: string;
  bg_gradient: string;
  vibe_tag: string;
  font_pair: { display: string; body: string };
  sections: Section[];
  generated_at?: string;
  generator_version?: number;
};

/** Render a single section. Dispatches on kind+layout. */
function RenderSection({
  s,
  accent,
  name,
  avatarUrl,
  id,
  email,
  handle,
  ownerId,
  display
}: {
  s: Section;
  accent: string;
  name: string;
  avatarUrl: string | null;
  id: string;
  email: string | null;
  handle: string;
  ownerId: string;
  display: string;
}) {
  if (s.kind === "hero") {
    const tagline = s.tagline?.trim() || "";
    if (s.layout === "split") {
      return (
        <section style={{ padding: "72px 0 56px" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "180px 1fr",
              gap: 36,
              alignItems: "center"
            }}
          >
            <Avatar id={ownerId} name={name} avatarUrl={avatarUrl} size={160} />
            <div>
              {tagline && (
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: accent,
                    marginBottom: 12
                  }}
                >
                  {tagline}
                </div>
              )}
              <h1
                style={{
                  fontFamily: `"${display}", Inter, sans-serif`,
                  fontSize: "clamp(38px, 5vw, 60px)",
                  fontWeight: 900,
                  letterSpacing: "-0.025em",
                  lineHeight: 1.05,
                  margin: 0
                }}
              >
                {s.headline}
              </h1>
              <p
                style={{
                  marginTop: 14,
                  fontSize: 18,
                  lineHeight: 1.5,
                  color: "var(--text-dim)",
                  maxWidth: 600
                }}
              >
                {s.subhead}
              </p>
            </div>
          </div>
        </section>
      );
    }
    if (s.layout === "magazine") {
      return (
        <section style={{ padding: "72px 0 56px", textAlign: "left" }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: accent,
              marginBottom: 16
            }}
          >
            {tagline || "Portfolio"} · SyncedIn
          </div>
          <h1
            style={{
              fontFamily: `"${display}", serif`,
              fontSize: "clamp(46px, 7vw, 84px)",
              fontWeight: 900,
              letterSpacing: "-0.035em",
              lineHeight: 0.98,
              margin: 0
            }}
          >
            {s.headline}
          </h1>
          <p
            style={{
              marginTop: 22,
              fontSize: 20,
              lineHeight: 1.5,
              color: "var(--text-dim)",
              maxWidth: 700,
              fontStyle: "italic"
            }}
          >
            {s.subhead}
          </p>
          <div
            style={{
              marginTop: 32,
              display: "flex",
              alignItems: "center",
              gap: 14
            }}
          >
            <Avatar id={ownerId} name={name} avatarUrl={avatarUrl} size={56} />
            <div style={{ fontSize: 14, fontWeight: 700 }}>{name}</div>
          </div>
        </section>
      );
    }
    // centered (default)
    return (
      <section
        style={{ padding: "80px 0 56px", textAlign: "center" }}
      >
        <Avatar id={ownerId} name={name} avatarUrl={avatarUrl} size={120} />
        {tagline && (
          <div
            style={{
              marginTop: 18,
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: accent
            }}
          >
            {tagline}
          </div>
        )}
        <h1
          style={{
            marginTop: 12,
            fontFamily: `"${display}", Inter, sans-serif`,
            fontSize: "clamp(38px, 5.5vw, 64px)",
            fontWeight: 900,
            letterSpacing: "-0.025em",
            lineHeight: 1.05
          }}
        >
          {s.headline}
        </h1>
        <p
          style={{
            marginTop: 16,
            fontSize: 18,
            lineHeight: 1.55,
            color: "var(--text-dim)",
            maxWidth: 620,
            marginLeft: "auto",
            marginRight: "auto"
          }}
        >
          {s.subhead}
        </p>
      </section>
    );
  }

  if (s.kind === "story") {
    return (
      <section style={{ padding: "48px 0" }}>
        <SectionTitle accent={accent}>{s.title}</SectionTitle>
        {s.layout === "timeline" ? (
          <ol
            style={{
              listStyle: "none",
              padding: 0,
              margin: "24px 0 0",
              borderLeft: `2px solid ${accent}33`,
              paddingLeft: 22
            }}
          >
            {s.paragraphs.map((p, i) => (
              <li
                key={i}
                style={{
                  position: "relative",
                  paddingBottom: 18,
                  fontSize: 15,
                  lineHeight: 1.65
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    left: -28,
                    top: 8,
                    width: 10,
                    height: 10,
                    borderRadius: 999,
                    background: accent
                  }}
                />
                {p}
              </li>
            ))}
          </ol>
        ) : (
          <div style={{ marginTop: 16, maxWidth: 680 }}>
            {s.paragraphs.map((p, i) => (
              <p
                key={i}
                style={{
                  fontSize: 16,
                  lineHeight: 1.7,
                  marginTop: i === 0 ? 0 : 14
                }}
              >
                {p}
              </p>
            ))}
          </div>
        )}
      </section>
    );
  }

  if (s.kind === "projects") {
    return (
      <section style={{ padding: "48px 0" }}>
        <SectionTitle accent={accent}>{s.title}</SectionTitle>
        {s.layout === "grid" ? (
          <div
            style={{
              marginTop: 20,
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 14
            }}
          >
            {s.items.map((it, i) => (
              <div
                key={i}
                style={{
                  padding: 16,
                  borderRadius: 14,
                  border: "1px solid var(--border)",
                  background: "var(--panel-solid)",
                  transition: "transform 0.18s ease, box-shadow 0.18s ease"
                }}
              >
                <div
                  style={{
                    fontWeight: 800,
                    fontSize: 15,
                    color: accent,
                    marginBottom: 6
                  }}
                >
                  {it.name}
                </div>
                <div
                  style={{
                    fontSize: 13.5,
                    lineHeight: 1.55,
                    color: "var(--text-dim)"
                  }}
                >
                  {it.line}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, marginTop: 18 }}>
            {s.items.map((it, i) => (
              <li
                key={i}
                style={{
                  padding: "12px 0",
                  borderBottom:
                    i === s.items.length - 1
                      ? "none"
                      : "1px solid var(--border)"
                }}
              >
                <span style={{ fontWeight: 800, color: accent }}>
                  {it.name}
                </span>
                <span style={{ color: "var(--text-dim)" }}>
                  {"  —  "}
                  {it.line}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  }

  if (s.kind === "wins") {
    if (s.layout === "stat-row") {
      return (
        <section style={{ padding: "48px 0" }}>
          <SectionTitle accent={accent}>{s.title}</SectionTitle>
          <div
            style={{
              marginTop: 22,
              display: "grid",
              gridTemplateColumns: `repeat(${Math.min(
                4,
                Math.max(2, s.items.length)
              )}, minmax(0, 1fr))`,
              gap: 16
            }}
          >
            {s.items.map((it, i) => (
              <div
                key={i}
                style={{
                  padding: 18,
                  borderRadius: 14,
                  background: `${accent}10`,
                  border: `1px solid ${accent}33`
                }}
              >
                <div
                  style={{
                    fontSize: 26,
                    fontWeight: 900,
                    color: accent,
                    letterSpacing: "-0.02em"
                  }}
                >
                  {it.value}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: "var(--text-dim)",
                    marginTop: 4
                  }}
                >
                  {it.label}
                </div>
              </div>
            ))}
          </div>
        </section>
      );
    }
    return (
      <section style={{ padding: "48px 0" }}>
        <SectionTitle accent={accent}>{s.title}</SectionTitle>
        <ul style={{ listStyle: "none", padding: 0, marginTop: 16 }}>
          {s.items.map((it, i) => (
            <li
              key={i}
              style={{
                fontSize: 15,
                lineHeight: 1.6,
                padding: "10px 0",
                borderBottom:
                  i === s.items.length - 1
                    ? "none"
                    : "1px solid var(--border)"
              }}
            >
              <strong style={{ color: accent }}>{it.value}</strong>{" "}
              <span style={{ color: "var(--text-dim)" }}>· {it.label}</span>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  if (s.kind === "seeking") {
    return (
      <section style={{ padding: "48px 0" }}>
        <div
          style={{
            padding: 24,
            borderRadius: 16,
            background: `${accent}10`,
            border: `1.5px solid ${accent}40`
          }}
        >
          <SectionTitle accent={accent}>{s.title}</SectionTitle>
          <p
            style={{
              marginTop: 12,
              fontSize: 16,
              lineHeight: 1.65
            }}
          >
            {s.body}
          </p>
          {s.layout === "bullets" && s.bullets && s.bullets.length > 0 && (
            <ul
              style={{
                marginTop: 14,
                paddingLeft: 0,
                listStyle: "none"
              }}
            >
              {s.bullets.map((b, i) => (
                <li
                  key={i}
                  style={{
                    fontSize: 14.5,
                    lineHeight: 1.55,
                    padding: "6px 0",
                    paddingLeft: 22,
                    position: "relative"
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 10,
                      width: 6,
                      height: 6,
                      borderRadius: 999,
                      background: accent
                    }}
                  />
                  {b}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    );
  }

  if (s.kind === "values") {
    return (
      <section style={{ padding: "48px 0" }}>
        <SectionTitle accent={accent}>{s.title}</SectionTitle>
        {s.layout === "cards" ? (
          <div
            style={{
              marginTop: 20,
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(240px, 1fr))",
              gap: 14
            }}
          >
            {s.items.map((it, i) => (
              <div
                key={i}
                style={{
                  padding: 18,
                  borderRadius: 14,
                  border: "1px solid var(--border)",
                  background: "var(--panel-solid)"
                }}
              >
                <div
                  style={{
                    fontWeight: 800,
                    fontSize: 14,
                    color: accent,
                    marginBottom: 6,
                    letterSpacing: "0.02em"
                  }}
                >
                  {it.label}
                </div>
                <div
                  style={{
                    fontSize: 14,
                    lineHeight: 1.6,
                    color: "var(--text-dim)"
                  }}
                >
                  {it.body}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <dl style={{ marginTop: 16 }}>
            {s.items.map((it, i) => (
              <div key={i} style={{ padding: "10px 0" }}>
                <dt
                  style={{
                    fontWeight: 800,
                    fontSize: 14,
                    color: accent,
                    letterSpacing: "0.02em"
                  }}
                >
                  {it.label}
                </dt>
                <dd
                  style={{
                    margin: "4px 0 0",
                    fontSize: 14.5,
                    lineHeight: 1.6,
                    color: "var(--text-dim)"
                  }}
                >
                  {it.body}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </section>
    );
  }

  if (s.kind === "quote") {
    return (
      <section style={{ padding: "56px 0" }}>
        <blockquote
          style={{
            margin: 0,
            padding: "26px 28px",
            borderLeft: `4px solid ${accent}`,
            background: `${accent}08`,
            borderRadius: 8,
            fontSize: "clamp(20px, 2.4vw, 26px)",
            lineHeight: 1.45,
            fontStyle: "italic",
            fontWeight: 600
          }}
        >
          &ldquo;{s.quote}&rdquo;
          {s.attribution && (
            <footer
              style={{
                marginTop: 10,
                fontSize: 13,
                fontStyle: "normal",
                fontWeight: 700,
                color: accent
              }}
            >
              — {s.attribution}
            </footer>
          )}
        </blockquote>
      </section>
    );
  }

  if (s.kind === "contact") {
    return (
      <section
        style={{
          padding: "56px 0 80px",
          textAlign: "center"
        }}
      >
        <SectionTitle accent={accent} center>
          {s.title}
        </SectionTitle>
        <p
          style={{
            marginTop: 10,
            fontSize: 16,
            lineHeight: 1.6,
            color: "var(--text-dim)",
            maxWidth: 540,
            marginLeft: "auto",
            marginRight: "auto"
          }}
        >
          {s.body}
        </p>
        <a
          href={`/conversations/new?with=${id}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            marginTop: 22,
            padding: "14px 26px",
            fontSize: 15,
            fontWeight: 800,
            color: "#fff",
            background: accent,
            borderRadius: 14,
            textDecoration: "none",
            boxShadow: `0 12px 28px -8px ${accent}80`
          }}
        >
          {s.cta_label} →
        </a>
      </section>
    );
  }

  return null;
}

function SectionTitle({
  children,
  accent,
  center = false
}: {
  children: React.ReactNode;
  accent: string;
  center?: boolean;
}) {
  return (
    <h2
      style={{
        fontSize: 12,
        fontWeight: 800,
        letterSpacing: "0.18em",
        textTransform: "uppercase",
        color: accent,
        margin: 0,
        textAlign: center ? "center" : "left"
      }}
    >
      {children}
    </h2>
  );
}

export function CustomSite({
  page,
  ownerId,
  name,
  email,
  handle,
  avatarUrl,
  isOwner
}: {
  page: PortfolioPage;
  ownerId: string;
  name: string;
  email: string | null;
  handle: string;
  avatarUrl: string | null;
  isOwner: boolean;
}) {
  const accent = page.accent_color || "#1f59ff";
  const display = page.font_pair?.display || "Inter";
  const body = page.font_pair?.body || "Inter";

  return (
    <main
      style={
        {
          minHeight: "100vh",
          background:
            page.bg_gradient ||
            "linear-gradient(180deg, #f7f7ff 0%, #ffffff 60%)",
          fontFamily: `"${body}", Inter, sans-serif`,
          // bg_gradient is always light, but this page renders inside the
          // app theme, so var(--text)/var(--text-dim) resolve to white-ish
          // values in dark mode (and too-pale grays in light mode) on the
          // lavender background. Pin readable dark-on-light values so the
          // generated site is theme-proof.
          color: "#16182a",
          "--text": "#16182a",
          "--text-dim": "#555e74",
          "--panel-solid": "#ffffff",
          "--border": "#e7e9f2"
        } as React.CSSProperties
      }
    >
      {/* Preconnect + load the chosen display + body fonts. Safe to
          double-link; browsers de-dupe by URL. */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link
        rel="preconnect"
        href="https://fonts.gstatic.com"
        crossOrigin="anonymous"
      />
      <link
        href={`https://fonts.googleapis.com/css2?family=${encodeURIComponent(
          display
        )}:wght@400;600;700;800;900&family=${encodeURIComponent(
          body
        )}:wght@400;500;600;700&display=swap`}
        rel="stylesheet"
      />

      <div
        style={{
          maxWidth: 920,
          margin: "0 auto",
          padding: "0 24px"
        }}
      >
        {page.sections.map((s, i) => (
          <RenderSection
            key={`${s.kind}-${i}`}
            s={s}
            accent={accent}
            name={name}
            avatarUrl={avatarUrl}
            id={ownerId}
            email={email}
            handle={handle}
            ownerId={ownerId}
            display={display}
          />
        ))}
      </div>

      {/* Tiny footer + (owner-only) regenerate. */}
      <footer
        style={{
          padding: "20px 24px 40px",
          textAlign: "center",
          fontSize: 12,
          color: "var(--text-dim)"
        }}
      >
        <a
          href="/"
          style={{ color: "var(--text-dim)", textDecoration: "none" }}
        >
          made with <strong style={{ color: accent }}>SyncedIn</strong>
        </a>
        {page.vibe_tag && (
          <span style={{ marginLeft: 10, opacity: 0.6 }}>
            · vibe: {page.vibe_tag}
          </span>
        )}
      </footer>
    </main>
  );
}
