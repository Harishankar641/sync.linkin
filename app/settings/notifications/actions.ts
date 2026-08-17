"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function saveNotificationPrefs(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const email = String(formData.get("email_address") ?? "").trim() || null;
  const thresholdRaw = parseInt(
    String(formData.get("match_threshold") ?? "65"),
    10
  );
  const match_threshold = Number.isFinite(thresholdRaw)
    ? Math.max(30, Math.min(95, thresholdRaw))
    : 65;
  const row = {
    user_id: user.id,
    email_address: email,
    on_new_connection: formData.get("on_new_connection") === "on",
    on_new_message: formData.get("on_new_message") === "on",
    on_agreement_accepted: formData.get("on_agreement_accepted") === "on",
    on_call_scheduled: formData.get("on_call_scheduled") === "on",
    on_new_match: formData.get("on_new_match") === "on",
    on_weekly_digest: formData.get("on_weekly_digest") === "on",
    match_threshold,
    updated_at: new Date().toISOString()
  };

  const service = createServiceClient();
  const { error } = await service
    .from("notification_preferences")
    .upsert(row, { onConflict: "user_id" });
  if (error) {
    console.error("[notif prefs] upsert failed", error);
    redirect("/settings/notifications?error=save");
  }

  revalidatePath("/settings/notifications");
  redirect("/settings/notifications?saved=1");
}
