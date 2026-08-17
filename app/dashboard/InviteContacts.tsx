"use client";

import { useState } from "react";

/**
 * Invite people to SyncedIn.
 *  - Contact Picker API (Chrome on Android etc.) to pull contacts from the
 *    user's phone — feature-detected, hidden where unsupported.
 *  - Manual email entry as the universal fallback.
 *  - Invites go out via the user's OWN email client (mailto:) so this works
 *    with zero email infrastructure and no rate limits.
 *  - Copy-invite-link for sharing anywhere (text, Slack, etc.).
 */
export function InviteContacts({ appUrl }: { appUrl: string }) {
  const [emails, setEmails] = useState<string[]>([]);
  const [manual, setManual] = useState("");
  const [copied, setCopied] = useState(false);
  const [copiedMsg, setCopiedMsg] = useState(false);
  const [pickerError, setPickerError] = useState<string | null>(null);

  const contactPickerSupported =
    typeof navigator !== "undefined" &&
    "contacts" in navigator &&
    "ContactsManager" in window;

  async function pickFromContacts() {
    setPickerError(null);
    try {
      // @ts-expect-error — Contact Picker API isn't in stable TS lib yet
      const picked = await navigator.contacts.select(["name", "email"], {
        multiple: true
      });
      const got: string[] = [];
      for (const c of picked) {
        if (c.email && c.email.length) got.push(c.email[0]);
      }
      if (got.length === 0) {
        setPickerError("None of those contacts had an email address.");
        return;
      }
      setEmails((prev) => Array.from(new Set([...prev, ...got])));
    } catch (e: any) {
      setPickerError(
        e?.message ||
          "Couldn't open contacts. Add emails manually below instead."
      );
    }
  }

  function addManual() {
    const parsed = manual
      .split(/[\s,;]+/)
      .map((s) => s.trim())
      .filter((s) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s));
    if (parsed.length === 0) return;
    setEmails((prev) => Array.from(new Set([...prev, ...parsed])));
    setManual("");
  }

  function removeEmail(e: string) {
    setEmails((prev) => prev.filter((x) => x !== e));
  }

  const inviteSubject = "Join me on SyncedIn";
  const inviteBody = `I'm on SyncedIn — it's an agent-to-agent protocol where your digital twin negotiates the highest win-wins with other people's twins. Build yours and let's connect:\n\n${appUrl}`;

  function mailtoAll() {
    if (emails.length === 0) return "#";
    return `mailto:${encodeURIComponent(emails.join(","))}?subject=${encodeURIComponent(
      inviteSubject
    )}&body=${encodeURIComponent(inviteBody)}`;
  }

  // Gmail web compose — works in-browser with no desktop mail client.
  function gmailComposeUrl() {
    return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(
      emails.join(",")
    )}&su=${encodeURIComponent(inviteSubject)}&body=${encodeURIComponent(
      inviteBody
    )}`;
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(appUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  }

  // The reliable path: copy a ready-to-send message. Works everywhere —
  // paste it into any email, text, Slack, DM.
  async function copyInviteMessage() {
    const recipients = emails.length ? `To: ${emails.join(", ")}\n\n` : "";
    try {
      await navigator.clipboard.writeText(
        `${recipients}${inviteSubject}\n\n${inviteBody}`
      );
      setCopiedMsg(true);
      setTimeout(() => setCopiedMsg(false), 1800);
    } catch {
      /* clipboard blocked */
    }
  }

  return (
    <div className="retro-panel p-4">
      <div className="retro-label">invite people</div>
      <p className="mt-2 retro-dim text-xs leading-relaxed">
        SyncedIn is only useful with people in it. Pull contacts from your
        phone or paste emails — invites open in your own email app, so they
        send instantly with no limits.
      </p>

      {/* Copy invite link */}
      <div className="mt-3 flex items-center gap-2">
        <input
          readOnly
          value={appUrl}
          className="retro-input text-xs flex-1"
          onFocus={(e) => e.currentTarget.select()}
        />
        <button onClick={copyLink} className="retro-btn text-xs shrink-0">
          {copied ? "✓ copied" : "copy link"}
        </button>
      </div>

      {/* Mass-reach toolkit — every channel that exists for moving lots
          of invites at once. */}
      <div className="mt-4">
        <div
          className="retro-label"
          style={{ color: "var(--amber-bright)" }}
        >
          mass reach toolkit
        </div>
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {contactPickerSupported && (
            <button
              onClick={pickFromContacts}
              className="retro-btn text-sm"
            >
              ▯ Phone contacts
            </button>
          )}
          <a
            href="https://contacts.google.com/?hl=en"
            target="_blank"
            rel="noopener noreferrer"
            className="retro-btn text-sm text-center"
          >
            ◉ Open Google Contacts
          </a>
          <label className="retro-btn text-sm text-center cursor-pointer">
            □ Import .csv
            <input
              type="file"
              accept=".csv,text/csv"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const reader = new FileReader();
                reader.onload = () => {
                  const text = String(reader.result || "");
                  // Pull anything that looks like an email
                  const found = Array.from(
                    text.matchAll(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g)
                  ).map((m) => m[0].toLowerCase());
                  setEmails((prev) =>
                    Array.from(new Set([...prev, ...found]))
                  );
                };
                reader.readAsText(f);
                e.target.value = "";
              }}
            />
          </label>
          <a
            href={`https://www.linkedin.com/mynetwork/invite-connect/connections/`}
            target="_blank"
            rel="noopener noreferrer"
            className="retro-btn text-sm text-center"
          >
            ▣ LinkedIn connections
          </a>
        </div>
        {pickerError && (
          <p className="mt-2 text-xs retro-red">{pickerError}</p>
        )}
        <p
          className="mt-2 text-xs"
          style={{ color: "var(--text-dim)" }}
        >
          Drop a CSV from Gmail / Google Contacts / your CRM. We extract every
          email automatically. The other buttons open the source so you can
          copy contacts back into the field below.
        </p>
      </div>

      {/* Manual entry */}
      <div className="mt-3 flex items-center gap-2">
        <input
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addManual();
            }
          }}
          placeholder="paste emails, comma or space separated"
          className="retro-input text-xs flex-1"
        />
        <button onClick={addManual} className="retro-btn text-xs shrink-0">
          add
        </button>
      </div>

      {/* Selected emails */}
      {emails.length > 0 && (
        <div className="mt-3">
          <div className="flex flex-wrap gap-1.5">
            {emails.map((e) => (
              <span
                key={e}
                className="retro-panel text-[11px] px-2 py-1 flex items-center gap-1.5"
              >
                {e}
                <button
                  onClick={() => removeEmail(e)}
                  className="retro-dim hover:retro-red"
                  aria-label={`Remove ${e}`}
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
          {/* Reliable path first — copy works with zero mail setup. */}
          <button
            onClick={copyInviteMessage}
            className="retro-btn retro-btn-primary w-full mt-3 text-sm"
          >
            {copiedMsg
              ? "✓ copied — paste into any email, text, or DM"
              : `Copy invite for ${emails.length} ${
                  emails.length > 1 ? "people" : "person"
                }`}
          </button>
          <div className="flex gap-2 mt-2">
            <a
              href={gmailComposeUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="retro-btn flex-1 text-xs"
            >
              Open in Gmail
            </a>
            <a href={mailtoAll()} className="retro-btn flex-1 text-xs">
              Open mail app
            </a>
          </div>
          <p className="retro-dim text-[10px] mt-1.5">
            &quot;Copy invite&quot; always works. Gmail / mail app open a
            pre-filled draft if you have them.
          </p>
        </div>
      )}
    </div>
  );
}
