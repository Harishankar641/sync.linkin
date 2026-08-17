"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "./Avatar";

/**
 * Top navigation bar — Jack's call (May 2026):
 *   "Move hypernetwork, sync a community, sync a conference to menu
 *    items on the dashboard at the top. Settings + edit should be a
 *    profile picture dropdown in the top right corner."
 *
 * Sits sticky above the sidebar+main grid on every signed-in page.
 * The sidebar still owns conversation-tier nav (Messages, Proposals,
 * Invite, Poll, Personal Intelligence, Feedback, Conferences list).
 * Profile-edit + account settings live behind a click on the avatar.
 *
 * Client component so the profile dropdown can toggle without a round
 * trip and the active-route highlighting works without a server reflow.
 */
export function TopBar({
  userId,
  displayName,
  avatarUrl,
  portfolioHandle,
  signOutAction,
  unreadCounts = {},
  isAdmin = false
}: {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  /** True only for the founder account — gates the Admin nav link. The
   *  /admin pages are independently hard-gated server-side too, so this
   *  is just to avoid showing a link that would 404 for everyone else. */
  isAdmin?: boolean;
  /** profiles.handle — used to build the /u/{handle} portfolio link. If
   *  null, the portfolio menu item is hidden because /u/<UUID> 404s
   *  (the route looks up by handle, not id). */
  portfolioHandle?: string | null;
  signOutAction: () => void | Promise<void>;
  /** Same shape as Sidebar's unreadCounts — used to badge the
   *  Messages + Proposals top-nav links. */
  unreadCounts?: Record<string, number>;
}) {
  const pathname = usePathname() ?? "";
  const [profileOpen, setProfileOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // Click-outside / Esc to close the profile dropdown.
  useEffect(() => {
    if (!profileOpen) return;
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setProfileOpen(false);
    }
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [profileOpen]);

  // TopBar holds the NETWORK-tier nav only (Hypernetwork + the two
  // Sync surfaces). Messages + Proposals removed per Jack — they live
  // in the sidebar already and were duplicating chrome at the top.
  const items: Array<{ href: string; label: string }> = [
    { href: "/hypernetwork", label: "Hypernetwork" },
    { href: "/conferences/new", label: "Sync a conference" },
    { href: "/communities/new", label: "Sync a community" },
    // Founder-only — appended last so it sits at the end of the nav.
    ...(isAdmin ? [{ href: "/admin/usage", label: "Admin" }] : [])
  ];
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 30,
        background: "var(--panel-solid)",
        borderBottom: "1px solid var(--border)",
        padding: "8px 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
        marginBottom: 12
      }}
    >
      {/* Wordmark — pulled up out of the sidebar (Jack: "move the logo
          to the top part up above, bring up some space"). Always
          links home. */}
      <Link
        href="/"
        aria-label="SyncedIn — home"
        style={{
          display: "inline-flex",
          alignItems: "center",
          padding: "2px 0",
          flexShrink: 0,
          textDecoration: "none"
        }}
      >
        <img
          src="/syncedin-wordmark-tight.png"
          alt="SyncedIn"
          className="wordmark-themed"
          style={{
            height: 28,
            width: "auto",
            display: "block"
          }}
        />
      </Link>

      {/* Nav items — pinned to the RIGHT next to the profile chip per
          Jack: "move these items in the top menu all the way to the
          right side next to the profile piece." */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
          justifyContent: "flex-end",
          flex: 1
        }}
      >
      <nav
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          flexWrap: "wrap",
          minWidth: 0
        }}
      >
        {items.map((item) => {
          const active = isActive(item.href);
          const unread = unreadCounts[item.href] ?? 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                position: "relative",
                padding: "7px 12px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: active ? 700 : 500,
                color: active ? "var(--text)" : "var(--text-dim)",
                background: active ? "var(--panel-2)" : "transparent",
                textDecoration: "none",
                whiteSpace: "nowrap",
                display: "inline-flex",
                alignItems: "center",
                gap: 6
              }}
            >
              <span>{item.label}</span>
              {unread > 0 && (
                <span
                  aria-label={`${unread} unread`}
                  style={{
                    minWidth: 16,
                    height: 16,
                    padding: "0 5px",
                    borderRadius: 999,
                    background: "#ef4444",
                    color: "#fff",
                    fontSize: 10,
                    fontWeight: 800,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }}
                >
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Right side: profile avatar (click → dropdown) */}
      <div ref={wrapRef} style={{ position: "relative" }}>
        <button
          type="button"
          onClick={() => setProfileOpen((v) => !v)}
          aria-label="Account menu"
          aria-haspopup="menu"
          aria-expanded={profileOpen}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "4px 8px 4px 4px",
            borderRadius: 999,
            border: "1px solid var(--border)",
            background: profileOpen ? "var(--panel-2)" : "transparent",
            cursor: "pointer",
            flexShrink: 0
          }}
        >
          <Avatar
            id={userId}
            name={displayName}
            avatarUrl={avatarUrl}
            size={28}
          />
          <span
            style={{
              fontSize: 12,
              color: "var(--text-dim)",
              fontWeight: 600,
              maxWidth: 100,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap"
            }}
          >
            {displayName}
          </span>
          <span
            style={{
              fontSize: 9,
              color: "var(--text-dim)",
              transform: profileOpen ? "rotate(180deg)" : undefined,
              transition: "transform 0.15s"
            }}
            aria-hidden="true"
          >
            ▼
          </span>
        </button>

        {profileOpen && (
          <div
            role="menu"
            style={{
              position: "absolute",
              top: "calc(100% + 6px)",
              right: 0,
              minWidth: 200,
              background: "var(--panel-solid)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              padding: 6,
              boxShadow: "0 8px 24px rgba(0,0,0,0.12)"
            }}
          >
            <Link
              href="/onboarding"
              role="menuitem"
              onClick={() => setProfileOpen(false)}
              style={menuItemStyle}
            >
              <span style={{ width: 18, textAlign: "center" }}>◈</span>
              <span>Edit twin</span>
            </Link>
            <Link
              href="/settings"
              role="menuitem"
              onClick={() => setProfileOpen(false)}
              style={menuItemStyle}
            >
              <span style={{ width: 18, textAlign: "center" }}>□</span>
              <span>Account settings</span>
            </Link>
            {portfolioHandle && (
              <Link
                href={`/u/${portfolioHandle}`}
                role="menuitem"
                onClick={() => setProfileOpen(false)}
                style={menuItemStyle}
              >
                <span style={{ width: 18, textAlign: "center" }}>◎</span>
                <span>My portfolio</span>
              </Link>
            )}
            {/* DATA section — Jack: "let's move that under that top
                right part where you click your name. I think that would
                be better. And let's move the upload/export file next to
                that upload part drop-down." Import + export sit as
                peers here since both are one-off data operations. */}
            <div
              style={{
                height: 1,
                background: "var(--border)",
                margin: "6px 4px"
              }}
            />
            <Link
              href="/continuation"
              role="menuitem"
              onClick={() => setProfileOpen(false)}
              style={menuItemStyle}
              title="Upload an iMessage / WhatsApp / SMS export to model the other person and generate the next 8-10 messages"
            >
              <span style={{ width: 18, textAlign: "center" }}>↑</span>
              <span>Import a chat</span>
            </Link>
            <a
              href="/api/export-messages"
              role="menuitem"
              onClick={() => setProfileOpen(false)}
              style={menuItemStyle}
              title="Download every conversation + message you've sent on SyncedIn as a single JSON file"
              download
            >
              <span style={{ width: 18, textAlign: "center" }}>↓</span>
              <span>Export my messages</span>
            </a>
            <div
              style={{
                height: 1,
                background: "var(--border)",
                margin: "6px 4px"
              }}
            />
            <form action={signOutAction}>
              <button
                type="submit"
                role="menuitem"
                style={{
                  ...menuItemStyle,
                  width: "100%",
                  textAlign: "left",
                  background: "transparent",
                  border: 0,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  color: "var(--text-dim)"
                }}
              >
                <span style={{ width: 18, textAlign: "center" }}>↗</span>
                <span>Sign out</span>
              </button>
            </form>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}

const menuItemStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "8px 10px",
  borderRadius: 6,
  fontSize: 13,
  color: "var(--text)",
  textDecoration: "none"
};
