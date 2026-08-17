"use client";

import { useState } from "react";

/**
 * Pixel-faithful Linkme sidebar + native-feeling SyncedIn surfaces
 * embedded as new sections. Sales-demo only. All styling inline, no
 * dependency on the rest of the SyncedIn design system — the goal is
 * to LOOK like Linkme, not like SyncedIn.
 *
 * Sections shown in the main panel are tabs the visitor clicks to
 * swap views. Default lands on "Your AI Twin" so the wow moment
 * happens immediately.
 */

type View =
  | "ai_twin"
  | "twin_inbox"
  | "twin_insights"
  | "boost_pricing";

const LINK_COLOR = "#0e1322";
const LINK_DIM = "#6e7287";
const LINK_BG_HOVER = "#f3f4f7";
const LINK_BG_ACTIVE = "#eef0f3";
const LINK_BORDER = "#e6e7eb";
const ACCENT = "#f97c5c"; // Linkme uses a coral/peach accent
const SYNCEDIN_BLUE = "#2358ff";
const SYNCEDIN_PURPLE = "#6b2dc9";

export function LinkmePartnerDemo() {
  const [view, setView] = useState<View>("ai_twin");

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "#fafafa",
        color: LINK_COLOR,
        fontFamily:
          'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        fontSize: 14
      }}
    >
      {/* Demo ribbon — small banner so anyone landing here knows it's
          a partnership preview, not the real Linkme app. */}
      <div
        style={{
          background:
            "linear-gradient(90deg, #2358ff 0%, #6b2dc9 50%, #f59e0b 100%)",
          color: "#fff",
          padding: "8px 14px",
          fontSize: 12,
          fontWeight: 700,
          textAlign: "center",
          letterSpacing: "0.04em"
        }}
      >
        ✦ Linkme × SyncedIn — partnership preview ✦ how it could look
        living natively inside Linkme
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "260px 1fr",
          gap: 0,
          minHeight: "calc(100dvh - 36px)"
        }}
      >
        {/* SIDEBAR — pixel-honoring Linkme */}
        <aside
          style={{
            borderRight: `1px solid ${LINK_BORDER}`,
            padding: "16px 12px 24px",
            background: "#fff",
            display: "flex",
            flexDirection: "column",
            gap: 4
          }}
        >
          {/* Brand */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 8px 14px"
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background:
                  "linear-gradient(135deg, #ffb3a3 0%, #ff7960 50%, #ff4d8a 100%)",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 11,
                fontWeight: 800
              }}
            >
              1me
            </div>
            <div style={{ fontWeight: 800, fontSize: 17 }}>Linkme</div>
          </div>

          <div
            style={{
              height: 1,
              background: LINK_BORDER,
              margin: "0 -12px 8px -12px"
            }}
          />

          <NavItem icon="⌕" label="Search" />
          <NavItem icon="◎" label="Profile" active />
          <NavItem icon="◌" label="Messages" />
          <NavItem icon="▥" label="Analytics" />
          <NavItem icon="◉" label="Agency" />
          <NavItem icon="✈️" label="Post" />

          <SectionLabel>Make Money</SectionLabel>
          <NavItem icon="▣" label="Your Sales" />
          <NavItem icon="$" label="Collect Tips" />
          <NavItem icon="◇" label="Create & Sell Merch" />
          <NavItem icon="◇" label="Sell Digital Products" />
          <NavItem icon="❤️" label="Automations" badge="Beta" badgeColor="#f59e0b" />
          <NavItem icon="◇" label="Course Builder" badge="New" badgeColor={SYNCEDIN_BLUE} />
          <NavItem icon="□" label="Leads" badge="New" badgeColor={SYNCEDIN_BLUE} />

          {/* NEW SyncedIn section — inserted as if native Linkme nav */}
          <SectionLabel>
            Talk to Me{" "}
            <span
              style={{
                fontSize: 8,
                fontWeight: 800,
                letterSpacing: "0.12em",
                background: `linear-gradient(135deg, ${SYNCEDIN_BLUE}, ${SYNCEDIN_PURPLE})`,
                color: "#fff",
                padding: "2px 6px",
                borderRadius: 999,
                marginLeft: 6,
                textTransform: "uppercase"
              }}
            >
              new · syncedin
            </span>
          </SectionLabel>
          <NavItem
            icon="◇"
            label="Your AI Twin"
            active={view === "ai_twin"}
            onClick={() => setView("ai_twin")}
          />
          <NavItem
            icon="↓"
            label="Twin Inbox"
            badge="3 paid"
            badgeColor="#22c55e"
            active={view === "twin_inbox"}
            onClick={() => setView("twin_inbox")}
          />
          <NavItem
            icon="◎"
            label="Twin Insights"
            active={view === "twin_insights"}
            onClick={() => setView("twin_insights")}
          />
          <NavItem
            icon="⚡"
            label="Boost Pricing"
            active={view === "boost_pricing"}
            onClick={() => setView("boost_pricing")}
          />

          <div style={{ flex: 1 }} />

          {/* Bottom cards — Linkme AI + Get Linkme Pro (faithful) +
              the new Get Synced In Pro mirroring it */}
          <BottomCard
            icon={
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background:
                    "linear-gradient(135deg, #1a1a1a 0%, #4a4a4a 100%)",
                  color: "#ff6b6b",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 13,
                  fontWeight: 800,
                  fontStyle: "italic"
                }}
              >
                AI
              </div>
            }
            title="Linkme AI"
            subtitle="Your assistant"
            border="linear-gradient(135deg, #ffe2cc 0%, #fcccdb 100%)"
          />
          <BottomCard
            icon={
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background:
                    "linear-gradient(135deg, #61e9c9 0%, #4fc3e0 100%)",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  fontWeight: 800
                }}
              >
                1me
              </div>
            }
            title="Get Linkme Pro"
            subtitle="Unlock everything"
            border="linear-gradient(135deg, #c8f3e2 0%, #cce7f5 100%)"
          />
          <BottomCard
            icon={
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: `linear-gradient(135deg, ${SYNCEDIN_BLUE} 0%, ${SYNCEDIN_PURPLE} 100%)`,
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 14,
                  fontWeight: 800
                }}
              >
                ✦
              </div>
            }
            title="Synced In Pro"
            subtitle="Paid DMs · Inbox · Insights"
            border={`linear-gradient(135deg, ${SYNCEDIN_BLUE}40 0%, ${SYNCEDIN_PURPLE}40 100%)`}
          />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 8px",
              color: LINK_DIM,
              fontSize: 14
            }}
          >
            <span>◇</span>
            <span>Help Center</span>
          </div>
        </aside>

        {/* MAIN PANEL — the SyncedIn surface they clicked, styled to
            feel native to Linkme's panel chrome */}
        <main style={{ padding: "28px 36px" }}>
          {view === "ai_twin" && <AITwinPreview />}
          {view === "twin_inbox" && <TwinInbox />}
          {view === "twin_insights" && <TwinInsights />}
          {view === "boost_pricing" && <BoostPricing />}
        </main>
      </div>
    </div>
  );
}

