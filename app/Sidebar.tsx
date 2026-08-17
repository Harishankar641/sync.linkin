"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar } from "./Avatar";
import { Wordmark } from "./Wordmark";
import { ThemeToggle } from "./ThemeToggle";

/**
 * Sidebar — vertical nav for signed-in users.
 *
 * Replaces the avatar-dropdown NavMenu. Profile block lives at the top,
 * primary destinations stack vertically, sign out is pinned to the bottom.
 *
 * Layout-friendly: the parent grid sizes this at 220px wide on desktop and
 * collapses to a horizontal scroller on mobile (handled by the parent).
 */
export function Sidebar({
  userId,
  displayName,
  avatarUrl,
  signOutAction,
  conferences = [],
  unreadCounts = {},
  cloneCard
}: {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  signOutAction: () => void | Promise<void>;
  conferences?: { slug: string; name: string }[];
  unreadCounts?: Record<string, number>;
  /** Clone-sync card rendered INSIDE the sidebar at the bottom (above
   *  sign-out). Lives inside the single sticky <aside> so it scrolls
   *  with the nav as one block — preloaded, identical on every page,
   *  no jitter. AppShell builds + passes this once. */
  cloneCard?: React.ReactNode;
}) {
  const pathname = usePathname() ?? "";

  // Professional text symbols keep the navigation visual without using
  // decorative emojis. The web experience remains clean and product-led.
  //
  // Keep every original day-to-day destination visible in the new UI.
  // New premium/network destinations are additive; nothing from the old
  // navigation is removed.
  const items: Array<{ href: string; label: string; icon: string }> = [
    // Original core destinations are kept intact; the new premium destinations
    // are added alongside them rather than replacing them.
    { href: "/twin", label: "Chat", icon: "◎" },
    { href: "/dashboard", label: "Command Center", icon: "▦" },
    { href: "/messages", label: "Messages", icon: "◌" },
    { href: "/invite", label: "Invite", icon: "↗" },
    { href: "/ghosts", label: "Talk with ghosts", icon: "◇" },
    { href: "/poll", label: "Poll", icon: "▥" },
    { href: "/personal-intelligence", label: "Personal intelligence", icon: "✦" },
    { href: "/feedback", label: "Feedback", icon: "□" },
    // New-file destinations — preserved in addition to the original nav.
    { href: "/twin-lab", label: "Twin Lab", icon: "◇" },
    { href: "/hypernetwork", label: "Twin Network", icon: "◈" },
    { href: "/career-intelligence", label: "Career intelligence", icon: "◈" }
  ];

  const isActive = (href: string) => {
    const base = href.split("#")[0];
    if (href === "/twin-lab") return pathname === "/twin-lab";
    return pathname === base || (base !== "/dashboard" && pathname.startsWith(base + "/"));
  };

  return (
    <aside
      style={{
        position: "sticky",
        top: 16,
        alignSelf: "start",
        background: "var(--panel-solid)",
        border: "1px solid var(--border)",
        borderRadius: 14,
        // Spacing: real breathing room around the logo (14px top + 12px
        // bottom + 10px gap to the profile chip below). Was 8/8 which
        // crowded both edges and made the wordmark look pinched against
        // the panel border.
        padding: "14px 14px 12px",
        display: "flex",
        flexDirection: "column",
        gap: 10
        // minHeight removed — was 480 which created huge bottom whitespace
        // when the user has few nav items; let content size the sidebar.
      }}
    >
      {/* Wordmark moved to the TopBar (Jack: "move the logo to the top
          part up above, bring up some space"). The sidebar is shorter
          now since the nav items can start right at the top of the
          column. We still render the wordmark inside the mobile drawer
          via MobileShell's own top bar, so this hidden lg-only block
          is dead in the desktop sidebar. */}

      {/* Profile chip removed per Jack — the same name + avatar already
          lives in the top-right TopBar dropdown, so the sidebar chip was
          duplicating chrome. Drops a full row of vertical space too. */}

      {/* Primary nav */}
      <style>{`
        .synced-nav-link { transition: background 0.15s ease, color 0.15s ease, transform 0.15s ease, border-left-color 0.15s ease; }
        .synced-nav-link:hover {
          background: var(--panel-2) !important;
          color: var(--text) !important;
          transform: translateX(3px);
          border-left-color: var(--amber-bright) !important;
        }
        .synced-nav-link:hover .synced-nav-icon { color: var(--amber-bright) !important; }
      `}</style>
      <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {items.map((item) => {
          const active = isActive(item.href);
          const unread = unreadCounts[item.href] ?? 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={true}
              className="synced-nav-link"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "9px 10px",
                borderRadius: 8,
                fontSize: 14,
                color: active ? "var(--text)" : "var(--text-dim)",
                background: active ? "var(--panel-2)" : "transparent",
                fontWeight: active ? 600 : 400,
                textDecoration: "none",
                borderLeft: active
                  ? "2px solid var(--amber)"
                  : "2px solid transparent"
              }}
            >
              <span
                className="synced-nav-icon"
                style={{
                  width: 24,
                  height: 24,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 16,
                  fontWeight: 800,
                  color: active ? "var(--amber-bright)" : "var(--text-dim)"
                }}
              >
                {item.icon}
              </span>
              <span style={{ flex: 1 }}>{item.label}</span>
              {unread > 0 && (
                <span
                  aria-label={`${unread} unread`}
                  title={`${unread} thing${
                    unread === 1 ? "" : "s"
                  } waiting on you`}
                  style={{
                    minWidth: 18,
                    height: 18,
                    padding: "0 6px",
                    borderRadius: 999,
                    background: "#ef4444",
                    color: "#fff",
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: 0,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 0 0 3px var(--panel-solid)"
                  }}
                >
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* My conferences */}
      {conferences.length > 0 && (
        <div style={{ marginTop: 6 }}>
          <div
            style={{
              fontSize: 10,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--text-dim)",
              padding: "0 10px 4px",
              marginTop: 4
            }}
          >
            Your conferences
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {conferences.map((c) => {
              const href = `/conferences/${c.slug}`;
              const active = pathname === href || pathname.startsWith(href + "/");
              return (
                <Link
                  key={c.slug}
                  href={href}
                  className="synced-nav-link"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "7px 10px",
                    borderRadius: 8,
                    fontSize: 13,
                    color: active ? "var(--text)" : "var(--text-dim)",
                    background: active ? "var(--panel-2)" : "transparent",
                    fontWeight: active ? 600 : 400,
                    textDecoration: "none",
                    borderLeft: active
                      ? "2px solid var(--amber)"
                      : "2px solid transparent"
                  }}
                >
                  <span
                    style={{
                      width: 18,
                      display: "inline-flex",
                      justifyContent: "center",
                      fontSize: 11,
                      color: active ? "var(--amber-bright)" : "var(--text-dim)",
                      fontFamily: '"IBM Plex Mono", ui-monospace, monospace'
                    }}
                  >
                    ◈
                  </span>
                  <span
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      minWidth: 0,
                      flex: 1
                    }}
                  >
                    {c.name}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* + new conversation — primary CTA, lives above the sign out row */}
      <Link
        href="/conversations/new"
        className="retro-btn retro-btn-primary"
        style={{
          marginTop: "auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          padding: "10px 12px",
          fontSize: 14
        }}
      >
        + new conversation
      </Link>

      {/* Clone-sync card — rendered INSIDE the sticky aside so it
          scrolls with the nav as one block (fixes the "sync avatar
          floats away" bug Jack flagged). */}
      {cloneCard}

      {/* Bottom row: sign out + compact theme toggle */}
      <div
        style={{
          paddingTop: 8,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          borderTop: "1px solid var(--border)"
        }}
      >
        <form action={signOutAction} style={{ flex: 1 }}>
          <button
            type="submit"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 10px",
              borderRadius: 8,
              fontSize: 13,
              color: "var(--text-dim)",
              background: "transparent",
              border: 0,
              cursor: "pointer",
              width: "100%",
              textAlign: "left",
              fontFamily: "inherit"
            }}
          >
            <span
              style={{
                width: 16,
                display: "inline-flex",
                justifyContent: "center",
                fontSize: 11,
                fontFamily: '"IBM Plex Mono", ui-monospace, monospace'
              }}
            >
              ↗
            </span>
            <span>Sign out</span>
          </button>
        </form>
        {/* Compact theme toggle — wrapper shrinks the inline button styling
            without touching the shared ThemeToggle component used elsewhere. */}
        <div
          style={{
            fontSize: 11,
            transform: "scale(0.85)",
            transformOrigin: "right center"
          }}
        >
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
}
