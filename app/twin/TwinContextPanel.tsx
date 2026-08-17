"use client";

import { useMemo, useState } from "react";
import { ContextSources, type Snippet } from "../onboarding/ContextSources";

type Props = { initialBlob: string };

function parseBlob(blob: string): { snippets: Snippet[]; rest: string } {
  if (!blob.trim()) return { snippets: [], rest: "" };
  const sections = blob.split(/\n\n+(?=#\s+)/g);
  const snippets: Snippet[] = [];
  const rest: string[] = [];
  for (const raw of sections) {
    const m = raw.match(/^#\s+(.+?)\s+\((.+?)\)\s*\n([\s\S]+)$/);
    if (m) {
      snippets.push({ id: Math.random().toString(36).slice(2, 10), label: m[1].trim(), source: m[2].trim(), text: m[3].trim() });
    } else if (raw.trim()) rest.push(raw.trim());
  }
  return { snippets, rest: rest.join("\n\n") };
}

function serialize(snippets: Snippet[], rest: string) {
  const blocks = snippets
    .filter((s) => s.text.trim())
    .map((s) => `# ${s.label} (${s.source})\n${s.text.trim()}`);
  if (rest.trim()) blocks.push(rest.trim());
  return blocks.join("\n\n");
}

export function TwinContextPanel({ initialBlob }: Props) {
  const initial = useMemo(() => parseBlob(initialBlob), [initialBlob]);
  const [snippets, setSnippets] = useState<Snippet[]>(initial.snippets);
  const [rest] = useState(initial.rest);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(true);
  const [error, setError] = useState("");

  async function change(next: Snippet[]) {
    setSnippets(next);
    setSaved(false);
    setError("");
    setSaving(true);
    try {
      const r = await fetch("/api/twin/context-source/save", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ai_export_blob: serialize(next, rest) })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Could not save context.");
      setSaved(true);
    } catch (e: any) {
      setError(e?.message || "Could not save context.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section id="context-sources" className="mt-6 rounded-2xl border border-white/10 bg-white/[0.025] p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-white/45">Twin signal</div>
          <h2 className="mt-1 text-xl font-semibold text-white">Context sources</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-white/55">
            Give your Twin more real-world signal. Add LinkedIn, X, Instagram, GitHub, a portfolio, or any URL. Each saved source contributes to your Sync score.
          </p>
        </div>
        <div className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/55">
          {snippets.length} / 6 sources
        </div>
      </div>
      <div className="mt-5">
        <ContextSources snippets={snippets} onChange={change} />
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 text-xs">
        <span className={error ? "text-red-300" : "text-white/40"}>{error || (saving ? "Saving Twin context…" : saved ? "Saved to your Twin" : "Unsaved")}</span>
        <span className="text-white/35">You control every source before it becomes Twin context.</span>
      </div>
    </section>
  );
}
