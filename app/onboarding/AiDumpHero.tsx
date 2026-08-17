"use client";

import { useState } from "react";

// The fastest onboarding path: the AI you already talk to knows you best.
// Copy this prompt → paste into that AI → paste its answer into the dump box.
const AI_PROMPT = `Give me everything you know about me — my personality, current goals, active projects, communication style, key relationships and the dynamics with each, ongoing deals or negotiations, professional background, what I'm good at and what I struggle with, my deal-breakers, how I make decisions, what I'm trying to accomplish in the next 6–12 months, and what kinds of opportunities I'd say yes to immediately.

Be specific and concrete. Don't summarize — include exact phrases I use, quotes from past conversations if you have them, and named examples. If you have memories or stored context about me, surface all of it. If you don't know something, say "unknown" rather than guessing.

Output as plain text, structured by these headings:
# Background
# Current goals (next 6–12 months)
# Active projects
# Communication style (with examples of how I write)
# Key relationships
# Ongoing deals / negotiations
# Decision style
# Deal-breakers and constraints
# Opportunities I'd say yes to immediately`;

// Logos via Google's favicon CDN — high-resolution, no manual hosting.
const FAVICON = (domain: string) =>
  `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;

const APPS = [
  { name: "ChatGPT", url: "https://chatgpt.com", logo: FAVICON("chatgpt.com") },
  { name: "Claude", url: "https://claude.ai", logo: FAVICON("claude.ai") },
  {
    name: "Gemini",
    url: "https://gemini.google.com/app",
    logo: FAVICON("gemini.google.com")
  },
  { name: "Grok", url: "https://grok.com", logo: FAVICON("grok.com") }
];

export function AiDumpHero() {
  const [copied, setCopied] = useState(false);

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(AI_PROMPT);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked */
    }
  }

  return (
    <div className="retro-panel retro-shadow p-5">
      <div className="retro-label">fastest path — about 30 seconds</div>
      {/* Headline removed: the parent OnboardingWizard step header
          already shows 'Let the AI you already use describe you.' Showing
          it again here just made the page look duplicated. */}
      <p className="mt-2 retro-dim text-sm leading-relaxed">
        Copy the prompt, open your AI, paste its answer into the box
        below — that&apos;s a real twin in one step.
      </p>

      <button
        type="button"
        onClick={copyPrompt}
        className="retro-btn retro-btn-primary w-full mt-4"
      >
        {copied ? "✓ Prompt copied — now open your AI" : "1 · Copy the prompt"}
      </button>

      <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
        {APPS.map((a) => (
          <a
            key={a.name}
            href={a.url}
            target="_blank"
            rel="noopener noreferrer"
            className="retro-btn text-xs flex items-center gap-2"
          >
            <img
              src={a.logo}
              alt=""
              width={18}
              height={18}
              style={{
                display: "inline-block",
                borderRadius: 4,
                flexShrink: 0
              }}
              loading="lazy"
            />
            <span>
              2 · Open <span style={{ fontWeight: 700 }}>{a.name}</span>
            </span>
          </a>
        ))}
      </div>

      <p className="mt-3 retro-dim text-[11px]">
        3 · Paste the AI&apos;s full answer into the box below. Don&apos;t want
        to? A scan of your public footprint via Exa is coming as a one-click
        alternative.
      </p>
    </div>
  );
}
