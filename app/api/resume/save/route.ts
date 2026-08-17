import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json();
  if (!body?.parsed) return NextResponse.json({ error: "missing parsed resume" }, { status: 400 });

  const { data: existing } = await supabase
    .from("twin_profiles")
    .select("ai_export_blob")
    .eq("user_id", user.id)
    .maybeSingle();

  const payload = JSON.stringify(body.parsed, null, 2);
  const old = String(existing?.ai_export_blob || "");
  const withoutOld = old
    .replace(/\n\n\[SYNcedIN RESUME PROFILE\][\s\S]*$/i, "")
    .replace(/\n\n# Resume \(uploaded resume\)[\s\S]*$/i, "")
    .trim();
  const next = `${withoutOld}\n\n# Resume (uploaded resume)\n${payload}`.trim();

  const { error } = await supabase
    .from("twin_profiles")
    .upsert(
      { user_id: user.id, ai_export_blob: next, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ saved: true });
}
