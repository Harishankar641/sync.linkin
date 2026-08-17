"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

/**
 * Inline password-change UI for /settings. Uses the browser Supabase
 * client to call `auth.updateUser({ password })` so the existing
 * session is leveraged and no extra server route is needed.
 *
 * Supabase auto-sends a confirmation email to the account holder when
 * the password changes (configurable in the project's auth settings) —
 * we surface a hint to that effect.
 */
export function ChangePasswordCard() {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>("");
  const [ok, setOk] = useState(false);

  async function save() {
    setErr("");
    if (pw.length < 8) {
      setErr("Password must be at least 8 characters.");
      return;
    }
    if (pw !== pw2) {
      setErr("Passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) throw new Error(error.message);
      setOk(true);
      setPw("");
      setPw2("");
    } catch (e: any) {
      setErr(e?.message || "Couldn't update password.");
    } finally {
      setBusy(false);
    }
  }

  if (ok) {
    return (
      <div
        style={{
          padding: 14,
          borderRadius: 10,
          background: "rgba(34, 197, 94, 0.08)",
          border: "1px solid rgba(34, 197, 94, 0.30)",
          fontSize: 13.5,
          color: "#15803d",
          lineHeight: 1.5
        }}
      >
        ✓ Password updated. We sent a confirmation email — if it
        wasn&apos;t you, click the &ldquo;not me&rdquo; link in that
        message to lock the account.
        <div style={{ marginTop: 10 }}>
          <button
            type="button"
            onClick={() => setOk(false)}
            className="retro-btn text-xs"
          >
            change again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <input
        type="password"
        value={pw}
        onChange={(e) => setPw(e.target.value)}
        placeholder="new password (min 8 chars)"
        className="retro-input"
        style={{ fontSize: 14, padding: "10px 12px", width: "100%" }}
        autoComplete="new-password"
      />
      <input
        type="password"
        value={pw2}
        onChange={(e) => setPw2(e.target.value)}
        placeholder="confirm new password"
        className="retro-input"
        style={{
          fontSize: 14,
          padding: "10px 12px",
          width: "100%",
          marginTop: 8
        }}
        autoComplete="new-password"
      />
      {err && (
        <p
          style={{
            fontSize: 12,
            color: "#ef4444",
            marginTop: 8
          }}
        >
          {err}
        </p>
      )}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginTop: 10
        }}
      >
        <button
          type="button"
          onClick={save}
          disabled={busy || !pw || !pw2}
          className="retro-btn retro-btn-primary text-xs"
          style={{ padding: "8px 14px", fontWeight: 700 }}
        >
          {busy ? "updating…" : "update password"}
        </button>
        <span style={{ fontSize: 11, color: "var(--text-dim)" }}>
          You&apos;ll be signed out of other devices.
        </span>
      </div>
    </div>
  );
}