// ---------- Nav primitives (Linkme styled) ----------

function NavItem({
  icon,
  label,
  active,
  badge,
  badgeColor,
  onClick
}: {
  icon: string;
  label: string;
  active?: boolean;
  badge?: string;
  badgeColor?: string;
  onClick?: () => void;
}) {
  const clickable = !!onClick;
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 10px",
        borderRadius: 10,
        background: active ? LINK_BG_ACTIVE : "transparent",
        color: LINK_COLOR,
        border: "none",
        fontFamily: "inherit",
        fontSize: 14.5,
        fontWeight: active ? 700 : 500,
        cursor: clickable || onClick ? "pointer" : "default",
        textAlign: "left",
        width: "100%"
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.background = LINK_BG_HOVER;
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.background = "transparent";
      }}
    >
      <span style={{ fontSize: 18, lineHeight: 1, width: 22 }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      {badge && (
        <span
          style={{
            background: badgeColor ?? SYNCEDIN_BLUE,
            color: "#fff",
            fontSize: 10,
            fontWeight: 800,
            padding: "3px 8px",
            borderRadius: 999,
            letterSpacing: "0.04em"
          }}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: "16px 10px 6px",
        fontSize: 12,
        fontWeight: 700,
        color: LINK_DIM,
        display: "flex",
        alignItems: "center"
      }}
    >
      {children}
    </div>
  );
}

