import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { exaPeopleSearch, type ExaPerson } from "@/lib/exa";

/**
 * Find a person to start a conversation with — by name OR email.
 *
 * Returns two lists:
 *   sync_users  – matches inside SyncedIn (clickable → start convo)
 *   exa_people  – suggestions from the open web (clickable → invite + draft)
 *
 * If the query looks like an email, we do an exact email lookup first and
 * skip Exa (no point — we know who they are).
 */
export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { query?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const query = (body.query ?? "").trim();
  if (!query) {
    return NextResponse.json({ error: "missing_query" }, { status: 400 });
  }

  const service = createServiceClient();
  const isEmail = query.includes("@") && query.includes(".");

  // ── SyncedIn search ────────────────────────────────────────────────
  type SyncUser = {
    id: string;
    display_name: string | null;
    email: string | null;
  };
  let sync_users: SyncUser[] = [];

  if (isEmail) {
    const { data } = await service
      .from("profiles")
      .select("id, display_name, email")
      .eq("email", query.toLowerCase())
      .limit(5);
    sync_users = (data ?? []) as SyncUser[];
  } else {
    // Match by display_name OR email containing the query, exclude self.
    const { data } = await service
      .from("profiles")
      .select("id, display_name, email")
      .or(`display_name.ilike.%${query}%,email.ilike.%${query}%`)
      .neq("id", user.id)
      .limit(8);
    sync_users = (data ?? []) as SyncUser[];
  }

  // ── Exa fallback for context / discovery ────────────────────────────
  // Location-aware: pull the searcher's hometown + current city and use them
  // to (a) bias the Exa query string and (b) re-rank results by mention.
  let exa_people: ExaPerson[] = [];
  if (!isEmail) {
    const { data: twin } = await service
      .from("twin_profiles")
      .select("hometown, current_city")
      .eq("user_id", user.id)
      .maybeSingle();
    const cities = [twin?.current_city, twin?.hometown]
      .filter((c): c is string => Boolean(c && c.trim()))
      .map((c) => c.trim());

    try {
      // Augment the query with the user's location signals so Exa weighs
      // locally-relevant results higher.
      const augmented =
        cities.length > 0
          ? `${query} (location: ${cities.join(" or ")})`
          : query;
      exa_people = await exaPeopleSearch(augmented, 20);

      // Re-rank: any result whose snippet or title mentions one of the
      // cities floats to the top. Stable sort otherwise.
      if (cities.length > 0) {
        const norm = (s: string) => s.toLowerCase();
        const cityKeys = cities.map(norm);
        exa_people = exa_people
          .map((p, idx) => {
            const hay =
              norm(p.title || "") + " " + (p.highlights || []).map(norm).join(" ");
            const hit = cityKeys.some((c) => hay.includes(c));
            return { p, idx, score: hit ? 1 : 0 };
          })
          .sort((a, b) =>
            b.score - a.score === 0 ? a.idx - b.idx : b.score - a.score
          )
          .slice(0, 15)
          .map(({ p }) => p);
      } else {
        exa_people = exa_people.slice(0, 15);
      }
    } catch (e) {
      // Non-fatal — Exa is a "nice to have" here.
      console.error("exa lookup in find-counterpart failed", e);
    }
  }

  return NextResponse.json({ sync_users, exa_people });
}
