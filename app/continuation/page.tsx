import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "../AppShell";
import { ContinuationConsole } from "./ContinuationConsole";

/**
 * Chat-continuation invite (#166). Upload an iMsg/WhatsApp/Telegram/SMS
 * export, model the counterpart, generate "where it goes next."
 *
 * Use case Jack described: you've been messaging someone for weeks. Drop
 * the export here, watch the next 8–10 messages play out, then share
 * the result with them — "look where this is heading, want to make it
 * real?"
 */
export const dynamic = "force-dynamic";

export default async function ContinuationPage() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/continuation");

  return (
    <AppShell>
      <section className="mt-2">
        <div className="retro-label">where it goes next</div>
        <h1 className="retro-h1 text-2xl sm:text-3xl mt-2 leading-tight">
          Continue the conversation you&apos;ve been having.
        </h1>
        <p
          className="mt-2 text-sm sm:text-base leading-relaxed"
          style={{ color: "var(--text-dim)" }}
        >
          Drop in your iMessage, WhatsApp, Telegram, or SMS export. We&apos;ll
          model the person on the other end — their cadence, what they care
          about, what they dodge — and play out the next 8–10 messages. Share
          the result with them as a &quot;look where we&apos;re headed, want
          to make this real?&quot; invite.
        </p>

        <div className="mt-6">
          <ContinuationConsole />
        </div>
      </section>
    </AppShell>
  );
}
