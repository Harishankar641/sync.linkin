"use client";

import { useState } from "react";

/**
 * Reusable "Report user" button. Renders as a small ghost link by
 * default; click opens a lightweight modal with category + free-text
 * reason. Posts to /api/report-account.
 *
 * Drop into any other-user surface (conversation header, portfolio
 * page, directory rows). Hidden if the viewing user is the same as
 * the reportedUserId — caller responsible for that gate.
 */
const CATEGORIES: Array<{ value: string; label: string }> = [
  { value: "spam", label: "Spam / scam" },
  { value: "harassment", label: "Harassment / abuse" },
  { value: "impersonation", label: "Impersonating someone" },
  { value: "fake-profile", label: "Fake or AI-only profile" },
  { value: "off-platform", label: "Trying to move me off-platform" },
  { value: "other", label: "Other" }
];

export function ReportAccountButton({
  reportedUserId,
  reportedName,
  variant = "ghost"
}: {
  reportedUserId: string;
  reportedName?: string;
  /** "ghost" = small dim text link (default). "chip" = bordered pill. */
  variant?: "ghost" | "chip";
}) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<string>("spam");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string>("");

  async function submit() {
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/report-account", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          reported_user_id: reportedUserId,
          category,
          reason
        })
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.detail || j.error || `HTTP ${res.status}`);
      setDone(true);
    } catch (e: any) {
      setErr(e?.message || "Couldn't send report. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const triggerStyle =
    variant === "chip"
      ? {
          fontSize: 11,
          padding: "4px 10px",
          borderRadius: 999,
          border: "1px solid var(--border)",
          background: "transparent",
          color: "var(--text-dim)",
          cursor: "pointer"
        }
      : {
          fontSize: 11,
          background: "transparent",
          border: 0,
          color: "var(--text-dim)",
          textDecoration: "underline",
          cursor: "pointer",
          padding: 0
        };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={`Report ${reportedName || "this account"}`}
        style={triggerStyle as React.CSSProperties}
      >
        ⚑ report
      </button>
      {open && (
        <div
          onClick={() => !busy && setOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="retro-panel"
            style={{
              maxWidth: 460,
              width: "100%",
              padding: 22,
              background: "var(--panel-solid)",
              borderRadius: 16
            }}
          >
            {done ? (
              <>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 800,
                    color: "#15803d"
                  }}
                >
                  ✓ Report sent.
                </div>
                <p
                  style={{
                    marginTop: 8,
                    fontSize: 13,
                    color: "var(--text-dim)",
                    lineHeight: 1.5
                  }}
                >
                  We&apos;ll review it within 24 hours. If we need more
                  info we&apos;ll email you.
                </p>
                <div style={{ marginTop: 14, textAlign: "right" }}>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      setDone(false);
                      setReason("");
                    }}
                    className="retro-btn"
                    style={{ padding: "8px 14px", fontSize: 13 }}
                  >
                    close
                  </button>
                </div>
              </>
            ) : (
              <>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 800,
                    marginBottom: 4
                  }}
                >
                  Report {reportedName || "this account"}
                </div>
                <p
                  style={{
                    fontSize: 12,
                    color: "var(--text-dim)",
                    marginBottom: 14,
                    lineHeight: 1.5
                  }}
                >
                  We take reports seriously. Tell us what&apos;s wrong —
                  Jack reads every one.
                </p>
                <label
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: "var(--text-dim)",
                    display: "block",
                    marginBottom: 6
                  }}
                >
                  What&apos;s the issue?
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="retro-input"
                  style={{
                    width: "100%",
                    fontSize: 14,
                    padding: "10px 12px",
                    marginBottom: 12
                  }}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <label
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: "var(--text-dim)",
                    display: "block",
                    marginBottom: 6
                  }}
                >
                  More detail (optional)
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value.slice(0, 2000))}
                  rows={4}
                  placeholder="What happened, when, and how it affected you."
                  className="retro-input"
                  style={{
                    width: "100%",
                    fontSize: 14,
                    padding: 10,
                    minHeight: 90
                  }}
                />
                {err && (
                  <div
                    style={{
                      fontSize: 12,
                      color: "#ef4444",
                      marginTop: 8
                    }}
                  >
                    {err}
                  </div>
                )}
                <div
                  style={{
                    marginTop: 14,
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: 8
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    disabled={busy}
                    className="retro-btn"
                    style={{ padding: "8px 14px", fontSize: 13 }}
                  >
                    cancel
                  </button>
                  <button
                    type="button"
                    onClick={submit}
                    disabled={busy}
                    className="retro-btn retro-btn-primary"
                    style={{
                      padding: "8px 14px",
                      fontSize: 13,
                      fontWeight: 700,
                      background: "#ef4444",
                      color: "#fff",
                      borderColor: "#dc2626"
                    }}
                  >
                    {busy ? "sending…" : "send report"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