function BottomCard({
  icon,
  title,
  subtitle,
  border
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  border: string;
}) {
  return (
    <div
      style={{
        padding: 2,
        borderRadius: 14,
        background: border,
        marginTop: 8
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 12px",
          background: "#fff",
          borderRadius: 12
        }}
      >
        {icon}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 14, lineHeight: 1.2 }}>
            {title}
          </div>
          <div
            style={{
              fontSize: 12,
              color: LINK_DIM,
              marginTop: 2,
              lineHeight: 1.3
            }}
          >
            {subtitle}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- Right-panel surfaces ----------

function PanelHeader({
  eyebrow,
  title,
  sub
}: {
  eyebrow: string;
  title: string;
  sub: string;
}) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: SYNCEDIN_PURPLE,
          marginBottom: 8
        }}
      >
        {eyebrow}
      </div>
      <h1
        style={{
          margin: 0,
          fontSize: 28,
          fontWeight: 800,
          lineHeight: 1.2,
          letterSpacing: "-0.01em"
        }}
      >
        {title}
      </h1>
      <p
        style={{
          margin: "8px 0 0 0",
          fontSize: 14.5,
          color: LINK_DIM,
          lineHeight: 1.5,
          maxWidth: 640
        }}
      >
        {sub}
      </p>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "#fff",
        border: `1px solid ${LINK_BORDER}`,
        borderRadius: 16,
        padding: 18
      }}
    >
      {children}
    </div>
  );
}

function AITwinPreview() {
  return (
    <>
      <PanelHeader
        eyebrow="Your AI Twin · powered by SyncedIn"
        title="What visitors see when they tap your link"
        sub="Drop this on your Link.me, IG bio, or anywhere. Visitors talk to your twin free. When they need the real you, they boost their message to the top of your inbox for $."
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 360px) minmax(0, 1fr)",
          gap: 20,
          alignItems: "start"
        }}
      >
        {/* Phone-frame preview of the visitor chat */}
        <div
          style={{
            background: "#0e1322",
            borderRadius: 28,
            padding: 8,
            boxShadow:
              "0 18px 40px -16px rgba(15, 23, 42, 0.35), 0 2px 8px -2px rgba(15, 23, 42, 0.18)"
          }}
        >
          <div
            style={{
              background: "#f4f5fa",
              borderRadius: 22,
              overflow: "hidden",
              height: 580,
              display: "flex",
              flexDirection: "column"
            }}
          >
            <div
              style={{
                padding: "14px 14px 10px",
                borderBottom: "1px solid #e2e6f0",
                background: "#fff",
                display: "flex",
                alignItems: "center",
                gap: 10
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  background: `linear-gradient(135deg, ${SYNCEDIN_BLUE}, ${SYNCEDIN_PURPLE})`,
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 800
                }}
              >
                J
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>
                  Jackson's AI Twin
                </div>
                <div style={{ fontSize: 11, color: LINK_DIM }}>
                  free AI reply · paid human reply
                </div>
              </div>
              <span
                style={{
                  padding: "4px 10px",
                  borderRadius: 999,
                  fontSize: 11,
                  fontWeight: 800,
                  background:
                    "linear-gradient(135deg, #ffb800 0%, #ff7a00 100%)",
                  color: "#fff"
                }}
              >
                ⚡ Boost
              </span>
            </div>
            <div
              style={{
                flex: 1,
                padding: 14,
                display: "flex",
                flexDirection: "column",
                gap: 10
              }}
            >
              <Bubble role="them">
                Hey — I run a B2B SaaS in fintech. Worth a chat with Jackson
                about advisory?
              </Bubble>
              <Bubble role="me">
                Yes — fintech operator advisory is one of Jackson's most
                requested asks. Best fit: his $250/hr office hours →
                cal.com/jackjay/advisory. If you'd rather get a fast yes/no
                from him directly, boost this message to the top of his
                inbox for $25.
              </Bubble>
              <Bubble role="them">Boost it.</Bubble>
              <Bubble role="me" highlighted>
                Done — your message is now pinned at the top of Jackson's
                inbox. He'll reply within 24h. Receipt sent to you.
              </Bubble>
            </div>
            <div
              style={{
                padding: 10,
                borderTop: "1px solid #e2e6f0",
                background: "#fff",
                display: "flex",
                gap: 8
              }}
            >
              <div
                style={{
                  flex: 1,
                  padding: "10px 12px",
                  borderRadius: 18,
                  border: "1px solid #e2e6f0",
                  background: "#f4f5fa",
                  fontSize: 13,
                  color: LINK_DIM
                }}
              >
                Message Jackson's twin…
              </div>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  background: `linear-gradient(135deg, ${SYNCEDIN_BLUE}, ${SYNCEDIN_PURPLE})`,
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 16
                }}
              >
                ↑
              </div>
            </div>
          </div>
        </div>

        {/* Three explainer cards */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 14
          }}
        >
          <Card>
            <div style={{ fontWeight: 800, fontSize: 16 }}>
              ↗ Routes visitors to your existing links
            </div>
            <div
              style={{
                marginTop: 6,
                color: LINK_DIM,
                fontSize: 14,
                lineHeight: 1.55
              }}
            >
              Your twin knows about every link on your Link.me. When someone
              asks &ldquo;where's the course?&rdquo; it sends them straight
              to the right URL. Conversion goes up, your clicks stay yours.
            </div>
          </Card>
          <Card>
            <div style={{ fontWeight: 800, fontSize: 16 }}>
              ⚡ Paid attention layer on every page
            </div>
            <div
              style={{
                marginTop: 6,
                color: LINK_DIM,
                fontSize: 14,
                lineHeight: 1.55
              }}
            >
              When the AI can't fully satisfy a request, visitors can pay
              $5/$25/$100 (you set the tiers) to jump the queue and get a
              real reply from you. 80/20 split, Stripe-direct payouts.
            </div>
          </Card>
          <Card>
            <div style={{ fontWeight: 800, fontSize: 16 }}>
              ◎ The data you've been missing
            </div>
            <div
              style={{
                marginTop: 6,
                color: LINK_DIM,
                fontSize: 14,
                lineHeight: 1.55
              }}
            >
              Weekly digest: &ldquo;12 visitors asked about advisory this
              week, 8 wanted your course. Consider a paid intro service.
              &rdquo; The twin tells you what to build, sell, or stop.
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

