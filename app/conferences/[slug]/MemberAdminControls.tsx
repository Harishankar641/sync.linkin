"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * MemberAdminControls — owner-only buttons on each member in the room
 * directory: make someone the host (transfer ownership) or remove (kick)
 * them. Jack: "a simple way for the admin to assign hosts to other
 * people … and a button where you can kick people out."
 */
export function MemberAdminControls({
  slug,
  userId,
  name
}: {
  slug: string;
  userId: string;
  name: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"transfer" | "remove" | null>(null);

  async function run(action: "transfer" | "remove") {
    if (busy) return;
    if (action === "remove" && !confirm(`Remove ${name} from this room?`)) return;
    if (action === "transfer" && !confirm(`Make ${name} the host? You'll stay a member.`))
      return;
    setBusy(action);
    try {
      await fetch(`/api/communities/${slug}/members`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, userId })
      });
      router.refresh();
    } catch {
      /* best-effort */
    } finally {
      setBusy(null);
    }
  }

  return (
    <div style={{ display: "flex", gap: 6 }}>
      <button
        type="button"
        onClick={() => run("transfer")}
        disabled={busy !== null}
        className="retro-btn text-xs"
        style={{ padding: "4px 8px", fontWeight: 700 }}
        title={`Make ${name} the host`}
      >
        {busy === "transfer" ? "…" : "★ host"}
      </button>
      <button
        type="button"
        onClick={() => run("remove")}
        disabled={busy !== null}
        className="retro-btn text-xs"
        style={{ padding: "4px 8px", color: "#ef4444", borderColor: "rgba(239,68,68,0.35)" }}
        title={`Remove ${name}`}
      >
        {busy === "remove" ? "…" : "✕"}
      </button>
    </div>
  );
}
