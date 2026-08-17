import Link from "next/link";

/**
 * TrustNote, the hard product rule, shown next to every surface where
 * someone pastes their personal intelligence. One sentence, everywhere
 * the same: dumps are read by your twin, never displayed to another
 * human. Server-safe (no hooks) so it drops into server and client
 * trees alike.
 */
export function TrustNote({
  style
}: {
  style?: React.CSSProperties;
}) {
  return (
    <p
      style={{
        marginTop: 8,
        fontSize: 11.5,
        lineHeight: 1.5,
        color: "var(--text-dim)",
        textAlign: "center",
        ...style
      }}
    >
      ◇ Your intelligence stays yours. What you paste is read by your
      twin, never shown to another human.{" "}
      <Link
        href="/privacy"
        style={{ color: "var(--amber-bright)", textDecoration: "none" }}
      >
        How we handle data
      </Link>
    </p>
  );
}