function Bubble({
  role,
  highlighted,
  children
}: {
  role: "me" | "them";
  highlighted?: boolean;
  children: React.ReactNode;
}) {
  const mine = role === "me";
  return (
    <div
      style={{
        alignSelf: mine ? "flex-start" : "flex-end",
        maxWidth: "82%",
        padding: "8px 12px",
        borderRadius: 16,
        background: mine
          ? highlighted
            ? "linear-gradient(135deg, #ffb800, #ff7a00)"
            : "#fff"
          : `linear-gradient(135deg, ${SYNCEDIN_BLUE}, #4a3dff)`,
        color: mine ? (highlighted ? "#0e1322" : LINK_COLOR) : "#fff",
        border: mine && !highlighted ? "1px solid #e2e6f0" : "none",
        fontSize: 13,
        lineHeight: 1.45,
        fontWeight: highlighted ? 700 : 400
      }}
    >
      {children}
    </div>
  );
}

function TwinInbox() {
  const rows = [
    {
      name: "Marcus Chen",
      role: "VC at Sequoia",
      msg: "Got 15min to discuss your fintech thesis next week?",
      paid: true,
      cents: 100,
      time: "12m ago"
    },
    {
      name: "Sara Okafor",
      role: "Founder, healthcare AI",
      msg: "Your twin said you might advise. Open to a 30min call?",
      paid: true,
      cents: 25,
      time: "1h ago"
    },
    {
      name: "Ryan Patel",
      role: "Indie hacker",
      msg: "Loved your last podcast. Quick Q on monetization—",
      paid: true,
      cents: 25,
      time: "3h ago"
    },
    {
      name: "Anna Liu",
      role: "Product at Stripe",
      msg: "Asked your twin about partnerships, want to follow up direct.",
      paid: false,
      time: "5h ago"
    },
    {
      name: "Devon Park",
      role: "—",
      msg: "Big fan! Just wanted to say thanks for the course.",
      paid: false,
      time: "yesterday"
    }
  ];
  return (
    <>
      <PanelHeader
        eyebrow="Twin Inbox · powered by SyncedIn"
        title="Paid messages on top. Always."
        sub="Boosted threads are pinned and refundable if you don't reply within 24h. Free threads sit below — handle them when you can."
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {rows.map((r, i) => (
          <div
            key={i}
            style={{
              background: "#fff",
              border: `1px solid ${LINK_BORDER}`,
              borderRadius: 14,
              padding: "14px 16px",
              display: "flex",
              alignItems: "center",
              gap: 14,
              borderLeft: r.paid
                ? `4px solid ${ACCENT}`
                : `1px solid ${LINK_BORDER}`
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                background: `linear-gradient(135deg, ${SYNCEDIN_BLUE}, ${SYNCEDIN_PURPLE})`,
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 800,
                flexShrink: 0
              }}
            >
              {r.name.slice(0, 1)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8
                }}
              >
                <div style={{ fontWeight: 800, fontSize: 14 }}>
                  {r.name}
                </div>
                <div style={{ fontSize: 12, color: LINK_DIM }}>{r.role}</div>
                {r.paid && (
                  <span
                    style={{
                      marginLeft: "auto",
                      background:
                        "linear-gradient(135deg, #ffb800, #ff7a00)",
                      color: "#fff",
                      fontSize: 10,
                      fontWeight: 800,
                      padding: "3px 8px",
                      borderRadius: 999,
                      letterSpacing: "0.04em"
                    }}
                  >
                    ⚡ ${(r.cents ?? 0) / 1} BOOST
                  </span>
                )}
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: LINK_COLOR,
                  marginTop: 4,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap"
                }}
              >
                {r.msg}
              </div>
            </div>
            <div style={{ fontSize: 12, color: LINK_DIM, flexShrink: 0 }}>
              {r.time}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function TwinInsights() {
  const intents = [
    { label: "Advisory", count: 12, suggested: "Add a $99 paid reply tier" },
    { label: "Course questions", count: 8, suggested: "Pin course to first link" },
    { label: "Intro requests", count: 6, suggested: "Create an intro-request form" },
    { label: "Speaking", count: 4, suggested: "Add a speakers-bureau link" },
    { label: "Investment", count: 3, suggested: "Build an investor FAQ page" }
  ];
  return (
    <>
      <PanelHeader
        eyebrow="Twin Insights · powered by SyncedIn"
        title="What people actually want from you this week"
        sub="Your twin had 38 conversations. Here's what visitors asked for, ranked by demand. Each row tells you exactly what to add to your Link.me."
      />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16
        }}
      >
        <Card>
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: LINK_DIM,
              marginBottom: 10
            }}
          >
            this week
          </div>
          <div style={{ fontSize: 44, fontWeight: 800, lineHeight: 1 }}>
            38
          </div>
          <div style={{ fontSize: 13, color: LINK_DIM, marginTop: 4 }}>
            twin conversations
          </div>
          <div
            style={{
              marginTop: 14,
              fontSize: 12,
              color: "#22c55e",
              fontWeight: 700
            }}
          >
            ↑ 47% from last week
          </div>
        </Card>
        <Card>
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: LINK_DIM,
              marginBottom: 10
            }}
          >
            paid boosts
          </div>
          <div style={{ fontSize: 44, fontWeight: 800, lineHeight: 1 }}>
            $325
          </div>
          <div style={{ fontSize: 13, color: LINK_DIM, marginTop: 4 }}>
            13 paid messages · 80% to you
          </div>
          <div
            style={{
              marginTop: 14,
              fontSize: 12,
              color: "#22c55e",
              fontWeight: 700
            }}
          >
            ↑ first week live
          </div>
        </Card>
      </div>

      <div style={{ marginTop: 22 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 800,
            color: LINK_COLOR,
            marginBottom: 10
          }}
        >
          Top intents your visitors expressed
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {intents.map((it, i) => (
            <div
              key={i}
              style={{
                background: "#fff",
                border: `1px solid ${LINK_BORDER}`,
                borderRadius: 12,
                padding: "12px 16px",
                display: "flex",
                alignItems: "center",
                gap: 16
              }}
            >
              <div
                style={{
                  width: 44,
                  textAlign: "right",
                  fontSize: 20,
                  fontWeight: 800,
                  color: SYNCEDIN_PURPLE
                }}
              >
                {it.count}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>
                  {it.label}
                </div>
                <div
                  style={{ fontSize: 12, color: LINK_DIM, marginTop: 2 }}
                >
                  Suggested: {it.suggested}
                </div>
              </div>
              <button
                type="button"
                style={{
                  border: `1px solid ${LINK_BORDER}`,
                  background: "#fff",
                  borderRadius: 999,
                  padding: "6px 12px",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer"
                }}
              >
                Apply →
              </button>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function BoostPricing() {
  const tiers = [
    {
      price: 5,
      label: "Quick reply",
      desc: "Visitor gets a short personal reply within 48h."
    },
    {
      price: 25,
      label: "Real answer",
      desc: "You write a paragraph or two; 24h SLA, refundable if missed."
    },
    {
      price: 100,
      label: "15-min call slot",
      desc: "Auto-books into your Calendly. 24h SLA, fully refundable."
    }
  ];
  return (
    <>
      <PanelHeader
        eyebrow="Boost Pricing · powered by SyncedIn"
        title="Set the price of your attention"
        sub="Three tiers, visible on every visitor's chat. You keep 80%, Stripe Connect routes directly to your bank. Toggle any tier off anytime."
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 14
        }}
      >
        {tiers.map((t, i) => (
          <div
            key={i}
            style={{
              background: "#fff",
              border:
                i === 1
                  ? `2px solid ${ACCENT}`
                  : `1px solid ${LINK_BORDER}`,
              borderRadius: 16,
              padding: 18,
              position: "relative"
            }}
          >
            {i === 1 && (
              <span
                style={{
                  position: "absolute",
                  top: -10,
                  left: 14,
                  background: ACCENT,
                  color: "#fff",
                  fontSize: 10,
                  fontWeight: 800,
                  padding: "3px 8px",
                  borderRadius: 999,
                  letterSpacing: "0.04em"
                }}
              >
                MOST POPULAR
              </span>
            )}
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: LINK_DIM
              }}
            >
              {t.label}
            </div>
            <div
              style={{
                fontSize: 36,
                fontWeight: 800,
                marginTop: 6,
                lineHeight: 1
              }}
            >
              ${t.price}
            </div>
            <div
              style={{
                fontSize: 13,
                color: LINK_DIM,
                marginTop: 10,
                lineHeight: 1.5,
                minHeight: 60
              }}
            >
              {t.desc}
            </div>
            <label
              style={{
                marginTop: 16,
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 13,
                color: LINK_COLOR
              }}
            >
              <input
                type="checkbox"
                defaultChecked
                style={{ width: 16, height: 16 }}
              />
              Enabled
            </label>
          </div>
        ))}
      </div>

      <div
        style={{
          marginTop: 22,
          padding: "18px 20px",
          background: "#fff",
          border: `1px solid ${LINK_BORDER}`,
          borderRadius: 16,
          display: "flex",
          alignItems: "center",
          gap: 18
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 15 }}>
            Stripe Connect — payouts go straight to your bank
          </div>
          <div
            style={{
              fontSize: 13,
              color: LINK_DIM,
              marginTop: 4,
              lineHeight: 1.5
            }}
          >
            80/20 split: you keep $4 of every $5, $20 of every $25, $80 of
            every $100. Daily auto-payouts. Tax docs handled.
          </div>
        </div>
        <button
          type="button"
          style={{
            background: `linear-gradient(135deg, ${SYNCEDIN_BLUE}, ${SYNCEDIN_PURPLE})`,
            color: "#fff",
            border: "none",
            borderRadius: 12,
            padding: "12px 22px",
            fontWeight: 800,
            fontSize: 14,
            cursor: "pointer"
          }}
        >
          Connect Stripe →
        </button>
      </div>
    </>
  );
}
