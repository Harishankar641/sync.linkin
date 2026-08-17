"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BannerCropper } from "../BannerCropper";

/**
 * BannerUpload — owner-only banner control on the room page. Uses
 * BannerCropper so the owner can SEE and choose the crop (Jack), then
 * saves the 1200×630 data URL to conferences.cover_url (also the OG
 * image). Same data-URL pattern avatars use — no storage bucket.
 */
export function BannerUpload({
  slug,
  initialUrl
}: {
  slug: string;
  initialUrl: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save(dataUrl: string) {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/communities/${slug}/banner`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cover_url: dataUrl })
      });
      const j = await res.json().catch(() => ({}) as any);
      if (!res.ok || j?.error) {
        throw new Error(j?.detail || j?.error || "Upload failed.");
      }
      router.refresh();
    } catch (e: any) {
      setErr(e?.message || "Couldn't save that image.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ marginTop: 8 }}>
      <BannerCropper currentUrl={initialUrl} onCropped={save} />
      {busy && (
        <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 4 }}>
          Saving…
        </div>
      )}
      {err && (
        <div style={{ fontSize: 11, color: "var(--red, #ef4444)", marginTop: 4 }}>
          {err}
        </div>
      )}
      {initialUrl && !busy && (
        <span style={{ fontSize: 11, color: "var(--text-dim)" }}>
          Also used as the share/preview image.
        </span>
      )}
    </div>
  );
}
