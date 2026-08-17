"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Twin-files uploader — Jack's pitch-deck-for-VCs use case. Drop a
 * file (PDF, doc, image, list of businesses), give it a short
 * description, and the twin uses it as context (kind="context") or
 * keeps it ready to share inside a conversation (kind="shareable").
 *
 * Two-step upload: client POSTs metadata to /api/twin-files which
 * returns a signed upload URL → client PUTs the file bytes directly
 * to Supabase Storage. Lets us upload files up to ~50MB without
 * proxying bytes through the Next.js function.
 */
type TwinFile = {
  id: string;
  name: string;
  size_bytes: number;
  mime_type: string | null;
  kind: string;
  description: string | null;
  created_at: string;
};

function humanSize(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function FilesPanel() {
  const [files, setFiles] = useState<TwinFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string>("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState<"context" | "shareable">("context");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/twin-files");
      const j = await res.json();
      setFiles(j.files ?? []);
    } catch {
      /* offline — leave list */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function uploadFile(file: File) {
    setErr("");
    setUploading(true);
    // Helper that fires the error into the auto-report sink so it lands
    // on /admin/reports immediately — no need for the user to copy-paste.
    const reportFail = (stage: string, message: string) => {
      try {
        const data = JSON.stringify({
          message: `[twin-files upload] ${stage}: ${message}`,
          source: `twin-files:${stage}`,
          extras: {
            file_name: file.name,
            file_size: file.size,
            file_type: file.type,
            kind
          }
        });
        if (typeof navigator !== "undefined" && navigator.sendBeacon) {
          navigator.sendBeacon(
            "/api/error-report",
            new Blob([data], { type: "application/json" })
          );
        }
      } catch {
        /* never throw */
      }
    };
    try {
      const reservation = await fetch("/api/twin-files", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: file.name,
          mime_type: file.type || "application/octet-stream",
          size_bytes: file.size,
          kind,
          description: description.trim() || null
        })
      });
      if (!reservation.ok) {
        const j = await reservation.json().catch(() => ({}));
        const msg = j.detail || j.error || `HTTP ${reservation.status}`;
        reportFail("reservation", msg);
        throw new Error(msg);
      }
      const { upload_url, upload_token } = await reservation.json();
      // Supabase signed-upload PUT — pass the token, raw file body.
      const put = await fetch(upload_url, {
        method: "PUT",
        headers: {
          authorization: `Bearer ${upload_token}`,
          "content-type": file.type || "application/octet-stream"
        },
        body: file
      });
      if (!put.ok) {
        const detail = await put.text().catch(() => "");
        reportFail(
          "storage_put",
          `HTTP ${put.status}: ${detail.slice(0, 200)}`
        );
        // If the bucket genuinely doesn't exist on the storage side, this
        // PUT will 404 with "the related resource does not exist" — turn
        // that into a clean retry-friendly message.
        if (put.status === 404 || /resource|bucket/i.test(detail)) {
          throw new Error(
            "File storage is warming up. Please try the upload again in a few seconds."
          );
        }
        throw new Error(`Upload failed (HTTP ${put.status})`);
      }
      setDescription("");
      await load();
    } catch (e: any) {
      const msg =
        e?.message ||
        "Upload failed. We've logged this — try again in a moment.";
      setErr(msg);
      reportFail("caught", msg);
    } finally {
      setUploading(false);
    }
  }

  async function removeFile(id: string) {
    if (!confirm("Delete this file from your twin's context?")) return;
    try {
      await fetch(`/api/twin-files?id=${encodeURIComponent(id)}`, {
        method: "DELETE"
      });
      void load();
    } catch {
      /* ignore */
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) void uploadFile(f);
  }

  return (
    <section
      style={{
        padding: 18,
        borderRadius: 14,
        border: "1px solid var(--border)",
        background: "var(--panel-solid)",
        marginTop: 16
      }}
    >
      <header style={{ marginBottom: 12 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: "#1f8bff"
          }}
        >
          twin files
        </div>
        <h3
          style={{
            margin: "4px 0 6px",
            fontSize: 17,
            fontWeight: 800,
            letterSpacing: "-0.005em"
          }}
        >
          Drop pitch decks, resumes, lists, anything
        </h3>
        <p
          style={{
            fontSize: 13,
            color: "var(--text-dim)",
            lineHeight: 1.5,
            margin: 0
          }}
        >
          <strong style={{ color: "var(--text)" }}>Context files</strong> get
          fed to your twin during conversations. <strong style={{ color: "var(--text)" }}>Shareable
          files</strong> can be sent to a counterpart mid-conversation (e.g.
          your twin sends your pitch deck to a VC&apos;s twin).
        </p>
      </header>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: `1.5px dashed ${
            dragOver ? "#1f8bff" : "var(--border-bright)"
          }`,
          borderRadius: 12,
          padding: 18,
          textAlign: "center",
          background: dragOver
            ? "rgba(31, 139, 255, 0.06)"
            : "var(--panel-2)",
          cursor: "pointer",
          transition: "all 0.15s ease",
          marginBottom: 10
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void uploadFile(f);
          }}
        />
        <div style={{ fontSize: 24, marginBottom: 4 }} aria-hidden="true">
          □
        </div>
        <div style={{ fontSize: 13, color: "var(--text-dim)" }}>
          {uploading
            ? "Uploading…"
            : "Drag a file here, or click to choose. Up to 50 MB."}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 12,
          flexWrap: "wrap"
        }}
      >
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as any)}
          className="retro-input"
          style={{
            fontSize: 13,
            padding: "8px 10px",
            width: "auto"
          }}
        >
          <option value="context">Context (private)</option>
          <option value="shareable">Shareable (twin can send)</option>
        </select>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value.slice(0, 200))}
          placeholder="What's this file? (e.g. 'BUMP pitch deck — for VCs')"
          className="retro-input"
          style={{
            flex: 1,
            minWidth: 220,
            fontSize: 13,
            padding: "8px 10px"
          }}
        />
      </div>

      {err && (
        <div
          style={{
            fontSize: 12,
            color: "#ef4444",
            marginBottom: 10,
            padding: "8px 10px",
            background: "rgba(239, 68, 68, 0.06)",
            borderRadius: 8,
            border: "1px solid rgba(239, 68, 68, 0.25)"
          }}
        >
          {err}
        </div>
      )}

      {loading ? (
        <p style={{ fontSize: 12, color: "var(--text-dim)" }}>Loading…</p>
      ) : files.length === 0 ? (
        <p style={{ fontSize: 12, color: "var(--text-dim)", margin: 0 }}>
          No files yet. Drop one above to give your twin more context.
        </p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {files.map((f) => (
            <li
              key={f.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                padding: "8px 12px",
                background: "var(--panel-2)",
                borderRadius: 8,
                border: "1px solid var(--border)",
                marginBottom: 6
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: "var(--text)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap"
                  }}
                >
                  {f.name}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--text-dim)",
                    marginTop: 2
                  }}
                >
                  {humanSize(f.size_bytes)} ·{" "}
                  <span style={{ color: f.kind === "shareable" ? "#1f8bff" : undefined }}>
                    {f.kind}
                  </span>
                  {f.description ? ` · ${f.description}` : ""}
                </div>
              </div>
              <button
                type="button"
                onClick={() => removeFile(f.id)}
                title="Delete"
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 999,
                  background: "transparent",
                  border: "1px solid var(--border)",
                  color: "var(--text-dim)",
                  cursor: "pointer",
                  flexShrink: 0,
                  fontSize: 13
                }}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
