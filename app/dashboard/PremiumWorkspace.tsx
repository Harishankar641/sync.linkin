"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export type NetworkPreviewPerson = {
  id: string;
  name: string;
  avatarUrl?: string | null;
  score: number;
  headline?: string | null;
};

type Props = {
  displayName: string;
  syncPercent: number;
  conversationCount: number;
  opportunityCount: number;
  networkCount: number;
  networkPeople?: NetworkPreviewPerson[];
};

const tabs = [
  ["overview", "Overview"],
  ["network", "Twin Network"],
  ["career", "Career Intelligence"]
] as const;

export function PremiumWorkspace({
  displayName,
  syncPercent,
  conversationCount,
  opportunityCount,
  networkCount,
  networkPeople = []
}: Props) {
  const [view, setView] = useState<(typeof tabs)[number][0]>("overview");
  const firstName = displayName.split(/\s+/)[0] || "there";

  const signalBars = useMemo(() => {
    const base = Math.max(18, Math.min(98, syncPercent));
    return [0.58, 0.74, 0.64, 0.88, 0.72, 0.94, 0.82, 1].map((m) =>
      Math.round(base * m)
    );
  }, [syncPercent]);

  const metrics = [
    { label: "Twin readiness", value: `${syncPercent}%`, note: "Context your twin can use" },
    { label: "Twin conversations", value: conversationCount, note: "Persistent agent-to-agent threads" },
    { label: "High-fit signals", value: opportunityCount, note: "Discovery opportunities" },
    { label: "People in range", value: networkCount, note: "Profiles available to explore" }
  ];

  return (
    <section className="premium-workspace premium-command-shell">
      <div className="premium-ambient premium-ambient-one" />
      <div className="premium-ambient premium-ambient-two" />

      <header className="premium-workspace-head">
        <div className="premium-heading-wrap">
          <div className="premium-eyebrow"><span className="signal-dot" /> SyncedIn intelligence layer</div>
          <h1>Good to see you, {firstName}.</h1>
          <p>Your twin, your network, and your career signals — designed to move together.</p>
        </div>
        <div className="premium-head-actions">
          <Link href="/hypernetwork" className="premium-ghost-button">
            Explore network <span>↗</span>
          </Link>
          <Link href="/career-intelligence" className="premium-primary premium-primary-large">
            Career Intelligence <span>→</span>
          </Link>
        </div>
      </header>

      <div className="premium-tabs" role="tablist" aria-label="Workspace views">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={view === key}
            className={view === key ? "active" : ""}
            onClick={() => setView(key)}
          >
            <span className="tab-mark" />{label}
          </button>
        ))}
      </div>

      {view === "overview" && (
        <>
          <div className="premium-metric-grid">
            {metrics.map((m, i) => (
              <article key={m.label} className={`premium-metric metric-${i}`}>
                <span>{m.label}</span>
                <strong>{m.value}</strong>
                <small>{m.note}</small>
              </article>
            ))}
          </div>

          <div className="premium-hero-grid">
            <article className="premium-network-stage">
              <div className="premium-card-head">
                <div>
                  <span className="premium-label">Twin-to-twin network</span>
                  <h2>Connections are being discovered around you.</h2>
                </div>
                <Link href="/hypernetwork" className="premium-inline-link">Open graph →</Link>
              </div>
              <div className="network-stage-body">
                <div className="network-orbit" aria-hidden="true">
                  <div className="orbit orbit-a" /><div className="orbit orbit-b" /><div className="orbit orbit-c" />
                  <span className="network-core"><b>YOU</b><small>{syncPercent}%</small></span>
                  {["n-a", "n-b", "n-c", "n-d", "n-e", "n-f"].map((n, i) => (
                    <span key={n} className={`network-node ${n}`}><i /></span>
                  ))}
                </div>
                <div className="network-stage-copy">
                  <div className="live-engine">
                    <span className="engine-pulse" />
                    <span>Twin conversation engine</span>
                    <b>CONNECTED</b>
                  </div>
                  <p>
                    Your twin uses your goals, context and preferences to find stronger reasons for two people to talk. Open a match to watch the real conversation and its API-backed state.
                  </p>
                  <div className="premium-mini-actions">
                    <Link href="/messages" className="premium-secondary">View conversations <span>→</span></Link>
                    <Link href="/conversations/new" className="premium-secondary">Start a connection <span>+</span></Link>
                  </div>
                </div>
              </div>
            </article>

            <article className="premium-chart-card premium-momentum-card">
              <div className="premium-card-head">
                <div>
                  <span className="premium-label">Network momentum</span>
                  <h2>Signal movement</h2>
                </div>
                <span className="premium-status"><span /> LIVE</span>
              </div>
              <div className="premium-bars" aria-label="Connection momentum visualization">
                {signalBars.map((height, i) => (
                  <div key={i} className="premium-bar-wrap">
                    <div className="premium-bar" style={{ height: `${height}%` }} />
                    <small>{["M", "T", "W", "T", "F", "S", "S", "M"][i]}</small>
                  </div>
                ))}
              </div>
              <div className="premium-chart-foot">
                <span>Signal quality</span>
                <strong>{Math.min(99, Math.max(42, syncPercent + 4))}%</strong>
              </div>
            </article>
          </div>

          {networkPeople.length > 0 && (
            <section className="premium-people-strip">
              <div className="premium-section-heading">
                <div><span className="premium-label">Profiles in your network range</span><h2>People worth a closer look</h2></div>
                <Link href="/dashboard#discover" className="premium-inline-link">View all people →</Link>
              </div>
              <div className="premium-person-grid">
                {networkPeople.slice(0, 6).map((person) => (
                  <Link href={`/conversations/new?user=${encodeURIComponent(person.id)}`} className="premium-person" key={person.id}>
                    <div className="premium-person-avatar">
                      {person.avatarUrl ? <img src={person.avatarUrl} alt="" /> : <span>{person.name.slice(0, 1).toUpperCase()}</span>}
                    </div>
                    <div className="premium-person-copy"><strong>{person.name}</strong><span>{person.headline || "Professional profile"}</span></div>
                    <b>{person.score}%</b>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {view === "network" && (
        <div className="premium-network-full">
          <div className="premium-network-full-copy">
            <span className="premium-label">The network layer</span>
            <h2>Every profile is a possible conversation. Your twin narrows the field.</h2>
            <p>
              The existing SyncedIn network, conversation APIs and twin profiles remain the foundation. This surface simply gives them a more useful command center instead of hiding them behind menus.
            </p>
            <div className="premium-stat-line"><strong>{networkCount}</strong><span>people in discovery range</span></div>
            <div className="premium-stat-line"><strong>{conversationCount}</strong><span>twin-to-twin conversations</span></div>
            <Link href="/hypernetwork" className="premium-primary">Open the full Hypernetwork <span>↗</span></Link>
          </div>
          <div className="premium-network-canvas" aria-label="SyncedIn network visualization">
            <div className="canvas-ring r1" /><div className="canvas-ring r2" /><div className="canvas-ring r3" />
            {Array.from({ length: 14 }).map((_, i) => <span key={i} className={`canvas-node c${i + 1}`} />)}
            {Array.from({ length: 9 }).map((_, i) => <i key={i} className={`canvas-line e${i + 1}`} />)}
            <span className="canvas-core">TWIN<br /><small>NETWORK</small></span>
          </div>
        </div>
      )}

      {view === "career" && (
        <div className="premium-career-panel">
          <div>
            <span className="premium-label">Career intelligence</span>
            <h2>Resume → skill graph → opportunity fit.</h2>
            <p>Parse your resume, extract structured skills and compare the content against jobs, job fairs and opportunities. The match is explainable instead of being a black box.</p>
            <div className="career-pill-row"><span>Resume parsing</span><span>Skill extraction</span><span>Fit scoring</span><span>Visual insights</span></div>
            <Link href="/career-intelligence" className="premium-primary">Start resume analysis <span>→</span></Link>
          </div>
          <div className="career-flow premium-flow-visual" aria-hidden="true"><div><b>01</b>Resume</div><span>→</span><div><b>02</b>Skills</div><span>→</span><div><b>03</b>Fit</div><span>→</span><div><b>04</b>Action</div></div>
        </div>
      )}
    </section>
  );
}
