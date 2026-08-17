import Link from "next/link";

/**
 * SyncedIn wordmark — real logo PNG from /public.
 *
 * Sizes (raw heights so the wordmark really pops in headers):
 *   sm: 40px
 *   md: 80px
 *   lg: 140px
 *   xl: 200px
 *
 * The PNG is forced to white so the complete logo — symbol + "SyncedIn"
 * text — stays clearly visible on the permanent dark landing-page theme.
 */
export function Wordmark({
  size = "lg",
  href = "/"
}: {
  size?: "sm" | "md" | "lg" | "xl";
  href?: string | null;
}) {
  const h =
    size === "xl" ? 200 : size === "lg" ? 140 : size === "sm" ? 40 : 80;

  const inner = (
    <img
      src="/syncedin-wordmark.png"
      alt="SyncedIn"
      height={h}
      className="wordmark-themed"
      style={{
        height: h,
        width: "auto",
        display: "block",

        // Convert the original PNG logo to clean white.
        // brightness(0) makes every non-transparent pixel black,
        // then invert(1) makes it white.
        filter: "brightness(0) invert(1)",
        opacity: 1
      }}
    />
  );

  const wrap = (
    <span
      className="inline-flex items-center select-none"
      style={{ height: h }}
    >
      {inner}
    </span>
  );

  if (!href) return wrap;

  return (
    <Link
      href={href}
      aria-label="SyncedIn — home"
      className="inline-flex items-center select-none"
      style={{ height: h }}
    >
      {inner}
    </Link>
  );
}