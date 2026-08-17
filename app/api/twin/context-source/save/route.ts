import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const blob = typeof body?.ai_export_blob === "string" ? body.ai_export_blob.trim().slice(0, 50000) : "";
  if (!blob) return NextResponse.json({ error: "Context cannot be empty." }, { status: 400 });
  const { error } = await supabase.from("twin_profiles").upsert({ user_id: user.id, ai_export_blob: blob, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ saved: true });
}
