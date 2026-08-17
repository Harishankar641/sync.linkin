"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "./Avatar";

/**
 * NavMenu — collapses secondary nav into a profile-avatar dropdown.
 *
 * Visible inline: theme toggle + the primary CTA (+ new). Everything
 * else lives behind the avatar: hypernetwork / feedback / messages /
 * edit twin / notifications / sign out.
 */
export function NavMenu({
  userId,
  displayName,
  avatarUrl,
  signOutAction
}: {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  signOutAction: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("click", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("click", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const items: Array<
    | { kind: "link"; href: string; label: string; icon: string }
    | { kind: "form"; label: string; icon: string; action: () => void | Promise<void> }
  > = [
    { kind: "link", href: "/hypernetwork", label: "Hypernetwork", icon: "◇" },
    { kind: "link", href: "/messages", label: "Messages", icon: "◌" },
    { kind: "link", href: "/conferences/new", label: "Sync a conference", icon: "◈" },
    { kind: "link", href: "/feedback", label: "Feedback", icon: "✦" },
    { kind: "link", href: "/onboarding", label: "Edit twin", icon: "◐" },
    {
      kind: "link",
      href: "/settings/notifications",
      label: "Notifications",
      icon: "◉"
    },
    { kind: "form", label: "Sign out", icon: "↗", action: signOutAction }
  ];

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={displayName}
        style={{
          padding: 0,
          background: "transparent",
          border: 0,
          cursor: "pointer",
          borderRadius: "50%",
          outline: open ? "2px solid var(--amber)" : "none",
          outlineOffset: 2,
          transition: "outline-offset 120ms ease"
        }}
      >
        <Avatar
          id={userId}
          name={displayName}
          avatarUrl={avatarUrl}
          size={34}
        />
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            width: 220,
            background: "var(--panel-solid)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            boxShadow: "0 18px 40px -12px rgba(0,0,0,0.45)",
            padding: 6,
            zIndex: 40
          }}
        >
          <div
            style={{
              padding: "8px 10px 10px",
              borderBottom: "1px solid var(--border)",
              marginBottom: 4
            }}
          >
            <div
              style={{
                fontWeight: 700,
                fontSize: 13,
                color: "var(--text)",
                lineHeight: 1.2,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap"
              }}
            >
              {displayName}
            </div>
            <div
              style={{
                fontSize: 11,
                color: "var(--text-dim)",
                marginTop: 2
              }}
            >
              signed in
            </div>
          </div>
          {items.map((item, i) =>
            item.kind === "link" ? (
              <Link
                key={`l-${i}`}
                href={item.href}
                onClick={() => setOpen(false)}
                style={menuItemStyle}
                role="menuitem"
              >
                <span style={iconStyle}>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ) : (
              <form key={`f-${i}`} action={item.action}>
                <button
                  type="submit"
                  style={{ ...menuItemStyle, width: "100%", textAlign: "left" }}
                  role="menuitem"
                >
                  <span style={iconStyle}>{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              </form>
            )
          )}
        </div>
      )}
    </div>
  );
}

const menuItemStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "9px 10px",
  borderRadius: 8,
  fontSize: 14,
  color: "var(--text)",
  textDecoration: "none",
  background: "transparent",
  border: 0,
  cursor: "pointer",
  fontFamily: "inherit"
};

const iconStyle: React.CSSProperties = {
  display: "inline-flex",
  width: 18,
  height: 18,
  alignItems: "center",
  justifyContent: "center",
  fontSize: 12,
  color: "var(--text-dim)",
  fontFamily: '"IBM Plex Mono", ui-monospace, monospace'
};
