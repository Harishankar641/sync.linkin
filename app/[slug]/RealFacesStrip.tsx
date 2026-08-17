import Link from "next/link";
import { Avatar } from "../Avatar";

/**
 * Real-faces social-proof strip for the invite landing page. Shows up
 * to N existing SyncedIn users with their REAL profile photos + names
 * so the recipient lands and immediately sees "these are the actual
 * humans inside, not a placeholder demo." Jack: "show the list of
 * real faces and good profile photos that we get currently."
 *
 * Pure server component — the parent /[slug] page fetches the list
 * and passes it in.
 */
export type FaceRow = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  handle: string | null;
  headline: string | null; // first line of bio / portfolio_about
};

export function RealFacesStrip({ faces }: { faces: FaceRow[] }) {
  if (!faces || faces.length === 0) return null;

  return (
    <section
      style={{
        marginTop: 24,
        padding: 22,
        borderRadius: 18,
        background: "var(--panel-solid)",
        border: "1px solid var(--border)"
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "var(--text-dim)",
          marginBottom: 4
        }}
      >
        real humans already on SyncedIn
      </div>
      <h3
        style={{
          margin: "4px 0 14px",
          fontSize: 18,
          fontWeight: 800,
          letterSpacing: "-0.005em",
          color: "var(--text)"
        }}
      >
        {faces.length === 1
          ? "One real human"
          : `${faces.length} real humans`}{" "}
        your twin could talk to today.
      </h3>
      <div
        style={{
          display: "grid",
          gap: 10,
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))"
        }}
      >
        {faces.map((f) => {
          const name = f.display_name || "Member";
          const inner = (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: 10,
                borderRadius: 12,
                background: "var(--panel-2)",
                border: "1px solid var(--border)",
                transition: "border-color 0.15s ease, transform 0.15s ease",
                height: "100%",
                color: "inherit",
                textDecoration: "none"
              }}
              className="real-face-card"
            >
              <Avatar
                id={f.id}
                name={name}
                avatarUrl={f.avatar_url}
                size={42}
              />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: 13,
                    color: "var(--text)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap"
                  }}
                >
                  {name}
                </div>
                {f.headline && (
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--text-dim)",
                      lineHeight: 1.35,
                      marginTop: 2,
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden"
                    }}
                  >
                    {f.headline}
                  </div>
                )}
              </div>
            </div>
          );
          return f.handle ? (
            <Link
              key={f.id}
              href={`/u/${f.handle}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ textDecoration: "none" }}
            >
              {inner}
            </Link>
          ) : (
            <div key={f.id}>{inner}</div>
          );
        })}
      </div>
      <style>{`
        .real-face-card:hover {
          border-color: #1f8bff !important;
          transform: translateY(-1px);
        }
      `}</style>
    </section>
  );
}
