import { createServiceClient } from "@/lib/supabase/server";
import { Avatar } from "../../Avatar";
import Link from "next/link";

/**
 * MySpace-in-real-time strip (#257). Drops onto the public /u/[handle]
 * page just under the hero. Designed as a viral hook — the page feels
 * ALIVE every time you load it.
 *
 * Renders four bands:
 *  1. Pulse status: "online now" / "active 12m ago" (live dot if <5m)
 *  2. Currently — the user's stated goal, oversized
 *  3. Top 8 — most recent 8 conversation counterparts (MySpace homage)
 *  4. Right now — last 3 conversation summaries (anonymized snippets)
 *
 * Server-rendered. Re-fetches on every load because the parent route
 * sets `revalidate = 0`. No new schema; reads from profiles +
 * conversations + twin_profiles.
 */
export async function RealtimeStrip({
  userId,
  selfName,
  goalsHighlight
}: {
  userId: string;
  selfName: string;
  goalsHighlight: string | null;
}) {
  const service = createServiceClient();

  // Last-active stamp drives the pulse band.
  const { data: prof } = await service
    .from("profiles")
    .select("last_active_at")
    .eq("id", userId)
    .maybeSingle();
  const lastActive = (prof as any)?.last_active_at
    ? new Date((prof as any).last_active_at as string)
    : null;
  const status = computeStatus(lastActive);

  // Most-recent 8 conversation counterparts → "Top 8" band.
  const { data: convs } = await service
    .from("conversations")
    .select("participant_a, participant_b, summary, created_at")
    .or(`participant_a.eq.${userId},participant_b.eq.${userId}`)
    .order("created_at", { ascending: false })
    .limit(20);
  const counterIds: string[] = [];
  const seen = new Set<string>();
  for (const c of (convs ?? []) as any[]) {
    const other =
      c.participant_a === userId ? c.participant_b : c.participant_a;
    if (other && !seen.has(other)) {
      seen.add(other);
      counterIds.push(other);
      if (counterIds.length >= 8) break;
    }
  }
  let counterProfiles: Array<{
    id: string;
    display_name: string | null;
    email: string | null;
    avatar_url: string | null;
    handle: string | null;
  }> = [];
  if (counterIds.length) {
    const { data } = await service
      .from("profiles")
      .select("id, display_name, email, avatar_url, handle")
      .in("id", counterIds);
    counterProfiles = (data ?? []) as any[];
    // Preserve original chronological order from counterIds.
    const order = new Map(counterIds.map((id, i) => [id, i]));
    counterProfiles.sort(
      (a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)
    );
  }

  // "Right now" feed: last 3 conversation summaries (just the outcome
  // text — no counterpart names, so we don't leak who's talking to whom).
  const rightNow = ((convs ?? []) as any[])
    .filter((c) => (c.summary ?? "").trim().length > 0)
    .slice(0, 3)
    .map((c) => ({
      summary: (c.summary as string).trim().slice(0, 200),
      created_at: c.created_at as string
    }));

  return (
    <section
      style={{
        borderRadius: 14,
        padding: 18,
        margin: "20px 0",
        background:
          "linear-gradient(135deg, rgba(107,45,201,0.10), rgba(35,88,255,0.10))",
        border: "1px solid var(--border)"
      }}
    >
      {/* Pulse status */}
      <div className="flex items-center gap-2 text-xs">
        <PulseDot live={status.live} />
        <span
          style={{
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: status.live ? "#1aaf52" : "var(--text-dim)"
          }}
        >
          {status.label}
        </span>
      </div>

      {/* Currently */}
      {goalsHighlight && (
        <div className="mt-3">
          <div
            className="retro-dim text-[11px]"
            style={{
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              fontWeight: 700
            }}
          >
            currently
          </div>
          <div
            className="mt-1"
            style={{
              fontSize: 18,
              fontWeight: 700,
              lineHeight: 1.35,
              wordBreak: "break-word"
            }}
          >
            {goalsHighlight.slice(0, 280)}
          </div>
        </div>
      )}

      {/* Top 8 */}
      {counterProfiles.length > 0 && (
        <div className="mt-4">
          <div
            className="retro-dim text-[11px]"
            style={{
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              fontWeight: 700
            }}
          >
            top 8 connections
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {counterProfiles.map((c) => {
              const name =
                c.display_name ||
                (c.email ?? "").split("@")[0] ||
                "someone";
              const href = c.handle ? `/u/${c.handle}` : null;
              const node = (
                <div
                  className="flex items-center gap-1"
                  style={{
                    background: "var(--panel-solid)",
                    padding: "4px 8px 4px 4px",
                    borderRadius: 999,
                    border: "1px solid var(--border)"
                  }}
                >
                  <Avatar
                    id={c.id}
                    name={name}
                    avatarUrl={c.avatar_url}
                    size={24}
                  />
                  <span className="text-xs">{name.split(" ")[0]}</span>
                </div>
              );
              return href ? (
                <Link
                  key={c.id}
                  href={href}
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  {node}
                </Link>
              ) : (
                <div key={c.id}>{node}</div>
              );
            })}
          </div>
        </div>
      )}

      {/* Right-now feed */}
      {rightNow.length > 0 && (
        <div className="mt-4">
          <div
            className="retro-dim text-[11px]"
            style={{
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              fontWeight: 700
            }}
          >
            right now
          </div>
          <ul style={{ marginTop: 6, paddingLeft: 0, listStyle: "none" }}>
            {rightNow.map((r, i) => (
              <li
                key={i}
                style={{
                  padding: "8px 10px",
                  background: "var(--panel-solid)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  marginBottom: 6,
                  fontSize: 13,
                  lineHeight: 1.45
                }}
              >
                <span className="retro-dim text-[10px]">
                  {timeAgo(r.created_at)} ·{" "}
                </span>
                {r.summary}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div
        className="retro-dim text-[10px] mt-3"
        style={{ textAlign: "right" }}
      >
        live · {selfName}&apos;s SyncedIn page · reloads every visit
      </div>
    </section>
  );
}

function PulseDot({ live }: { live: boolean }) {
  if (!live) {
    return (
      <span
        aria-hidden
        style={{
          display: "inline-block",
          width: 8,
          height: 8,
          borderRadius: 999,
          background: "var(--text-dim)"
        }}
      />
    );
  }
  // CSS-only pulse using @keyframes via inline style. Two stacked dots:
  // the back one scales+fades, the front one stays solid.
  return (
    <span
      aria-hidden
      style={{
        position: "relative",
        width: 10,
        height: 10,
        display: "inline-block"
      }}
    >
      <span
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 999,
          background: "#1aaf52",
          opacity: 0.5,
          animation: "syncedin-pulse 1.6s ease-out infinite"
        }}
      />
      <span
        style={{
          position: "absolute",
          inset: 2,
          borderRadius: 999,
          background: "#1aaf52"
        }}
      />
      <style>{`
        @keyframes syncedin-pulse {
          0% { transform: scale(0.8); opacity: 0.55; }
          70% { transform: scale(2.2); opacity: 0; }
          100% { transform: scale(2.2); opacity: 0; }
        }
      `}</style>
    </span>
  );
}

function computeStatus(
  lastActive: Date | null
): { live: boolean; label: string } {
  if (!lastActive) return { live: false, label: "—" };
  const ms = Date.now() - lastActive.getTime();
  if (ms < 5 * 60 * 1000) return { live: true, label: "online now" };
  if (ms < 60 * 60 * 1000)
    return { live: false, label: `active ${Math.round(ms / 60000)}m ago` };
  if (ms < 24 * 60 * 60 * 1000)
    return {
      live: false,
      label: `active ${Math.round(ms / 3_600_000)}h ago`
    };
  return {
    live: false,
    label: `active ${Math.round(ms / 86_400_000)}d ago`
  };
}

function timeAgo(iso: string): string {
  try {
    const ms = Date.now() - new Date(iso).getTime();
    if (ms < 60_000) return "just now";
    if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m ago`;
    if (ms < 86_400_000) return `${Math.round(ms / 3_600_000)}h ago`;
    return `${Math.round(ms / 86_400_000)}d ago`;
  } catch {
    return "";
  }
}
