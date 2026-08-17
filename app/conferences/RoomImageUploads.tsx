"use client";

import { useRef, useState } from "react";
import { BannerCropper } from "./BannerCropper";

/**
 * RoomImageUploads — logo (profile photo) + banner pickers for the
 * community/conference CREATION form (Jack: "I don't see the ability to
 * upload a profile photo … that should be on the creation page").
 *
 * Each picker resizes client-side and writes a data URL into a hidden
 * input the create server action reads:
 *   - logo  → name="logo_upload"  (square 256)
 *   - banner→ name="cover_upload" (1200×630, also the share/OG image)
 *
 * Distinct field names (not logo_url/cover_url) so they don't collide
 * with BrandScrapeFields' hidden logo_url input; the action prefers an
 * explicit upload when present.
 */
export function RoomImageUploads() {
  const [logo, setLogo] = useState<string>("");
  const [banner, setBanner] = useState<string>("");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <input type="hidden" name="logo_upload" value={logo} />
      <input type="hidden" name="cover_upload" value={banner} />
      <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
        <Picker
          label="Profile photo"
          shape="square"
          value={logo}
          onChange={setLogo}
          w={256}
          h={256}
        />
        <div style={{ flex: "1 1 260px" }}>
          <div className="text-sm font-semibold" style={{ marginBottom: 6 }}>
            Banner{" "}
            <span style={{ color: "var(--text-dim)", fontWeight: 400 }}>
              (also the share image) (optional)
            </span>
          </div>
          {banner && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={banner}
              alt="banner preview"
              style={{
                width: "100%",
                maxWidth: 480,
                borderRadius: 12,
                display: "block",
                marginBottom: 6,
                border: "1px solid var(--border)"
              }}
            />
          )}
          <BannerCropper
            currentUrl={banner || null}
            onCropped={setBanner}
          />
        </div>
      </div>
    </div>
  );
}

function Picker({
  label,
  shape,
  value,
  onChange,
  w,
  h,
  grow
}: {
  label: string;
  shape: "square" | "wide";
  value: string;
  onChange: (v: string) => void;
  w: number;
  h: number;
  grow?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handle(file: File) {
    setErr(null);
    if (!file.type.startsWith("image/")) {
      setErr("Not an image.");
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      setErr("Over 12MB — try smaller.");
      return;
    }
    setBusy(true);
    try {
      onChange(await resizeCover(file, w, h, shape === "square" ? 0.85 : 0.82));
    } catch {
      setErr("Couldn't read that image.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ flex: grow ? "1 1 260px" : "0 0 auto" }}>
      <div className="text-sm font-semibold" style={{ marginBottom: 6 }}>
        {label}{" "}
        <span style={{ color: "var(--text-dim)", fontWeight: 400 }}>
          (optional)
        </span>
      </div>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handle(f);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => ref.current?.click()}
        disabled={busy}
        style={{
          display: "block",
          width: shape === "square" ? 96 : "100%",
          height: shape === "square" ? 96 : 120,
          borderRadius: shape === "square" ? 16 : 12,
          border: "1px dashed var(--border-bright)",
          background: value ? "transparent" : "var(--panel-2)",
          color: "var(--text-dim)",
          fontSize: 12,
          fontWeight: 700,
          cursor: "pointer",
          overflow: "hidden",
          padding: 0,
          position: "relative"
        }}
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={value}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : busy ? (
          "Processing…"
        ) : (
          "□ Upload"
        )}
      </button>
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          style={{
            marginTop: 4,
            background: "transparent",
            border: "none",
            padding: 0,
            cursor: "pointer",
            color: "var(--text-dim)",
            fontSize: 11
          }}
        >
          remove
        </button>
      )}
      {err && (
        <div style={{ fontSize: 11, color: "var(--red, #ef4444)", marginTop: 4 }}>
          {err}
        </div>
      )}
    </div>
  );
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

async function resizeCover(
  file: File,
  w: number,
  h: number,
  quality: number
): Promise<string> {
  const img = await loadImage(file);
  const targetRatio = w / h;
  const srcRatio = img.width / img.height;
  let sw = img.width;
  let sh = img.height;
  let sx = 0;
  let sy = 0;
  if (srcRatio > targetRatio) {
    sw = img.height * targetRatio;
    sx = (img.width - sw) / 2;
  } else {
    sh = img.width / targetRatio;
    sy = (img.height - sh) / 2;
  }
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("canvas unavailable");
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
  return c.toDataURL("image/jpeg", quality);
}
