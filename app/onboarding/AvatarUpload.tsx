"use client";

import { useRef, useState } from "react";
import { Avatar } from "../Avatar";

/**
 * Avatar picker: click the preview to open a file dialog, or drag-and-drop
 * an image onto it. Resizes to a 256x256 JPEG client-side so we don't ship
 * megabyte images into the form / database.
 *
 * Returns the data URL via `onChange`. Also accepts a URL paste fallback
 * for people who'd rather link to a remote photo.
 */
export function AvatarUpload({
  id,
  name,
  value,
  onChange
}: {
  id: string;
  name: string;
  value: string;
  onChange: (next: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    if (!file.type.startsWith("image/")) {
      setError("That doesn't look like an image.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError("Image is over 8MB. Try something smaller.");
      return;
    }
    try {
      const dataUrl = await resizeToDataUrl(file, 256, 0.85);
      onChange(dataUrl);
    } catch (e: any) {
      setError("Couldn't read that image. Try a different one.");
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // Reset so picking the same file again still fires onChange
    e.target.value = "";
  }

  // Hide the URL paste field once a picture is set — once there's an
  // image, the URL row reads as an "unfilled" gap. Show a tiny "Remove"
  // affordance instead. Without an image, expose the URL input as a
  // small inline fallback (no big "Choose file" button — clicking the
  // circle does that job).
  const hasImage = !!value;
  const showUrlInput = !hasImage;

  return (
    <div style={{ display: "inline-block" }}>
      <div
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") fileRef.current?.click();
        }}
        style={{
          position: "relative",
          cursor: "pointer",
          borderRadius: "50%",
          padding: 4,
          border: `2px dashed ${dragging ? "var(--amber)" : "var(--border-bright)"}`,
          background: dragging ? "var(--panel-2)" : "transparent",
          transition: "border-color 0.15s ease, background 0.15s ease",
          width: 120,
          height: 120
        }}
        title="Click or drag an image here"
      >
        <Avatar
          id={id}
          name={name || "you"}
          avatarUrl={value || null}
          size={112}
        />
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            paddingBottom: 6,
            pointerEvents: "none",
            opacity: value ? 0 : 0.8
          }}
        >
          <span
            style={{
              background: "rgba(10,13,24,0.75)",
              color: "#fff",
              borderRadius: 999,
              padding: "3px 10px",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase"
            }}
          >
            {dragging ? "drop" : "upload"}
          </span>
        </div>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        onChange={onPick}
        style={{ display: "none" }}
      />

      {/* Hidden URL-paste fallback. Only renders when no image is set so
          the form doesn't look unfilled when there IS already a photo. */}
      {showUrlInput && (
        <div style={{ marginTop: 8, width: 140 }}>
          <input
            value={value.startsWith("data:") ? "" : value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="or paste image URL"
            className="retro-input"
            style={{ fontSize: 11, padding: "5px 8px" }}
          />
        </div>
      )}

      {hasImage && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="retro-dim"
          style={{
            display: "block",
            marginTop: 6,
            fontSize: 11,
            background: "transparent",
            border: "none",
            cursor: "pointer",
            textDecoration: "underline",
            color: "var(--text-dim)"
          }}
        >
          remove
        </button>
      )}

      {error && (
        <p
          className="text-xs mt-2"
          style={{ color: "var(--red)", maxWidth: 140 }}
        >
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Resize an image File to a square max-edge data URL using canvas.
 * Crops to a centered square first.
 */
async function resizeToDataUrl(
  file: File,
  maxEdge: number,
  quality: number
): Promise<string> {
  const bmp = await loadImage(file);
  const minSide = Math.min(bmp.width, bmp.height);
  const sx = Math.max(0, (bmp.width - minSide) / 2);
  const sy = Math.max(0, (bmp.height - minSide) / 2);
  const c = document.createElement("canvas");
  c.width = maxEdge;
  c.height = maxEdge;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("canvas unavailable");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, maxEdge, maxEdge);
  ctx.drawImage(bmp, sx, sy, minSide, minSide, 0, 0, maxEdge, maxEdge);
  return c.toDataURL("image/jpeg", quality);
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    const r = new FileReader();
    r.onload = () => {
      img.src = r.result as string;
    };
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
