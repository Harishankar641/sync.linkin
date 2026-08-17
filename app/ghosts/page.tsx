import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "../AppShell";
import { GhostsConsole } from "./GhostsConsole";

/**
 * TALK WITH GHOSTS — Jack's reframing of the invite ask:
 *
 *   Old: "Send an invite to this person, then they see a demo."
 *   New: "Watch your conversation with this person play out RIGHT NOW
 *         — then send the conversation to them so they can claim
 *         their twin and respond for real."
 *
 * The user pastes a LinkedIn / X / Instagram / Facebook URL (or
 * their own context blob). We scrape into a "ghost twin" modeled
 * from public data, spin up a live conversation between the user's
 * twin and the ghost, and ship a big "send this to them" CTA at
 * the end.
 *
 * Backend is fully reused: this is the same pipeline /invite uses
 * (bulk-create-invites + demo-conversation streaming + /[slug]
 * landing page), just inverted so the INVITER experiences the demo
 * first, before deciding to send.
 */
export const dynamic = "force-dynamic";

export default async function GhostsPage() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/ghosts");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, email")
    .eq("id", user.id)
    .maybeSingle();
  const firstName =
    ((profile as any)?.display_name || "").split(/\s+/)[0] ||
    user.email?.split("@")[0] ||
    "you";

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "https://syncedin.org";

  return (
    <AppShell>
      <header style={{ marginBottom: 20 }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.16em",
            textTransform: "uppercase"
          }}
        >
          <span
            style={{
              background:
                "linear-gradient(90deg, #6b2dc9 0%, #d83bff 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text"
            }}
          >
            new · experimental
          </span>
          <span
            aria-hidden="true"
            style={{
              fontSize: 16,
              filter:
                "drop-shadow(0 0 6px rgba(216, 59, 255, 0.55))"
            }}
          >
            ◇
          </span>
        </div>
        <h1
          className="retro-h1"
          style={{
            fontSize: 32,
            letterSpacing: "-0.01em",
            margin: "8px 0 0"
          }}
        >
          Talk with ghosts.
        </h1>
        <p
          style={{
            marginTop: 10,
            fontSize: 14,
            color: "var(--text-dim)",
            maxWidth: 680,
            lineHeight: 1.55
          }}
        >
          Paste a LinkedIn, X, Instagram, Facebook profile — or any
          website. We&apos;ll model that person from their public footprint
          and spin up a live conversation between your twin and theirs.
          Once you like what you see, send it to them so they can claim
          their real twin and respond for real.
        </p>
      </header>

      <GhostsConsole firstName={firstName} appUrl={appUrl} />
    </AppShell>
  );
}
