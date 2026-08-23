"use client";

import { useState } from "react";
import { CallModal } from "./CallModal";

export function CallButton({
  conversationId,
  otherName
}: {
  conversationId: string;
  otherName: string;
}) {
  const [open, setOpen] =
    useState<null | "audio" | "video">(null);

  return (
    <>
      {/* Audio call */}
      <button
        type="button"
        onClick={() => setOpen("audio")}
        title={`Audio call with ${otherName}`}
        aria-label="Start audio call"
        style={{
          width: 32,
          height: 32,
          minWidth: 32,
          borderRadius: 999,
          border: "1px solid var(--border)",
          background: "transparent",
          color: "var(--text)",
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 0
        }}
      >
        <svg
          width="17"
          height="17"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.9.33 1.78.62 2.63a2 2 0 0 1-.45 2.11L8 9.73a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.85.29 1.73.5 2.63.62A2 2 0 0 1 22 16.92z" />
        </svg>
      </button>

      {/* Video call */}
      <button
        type="button"
        onClick={() => setOpen("video")}
        title={`Video call with ${otherName} + dream board`}
        aria-label="Start video call"
        style={{
          width: 32,
          height: 32,
          minWidth: 32,
          borderRadius: 999,
          border: "1px solid var(--border)",
          background: "transparent",
          color: "var(--text)",
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 0
        }}
      >
        <svg
          width="17"
          height="17"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M15 10l4.5-3v10L15 14z" />
          <rect
            x="3"
            y="6"
            width="12"
            height="12"
            rx="2"
          />
        </svg>
      </button>

      {open && (
        <CallModal
          conversationId={conversationId}
          otherName={otherName}
          kind={open}
          onClose={() => setOpen(null)}
        />
      )}
    </>
  );
}