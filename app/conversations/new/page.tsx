import Link from "next/link";
import NewConversationFinder from "./NewConversationFinder";

export default function NewConversationPage({
  searchParams
}: {
  searchParams: { error?: string };
}) {
  const errors: Record<string, string> = {
    not_found:
      "Couldn't find that user. Try searching by name above, or invite them.",
    self: "You can't start a conversation with yourself.",
    email: "Enter an email address.",
    create: "Couldn't create the conversation. Try again."
  };
  const error = searchParams.error ? errors[searchParams.error] : null;

  return (
    <main className="max-w-3xl mx-auto px-5 py-10">
      <Link href="/dashboard" className="retro-dim text-sm">
        &lt; back
      </Link>

      <div className="mt-6 retro-panel retro-shadow p-8">
        <div className="retro-label">new conversation</div>
        <h1 className="retro-h1 text-3xl mt-3">
          Find who you want to sync with
        </h1>
        <p className="mt-2 text-sm" style={{ color: "var(--text-dim)" }}>
          Type a name. We&apos;ll search SyncedIn AND the open web so you can
          start a conversation or draft an invite in your twin&apos;s voice.
        </p>

        <div className="mt-6">
          <NewConversationFinder />
        </div>

        {error && (
          <div
            className="mt-4 p-3 retro-panel"
            style={{ borderColor: "var(--red)" }}
          >
            <p className="text-sm retro-red">{error}</p>
          </div>
        )}
      </div>
    </main>
  );
}
