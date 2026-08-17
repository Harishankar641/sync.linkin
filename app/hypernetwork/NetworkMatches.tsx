import Link from "next/link";
import { computePairScore } from "@/lib/pair-score";
import { createServiceClient } from "@/lib/supabase/server";

export type NetworkMatch = {
  id: string;
  name: string;
  email: string | null;
  avatarUrl: string | null;
  goals: string;
  headline: string;
  score: number;
  reason: string;
  lastActiveAt: string | null;
};

function headlineFromBlob(blob: string): string {
  const lines = (blob || "")
    .split(/[\r\n]+/)
    .map((x) => x.trim())
    .filter(Boolean);
  for (const line of lines) {
    if (line.length < 28 || line.length > 180) continue;
    if (line.startsWith("#")) continue;
    if (/^https?:\/\//i.test(line)) continue;
    if (/^[\w\s]+:\s*https?:\/\//i.test(line)) continue;
    if (line.split(/\s+/).length < 4) continue;
    return line;
  }
  return "Professional Twin";
}

function compactGoal(goal: string): string {
  const clean = (goal || "").replace(/\s+/g, " ").trim();
  if (!clean) return "Building a professional network.";
  return clean.length > 150 ? `${clean.slice(0, 147)}…` : clean;
}

function matchReason(me: any, them: any): string {
  const meText = `${me.goals || ""} ${me.deal_preferences || ""} ${me.ai_export_blob || ""}`.toLowerCase();
  const themText = `${them.goals || ""} ${them.deal_preferences || ""} ${them.ai_export_blob || ""}`.toLowerCase();
  const pairs: Array<[string, string, string]> = [
    ["raising", "invest", "Funding and investment intent align."],
    ["co-founder", "technical", "Co-founder and technical goals align."],
    ["technical", "co-founder", "Technical skills fit a co-founder need."],
    ["python", "data", "Python and data work overlap."],
    ["machine learning", "ai", "Machine learning and AI interests overlap."],
    ["analytics", "data", "Analytics and data goals overlap."],
    ["hiring", "engineer", "Hiring and engineering needs align."],
    ["sales", "partnership", "Sales and partnership goals complement each other."]
  ];
  for (const [a, b, reason] of pairs) {
    if ((meText.includes(a) && themText.includes(b)) || (meText.includes(b) && themText.includes(a))) return reason;
  }
  return "Shared professional context suggests a useful conversation.";
}

export async function loadNetworkMatches(userId: string, limit = 8): Promise<NetworkMatch[]> {
  const service = createServiceClient();
  const [{ data: meTwin }, { data: existing }] = await Promise.all([
    service.from("twin_profiles").select("goals, deal_preferences, communication_style, deal_breakers, ai_export_blob").eq("user_id", userId).maybeSingle(),
    service.from("conversations").select("participant_a, participant_b").or(`participant_a.eq.${userId},participant_b.eq.${userId}`).limit(500)
  ]);
  if (!meTwin) return [];

  const connected = new Set<string>();
  for (const c of (existing ?? []) as any[]) {
    if (c.participant_a !== userId) connected.add(c.participant_a);
    if (c.participant_b !== userId) connected.add(c.participant_b);
  }

  const { data: profiles } = await service
    .from("profiles")
    .select("id, display_name, email, avatar_url, last_active_at, is_test_persona")
    .eq("is_test_persona", false)
    .neq("id", userId)
    .order("last_active_at", { ascending: false, nullsFirst: false })
    .limit(300);

  const ids = (profiles ?? []).map((p: any) => p.id).filter((id: string) => !connected.has(id));
  if (!ids.length) return [];

  const { data: twins } = await service
    .from("twin_profiles")
    .select("user_id, goals, deal_preferences, communication_style, deal_breakers, ai_export_blob")
    .in("user_id", ids);
  const twinById = new Map((twins ?? []).map((t: any) => [t.user_id, t]));

  return (profiles ?? [])
    .filter((p: any) => twinById.has(p.id))
    .map((p: any) => {
      const t = twinById.get(p.id) as any;
      const score = computePairScore(meTwin as any, t);
      return {
        id: p.id,
        name: p.display_name || (p.email ? p.email.split("@")[0] : "SyncedIn member"),
        email: p.email ?? null,
        avatarUrl: p.avatar_url ?? null,
        goals: compactGoal(t?.goals || ""),
        headline: headlineFromBlob(t?.ai_export_blob || ""),
        score,
        reason: matchReason(meTwin, t),
        lastActiveAt: p.last_active_at ?? null
      } satisfies NetworkMatch;
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export async function NetworkMatches({ userId }: { userId: string }) {
  const matches = await loadNetworkMatches(userId, 8);
  return (
    <section className="mt-8 retro-panel retro-shadow p-5 sm:p-7" id="real-network">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="retro-label">live twin network</div>
          <h2 className="retro-h1 text-3xl mt-2">People your Twin should meet.</h2>
          <p className="mt-2 text-sm" style={{ color: "var(--text-dim)", maxWidth: 720 }}>
            Ranked from real non-test profiles with Twin context. The score is a transparent pairing signal, not a promise of compatibility.
          </p>
        </div>
        <Link href="/conversations/new" className="retro-btn retro-btn-primary">Search the network →</Link>
      </div>

      {matches.length === 0 ? (
        <div className="mt-6 rounded-2xl border p-6" style={{ borderColor: "var(--border)", background: "var(--panel-2)" }}>
          <div className="font-semibold">No compatible real Twins found yet.</div>
          <p className="mt-1 text-sm" style={{ color: "var(--text-dim)" }}>
            Build more Twin context, invite people you know, or broaden your search. Test conversations remain available in Twin Lab.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/twin-lab" className="retro-btn">Test in Twin Lab</Link>
            <Link href="/onboarding#context-sources" className="retro-btn">Add Twin context</Link>
          </div>
        </div>
      ) : (
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {matches.map((m, i) => (
            <article key={m.id} className="rounded-2xl border p-4 sm:p-5" style={{ borderColor: "var(--border)", background: "var(--panel-2)" }}>
              <div className="flex items-start gap-3">
                <div style={{ width: 42, height: 42, borderRadius: 14, overflow: "hidden", background: "var(--panel-solid)", display: "grid", placeItems: "center", fontWeight: 800 }}>
                  {m.avatarUrl ? <img src={m.avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : m.name.slice(0, 1).toUpperCase()}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="font-semibold">{m.name}</div>
                      <div className="text-xs" style={{ color: "var(--text-dim)" }}>{m.headline}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div style={{ color: "var(--amber-bright)", fontWeight: 900, fontSize: 20 }}>{m.score}%</div>
                      <div className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-dim)" }}>match</div>
                    </div>
                  </div>
                </div>
              </div>
              <p className="mt-3 text-sm leading-6" style={{ color: "var(--text-dim)" }}>{m.goals}</p>
              <div className="mt-3 text-xs" style={{ color: "var(--text)" }}>{m.reason}</div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href={`/conversations/new?user=${encodeURIComponent(m.id)}`} className="retro-btn retro-btn-primary">Start Twin conversation</Link>
                <Link href={`/conversations/new?user=${encodeURIComponent(m.id)}`} className="retro-btn">View profile →</Link>
              </div>
              <div className="mt-3 text-[10px] uppercase tracking-wider" style={{ color: "var(--text-dim)" }}>#{i + 1} ranked by Twin fit</div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
