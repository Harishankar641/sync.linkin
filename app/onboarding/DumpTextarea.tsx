"use client";

import { useState } from "react";
import { TrustNote } from "../TrustNote";

// There's no cap — the full blob is fed to the twin. The thresholds below are
// just encouragement: a single AI dump gets you to "good", a couple of chat
// exports get you to "rich", and more only ever helps.
function richness(text: string): { label: string; tone: string; pct: number } {
  const len = text.trim().length;
  if (len === 0)
    return { label: "Empty — your twin has no voice yet", tone: "text-[var(--text-dim)]", pct: 0 };
  if (len < 1500)
    return { label: "Sparse — add 1 more source", tone: "text-amber-400", pct: 12 };
  if (len < 4500)
    return { label: "Fair — twin will sound approximately right", tone: "text-amber-300", pct: 30 };
  if (len < 9000)
    return { label: "Good — twin will pick up your voice", tone: "text-emerald-400", pct: 55 };
  if (len < 20000)
    return { label: "Rich — twin has strong context to draw on", tone: "text-emerald-400", pct: 80 };
  return {
    label: "Comprehensive — the more you add, the sharper the twin",
    tone: "text-emerald-400",
    pct: 100
  };
}

export function DumpTextarea({ defaultValue }: { defaultValue: string }) {
  const [value, setValue] = useState(defaultValue);
  const r = richness(value);
  const chars = value.trim().length;

  return (
    <>
      <textarea
        name="ai_export_blob"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={14}
        placeholder={"--- ChatGPT context dump ---\n[paste here]\n\n--- WhatsApp chat with [name] ---\n[paste here]\n\n--- 5 sent emails ---\n[paste here]"}
        className="mt-2 w-full px-3 py-2  bg-[var(--panel)] border border-[var(--border)] text-sm placeholder-[#5a5446] font-mono"
      />
      <TrustNote style={{ textAlign: "left", marginTop: 6 }} />
      <div className="mt-2 flex items-center gap-3">
        <div className="flex-1 h-1.5 bg-[var(--panel)] rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 transition-all"
            style={{ width: `${r.pct}%` }}
          />
        </div>
        <div className={`text-xs ${r.tone} whitespace-nowrap`}>
          {chars.toLocaleString()} chars · {r.label}
        </div>
      </div>
    </>
  );
}
