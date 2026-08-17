/**
 * Responsive Loom video embed (16:9). Server-safe — just an iframe in a
 * padding-ratio box so it scales on every viewport. Used at the bottom of
 * the hypernetwork + landing pages to show the platform in action.
 */
export function LoomEmbed({
  id,
  title,
  caption
}: {
  id: string;
  title?: string;
  caption?: string;
}) {
  return (
    <section style={{ maxWidth: 880, margin: "0 auto", width: "100%" }}>
      {title && (
        <h2
          style={{
            fontSize: 22,
            fontWeight: 800,
            letterSpacing: "-0.01em",
            textAlign: "center",
            margin: "0 0 6px"
          }}
        >
          {title}
        </h2>
      )}
      {caption && (
        <p
          style={{
            fontSize: 14,
            color: "var(--text-dim)",
            textAlign: "center",
            margin: "0 0 16px",
            lineHeight: 1.5
          }}
        >
          {caption}
        </p>
      )}
      <div
        style={{
          position: "relative",
          paddingBottom: "62.5%",
          height: 0,
          borderRadius: 16,
          overflow: "hidden",
          border: "1px solid var(--border)",
          boxShadow: "0 16px 40px -16px var(--accent-glow, rgba(0,0,0,0.35))"
        }}
      >
        <iframe
          src={`https://www.loom.com/embed/${id}`}
          allowFullScreen
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            border: 0
          }}
          title={title || "SyncedIn"}
        />
      </div>
    </section>
  );
}
