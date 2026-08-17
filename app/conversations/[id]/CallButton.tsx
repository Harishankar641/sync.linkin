"use client";

import { useState } from "react";
import { CallModal } from "./CallModal";

/**
 * Audio + Video call buttons for the conversation header. Either
 * launches the same call modal (Jitsi iframe + tldraw dream board
 * side-by-side). The `kind` just gets stamped on the calls row for
 * analytics + future "this user prefers audio" prefs.
 */
export function CallButton({
  conversationId,
  otherName
}: {
  conversationId: string;
  otherName: string;
}) {
  const [open, setOpen] = useState<null | "audio" | "video">(null);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen("audio")}
        title={`Audio call with ${otherName}`}
        aria-label="Start audio call"
        style={{
          width: 32,
          height: 32,
          borderRadius: 999,
          border: "1px solid var(--border)",
          background: "transparent",
          color: "var(--text)",
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 14
        }}
      >
        □
      </button>
      <button
        type="button"
        onClick={() => setOpen("video")}
        title={`Video call with ${otherName} + dream board`}
        aria-label="Start video call"
        style={{
          width: 32,
          height: 32,
          borderRadius: 999,
          border: "1px solid var(--border)",
          background: "transparent",
          color: "var(--text)",
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 14
        }}
      >
        □
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
