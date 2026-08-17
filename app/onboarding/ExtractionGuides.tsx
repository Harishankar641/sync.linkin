"use client";

import { useState } from "react";

const AI_PROMPT = `I am building my digital twin that is going to network for me.

Give me everything that would help coordinate: my personality, my needs, my wants, my offers, current goals, active projects, communication style, key relationships, professional background, what I'm good at and what I struggle with, how I make decisions, what I'm trying to accomplish in the next 6–12 months, what my ultimate north star is, and what kinds of opportunities I'd say yes to immediately.

Be specific and concrete. Don't summarize — include exact phrases I use, quotes from past conversations if you have them, and named examples. If you have memories or stored context about me, surface all of it. If you don't know something, say "unknown" rather than guessing.

Output as plain text, structured by these headings:
# Personality
# Needs
# Wants
# Offers (what I bring)
# Current goals (next 6–12 months)
# Active projects
# Communication style (with examples of how I write)
# Key relationships
# Professional background
# What I'm good at
# What I struggle with
# How I make decisions
# My ultimate north star
# Opportunities I'd say yes to immediately`;

type Guide = {
  id: string;
  title: string;
  subtitle: string;
  body: React.ReactNode;
};

export function ExtractionGuides() {
  const [open, setOpen] = useState<string | null>(null);

  const guides: Guide[] = [
    {
      id: "ai-dump",
      title: "Ask your other AI for everything it knows about you",
      subtitle:
        "ChatGPT, Claude, Gemini — the AI you talk to most has the richest profile of you. Pull it.",
      body: (
        <div className="space-y-3 text-sm">
          <p className="text-[var(--text)]">
            Copy the prompt below, paste it into your most-used AI chat, and
            copy the entire response back into the text area on this page.
          </p>
          <CopyBlock label="The extraction prompt" text={AI_PROMPT} />
          <details className=" border border-[var(--border)]">
            <summary className="px-3 py-2 cursor-pointer text-sm text-[var(--text)]">
              How to find each AI&apos;s stored memories
            </summary>
            <div className="px-3 pb-3 space-y-2 text-sm text-[var(--text-dim)]">
              <p>
                <strong className="text-[var(--text)]">ChatGPT:</strong> Settings
                → Personalization → Manage Memories. Copy everything there.
                Also run the prompt above in a fresh chat — memories alone are
                shorter than what GPT actually knows about you across
                conversations.
              </p>
              <p>
                <strong className="text-[var(--text)]">Claude:</strong> Open your
                most-used project → Project Instructions. Copy. Then run the
                prompt above in that project (so it has the project context).
              </p>
              <p>
                <strong className="text-[var(--text)]">Gemini:</strong> Settings →
                Activity. Or open{" "}
                <span className="text-[var(--text)]">
                  takeout.google.com
                </span>{" "}
                and request a Gemini export. Run the prompt above in
                gemini.google.com for the conversational summary.
              </p>
            </div>
          </details>
        </div>
      )
    },
    {
      id: "whatsapp",
      title: "Export WhatsApp chats (best for personal voice)",
      subtitle:
        "WhatsApp gives one-tap text export. Pull a few representative chats — your twin will mirror your real tone.",
      body: (
        <div className="space-y-2 text-sm text-[var(--text)]">
          <ol className="list-decimal list-inside space-y-1 text-[var(--text)]">
            <li>Open WhatsApp on your phone.</li>
            <li>Open the chat you want to export (pick someone you write to often).</li>
            <li>
              Tap the contact name at the top → scroll to bottom →{" "}
              <strong>Export Chat</strong>.
            </li>
            <li>
              Choose <strong>Without Media</strong>.
            </li>
            <li>Send to yourself via email or save to Files.</li>
            <li>
              Open the .txt file. Find a section with 50–200 of YOUR messages
              (lines starting with your name). Copy and paste those into the
              text area below.
            </li>
          </ol>
          <p className="text-[var(--text-dim)] text-xs">
            Tip: pull 2–3 chats with different people — a friend, a colleague,
            a business contact. Different audiences = better voice
            calibration.
          </p>
        </div>
      )
    },
    {
      id: "imessage",
      title: "Export iMessage (Mac)",
      subtitle:
        "iMessage doesn't have native export. Use the open-source CLI tool or copy manually.",
      body: (
        <div className="space-y-3 text-sm text-[var(--text)]">
          <div>
            <strong className="text-[var(--text)]">Option A — manual (fastest):</strong>
            <ol className="list-decimal list-inside space-y-1 mt-1">
              <li>Open Messages on your Mac.</li>
              <li>Open 2–3 active threads.</li>
              <li>
                Select 50–150 of your messages (click first, shift-click last).
              </li>
              <li>Copy → paste into the text area below.</li>
            </ol>
          </div>
          <div>
            <strong className="text-[var(--text)]">Option B — full export with imessage-exporter:</strong>
            <CopyBlock
              label="Install + run"
              text={`brew install imessage-exporter
imessage-exporter -f txt -o ~/Desktop/imessages -t YOUR_PHONE_NUMBER`}
            />
            <p className="text-[var(--text-dim)] text-xs mt-1">
              Open source, runs locally, never uploads your data. Repo:{" "}
              <span className="text-[var(--text)]">
                github.com/ReagentX/imessage-exporter
              </span>
              . Replace YOUR_PHONE_NUMBER with your number to filter to your
              outgoing messages only.
            </p>
          </div>
          <div>
            <strong className="text-[var(--text)]">Option C — iMazing</strong>{" "}
            <span className="text-[var(--text-dim)]">
              ($40 GUI app at imazing.com if you want point-and-click).
            </span>
          </div>
        </div>
      )
    },
    {
      id: "telegram",
      title: "Export Telegram chats",
      subtitle: "Telegram Desktop has a one-click export.",
      body: (
        <div className="space-y-2 text-sm text-[var(--text)]">
          <ol className="list-decimal list-inside space-y-1">
            <li>Open Telegram Desktop (Mac, Windows, or Linux).</li>
            <li>
              Open a chat → ⋮ menu (top right) →{" "}
              <strong>Export chat history</strong>.
            </li>
            <li>
              Format: <strong>Plain text</strong>. Period: All time or Last
              year.
            </li>
            <li>Click Export. Open the resulting .txt file.</li>
            <li>
              Copy a representative sample of your messages → paste into the
              text area below.
            </li>
          </ol>
        </div>
      )
    },
    {
      id: "linkedin",
      title: "Pull LinkedIn data (background + writing style)",
      subtitle:
        "Useful for the professional half of your twin — bio, posts, message history.",
      body: (
        <div className="space-y-2 text-sm text-[var(--text)]">
          <ol className="list-decimal list-inside space-y-1">
            <li>
              Go to linkedin.com → Me → Settings & Privacy → Data Privacy →{" "}
              <strong>Get a copy of your data</strong>.
            </li>
            <li>Select &quot;Want something in particular?&quot; → check Articles, Messages, Profile.</li>
            <li>Wait 10–24h for the email with your zip file.</li>
            <li>
              Open <code>messages.csv</code> — keep your sent messages, paste a
              representative sample below.
            </li>
            <li>
              Also paste your About section + 3–5 of your top posts (they
              capture how you write publicly).
            </li>
          </ol>
        </div>
      )
    },
    {
      id: "email",
      title: "Sent email (most underrated source)",
      subtitle:
        "How you write to people you negotiate with is gold for the twin. Pull 10–20 sent emails.",
      body: (
        <div className="space-y-2 text-sm text-[var(--text)]">
          <p>
            Open your Sent folder. Pick 10–20 messages that represent how you
            actually write — a mix of: a pitch to an investor, a sales reply, a
            response to a partner, a friendly check-in. Copy the body of each
            (skip signatures) and paste them into the text area below,
            separated by &quot;---&quot;.
          </p>
          <p className="text-[var(--text-dim)] text-xs">
            If you have Gmail and want bulk: Settings → Forwarding & POP/IMAP →
            enable IMAP, then use a tool like Mail Merge or just Google
            Takeout&apos;s Mail export.
          </p>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-2">
      <div className="text-sm text-[var(--text)] font-medium">
        How to feed your twin more context
      </div>
      <p className="text-xs text-[var(--text-dim)]">
        Every source you add makes your twin sound more like you. Pick one to
        start — the AI context dump (first one below) gives the biggest jump.
      </p>
      <div className="mt-3 space-y-2">
        {guides.map((g) => (
          <div
            key={g.id}
            className=" border border-[var(--border)] overflow-hidden"
          >
            <button
              type="button"
              onClick={() => setOpen(open === g.id ? null : g.id)}
              className="w-full text-left px-4 py-3 flex items-center justify-between hover:bg-[var(--panel)] transition"
            >
              <div className="min-w-0">
                <div className="text-sm font-medium text-[var(--text)]">
                  {g.title}
                </div>
                <div className="text-xs text-[var(--text-dim)] mt-0.5">
                  {g.subtitle}
                </div>
              </div>
              <div className="text-[var(--text-dim)] text-xs ml-3 shrink-0">
                {open === g.id ? "Hide" : "Show"}
              </div>
            </button>
            {open === g.id && (
              <div className="px-4 py-3 border-t border-[var(--border)] bg-[var(--bg)]">
                {g.body}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function CopyBlock({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className=" border border-[var(--border)] bg-[var(--panel)]">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-[var(--border)]">
        <div className="text-xs text-[var(--text-dim)]">{label}</div>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } catch {
              /* clipboard blocked */
            }
          }}
          className="text-xs px-2 py-1 bg-[var(--panel-2)] hover:bg-[var(--border)]"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="px-3 py-2 text-xs text-[var(--text)] whitespace-pre-wrap break-words font-mono">
        {text}
      </pre>
    </div>
  );
}
