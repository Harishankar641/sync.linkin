import { createServiceClient } from "@/lib/supabase/server";

/**
 * Multi-source AI export blender (#169).
 *
 * Onboarding lets users paste a deep self-description from EACH of
 * Claude, ChatGPT, Gemini, Perplexity, Grok — each row stored in
 * `ai_exports` keyed on (user_id, source). Each tool knows them in
 * different ways; concatenating all sources gives the twin a richer
 * dossier than any single one.
 *
 * The legacy `twin_profiles.ai_export_blob` column is still respected
 * (kept as the FIRST section since onboarding wrote into it directly
 * before the multi-source UI existed), but the per-source rows are
 * appended below with provenance labels so the model can see which
 * tool described which trait.
 *
 * Returns a single string ready to drop into the twin system prompt
 * (or null if nothing to add).
 */
const SOURCE_LABEL: Record<string, string> = {
  claude: "Claude",
  chatgpt: "ChatGPT",
  gemini: "Gemini",
  perplexity: "Perplexity",
  grok: "Grok"
};

export async function loadBlendedAiExports(
  userId: string,
  legacyBlob: string | null | undefined
): Promise<string | null> {
  const service = createServiceClient();
  let rows: Array<{ source: string; content: string }> = [];
  try {
    const { data } = await service
      .from("ai_exports")
      .select("source, content")
      .eq("user_id", userId);
    rows = (data ?? []) as any[];
  } catch {
    /* table missing in fork — just skip multi-source */
  }

  const sections: string[] = [];
  const legacy = (legacyBlob ?? "").trim();
  if (legacy.length > 0) {
    sections.push(`## Self-description (primary)\n${legacy}`);
  }
  // Stable ordering: alphabetical by source label so the prompt is
  // deterministic across runs.
  rows
    .filter((r) => (r.content ?? "").trim().length > 0)
    .sort((a, b) =>
      (SOURCE_LABEL[a.source] || a.source).localeCompare(
        SOURCE_LABEL[b.source] || b.source
      )
    )
    .forEach((r) => {
      const label = SOURCE_LABEL[r.source] || r.source;
      sections.push(`## As described by ${label}\n${r.content.trim()}`);
    });

  if (sections.length === 0) return null;
  return sections.join("\n\n");
}
