/**
 * deriveIceberg — the "Tip of their self iceberg" framework (Jack):
 * About me / Wants-needs-goals / Offers, derived from a person's twin.
 * Shared by the dashboard people cards AND the community/conference member
 * cards so both surfaces show the same structured, relevant info instead
 * of a junk first-line headline.
 *
 * Field semantics (from the onboarding wizard):
 *   - goals            = what they're working on / pursuing  → about + wants
 *   - deal_preferences = the "what can you OFFER" field      → offers
 * Heuristic + fast (no LLM). Each field is null when there's no signal so
 * the card can hide empty rows.
 */
export function deriveIceberg(src: {
  portfolio_about?: string | null;
  goals?: string | null;
  deal_preferences?: string | null;
  ai_export_blob?: string | null;
}): { about: string | null; wants: string | null; offers: string | null } {
  const clean = (s: string | null | undefined, max = 320): string | null => {
    const t = (s ?? "").toString().replace(/\s+/g, " ").trim();
    if (t.length < 3) return null;
    return t.length > max ? `${t.slice(0, max).trim()}…` : t;
  };
  const section = (blob: string | null | undefined, kw: RegExp): string | null => {
    if (!blob) return null;
    const lines = blob.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      if (kw.test(lines[i])) {
        const body: string[] = [];
        for (let j = i + 1; j < lines.length && body.length < 4; j++) {
          const l = lines[j].trim();
          if (!l) {
            if (body.length) break;
            continue;
          }
          if (/^#{1,6}\s|^\d+\.\s|^[A-Z][A-Z \-/]{6,}$/.test(l)) break;
          body.push(l.replace(/^[-*•]\s*/, ""));
        }
        const joined = body.join(" ").trim();
        if (joined.length > 8) return joined;
      }
    }
    return null;
  };
  const about =
    clean(src.portfolio_about) ||
    clean(section(src.ai_export_blob, /working on|about me|who i am/i), 220) ||
    clean(src.goals, 220);
  const wants =
    clean(src.goals, 220) ||
    clean(
      section(src.ai_export_blob, /intros|looking for|want to meet|needle|need/i),
      220
    );
  const offers =
    clean(src.deal_preferences, 240) ||
    clean(section(src.ai_export_blob, /can give|i can offer|what i have|offer/i), 220);
  return { about, wants, offers };
}
