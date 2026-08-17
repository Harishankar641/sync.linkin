"use client";

import { useState } from "react";

/**
 * Inline account-deletion UI for /settings. Two-step confirm —
 * the user must type their email address verbatim before the destroy
 * button activates. Calls POST /api/delete-account which handles the
 * cascade and then signs the user out.
 */
export function DeleteAccountCard({
  email,
  displayName
}: {
  email: string;
  displayName: string;
}) {
  const [confirmInput, setConfirmInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>("");
  const matched = confirmInput.trim().toLowerCase() === email.toLowerCase();

  async function destroy() {
    if (!matched) return;
    if (
      !window.confirm(
        `Last chance, ${
          displayName || "friend"
        } — this permanently deletes your twin, scraped data, and any conversations you started. Continue?`
      )
    ) {
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/delete-account", { method: "POST" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(j.detail || j.error || `HTTP ${res.status}`);
      }
      // Sign out + redirect to a goodbye-ish page.
      window.location.href = "/?deleted=1";
    } catch (e: any) {
      setErr(e?.message || "Deletion failed. Try again or contact support.");
      setBusy(false);
    }
  }

  return (
    <div>
      <p
        style={{
          fontSize: 13,
          color: "var(--text-dim)",
          marginBottom: 8,
          lineHeight: 1.5
        }}
      >
        Type your email address{" "}
        <code
          style={{
            fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
            color: "var(--text)",
            fontWeight: 700
          }}
        >
          {email}
        </code>{" "}
        below to confirm.
      </p>
      <input
        type="email"
        value={confirmInput}
        onChange={(e) => setConfirmInput(e.target.value)}
        placeholder="your email address"
        className="retro-input"
        style={{ fontSize: 14, padding: "10px 12px", width: "100%" }}
        autoComplete="off"
      />
      {err && (
        <p style={{ fontSize: 12, color: "#ef4444", marginTop: 8 }}>
          {err}
        </p>
      )}
      <div style={{ marginTop: 12 }}>
        <button
          type="button"
          onClick={destroy}
          disabled={!matched || busy}
          className="retro-btn text-xs"
          style={{
            padding: "10px 16px",
            fontWeight: 700,
            background: matched ? "#ef4444" : undefined,
            color: matched ? "#fff" : undefined,
            borderColor: matched ? "#dc2626" : undefined,
            opacity: matched ? 1 : 0.5,
            cursor: matched ? "pointer" : "not-allowed"
          }}
        >
          {busy ? "deleting…" : "permanently delete my account"}
        </button>
      </div>
    </div>
  );
}
