"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import {
  createClient,
  createServiceClient
} from "@/lib/supabase/server";

import { slugifyHandle } from "@/lib/handle";
import { scrapePublicProfile } from "@/lib/scrape";
import { notifyNewMatch } from "@/lib/notify";

function s(v: FormDataEntryValue | null): string | null {
  if (v === null) return null;

  const t = String(v).trim();

  return t.length > 0 ? t : null;
}

export async function saveTwin(formData: FormData) {
  const supabase = createClient();

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const display_name = s(formData.get("display_name"));
  const avatar_url = s(formData.get("avatar_url"));

  const fields: Record<string, any> = {
    user_id: user.id,

    goals: s(formData.get("goals")),

    deal_preferences: s(
      formData.get("deal_preferences")
    ),

    communication_style: s(
      formData.get("communication_style")
    ),

    deal_breakers: s(
      formData.get("deal_breakers")
    ),

    ai_export_blob: s(
      formData.get("ai_export_blob")
    ),

    hometown: s(
      formData.get("hometown")
    ),

    current_city: s(
      formData.get("current_city")
    ),

    achievements: s(
      formData.get("achievements")
    ),

    updated_at: new Date().toISOString()
  };

  /*
   * Build a single profile update.
   *
   * Only update profile columns that the user actually supplied.
   */
  const profileUpdate: Record<
    string,
    string | null
  > = {};

  if (display_name !== null) {
    profileUpdate.display_name = display_name;
  }

  if (avatar_url !== null) {
    profileUpdate.avatar_url = avatar_url;
  }

  /*
   * Auto-generate portfolio handle.
   *
   * Best-effort uniqueness. If the handle column is not
   * available yet, silently skip this part.
   */
  try {
    const { data: existing } = await supabase
      .from("profiles")
      .select("handle")
      .eq("id", user.id)
      .maybeSingle();

    if (
      !(existing as any)?.handle &&
      display_name
    ) {
      let candidate =
        slugifyHandle(display_name);

      for (
        let attempt = 0;
        attempt < 4;
        attempt++
      ) {
        const { data: collide } =
          await supabase
            .from("profiles")
            .select("id")
            .ilike("handle", candidate)
            .maybeSingle();

        if (!collide) {
          break;
        }

        candidate =
          `${slugifyHandle(
            display_name
          )}-${Math.random()
            .toString(36)
            .slice(2, 6)}`;
      }

      profileUpdate.handle = candidate;
    }
  } catch {
    /*
     * Handle column may not yet exist in production.
     * This should never block onboarding.
     */
  }

  if (
    Object.keys(profileUpdate).length > 0
  ) {
    await supabase
      .from("profiles")
      .update(profileUpdate)
      .eq("id", user.id);
  }

  /*
   * Save Twin profile.
   *
   * Includes achievements when available.
   * Falls back to the legacy field set if the
   * achievements column is not migrated yet.
   */
  const { error: upErr } =
    await supabase
      .from("twin_profiles")
      .upsert(fields, {
        onConflict: "user_id"
      });

  if (
    upErr &&
    /achievements|column|schema cache/i.test(
      upErr.message
    )
  ) {
    const {
      achievements: _drop,
      ...legacy
    } = fields;

    await supabase
      .from("twin_profiles")
      .upsert(legacy, {
        onConflict: "user_id"
      });
  }

  /*
   * Portfolio-from-LinkedIn auto-pull.
   *
   * Runs in the background so saving the Twin does not
   * block the onboarding redirect.
   */
  void (async () => {
    try {
      const service =
        createServiceClient();

      const { data: profRow } =
        await service
          .from("profiles")
          .select("portfolio_about")
          .eq("id", user.id)
          .maybeSingle();

      const alreadyHasAbout =
        (
          (profRow as any)
            ?.portfolio_about ?? ""
        )
          .toString()
          .trim()
          .length > 40;

      if (!alreadyHasAbout) {
        const blob =
          (
            fields.ai_export_blob ?? ""
          ).toString();

        const linkedInMatch =
          blob.match(
            /https?:\/\/(?:www\.)?linkedin\.com\/in\/[a-z0-9-]+\/?/i
          );

        if (linkedInMatch) {
          const scraped =
            await scrapePublicProfile(
              linkedInMatch[0]
            );

          if (
            scraped &&
            scraped.trim().length > 80
          ) {
            const aboutSeed =
              scraped
                .trim()
                .slice(0, 700);

            await service
              .from("profiles")
              .update({
                portfolio_about:
                  aboutSeed
              })
              .eq("id", user.id);
          }
        }
      }
    } catch (e) {
      console.warn(
        "[onboarding] portfolio pre-fill scrape failed",
        e
      );
    }
  })();

  /*
   * Notify existing users when this newly onboarded
   * user's Twin crosses their match threshold.
   *
   * IMPORTANT:
   * This only sends match notifications.
   *
   * It does NOT create a conversation.
   */
  void (async () => {
    try {
      await notifyNewMatch({
        newUserId: user.id
      });
    } catch (e) {
      console.warn(
        "[onboarding] notifyNewMatch failed",
        e
      );
    }
  })();

  /*
   * Revalidate pages affected by the Twin update.
   */
  revalidatePath("/dashboard");
  revalidatePath("/onboarding");

  /*
   * IMPORTANT:
   *
   * Do NOT automatically create a conversation here.
   *
   * The old implementation called:
   *
   *   pickBestFirstMatch()
   *
   * and automatically inserted a conversation.
   *
   * That polluted the real relationship graph by creating
   * relationships that the user never explicitly started.
   *
   * Conversations are now created only when the user
   * explicitly chooses "Start Conversation".
   */
  redirect("/twin?welcome=1");
}

/*
 * No automatic first-match conversation is created here.
 *
 * Relationship creation happens through the explicit
 * Start Conversation flow in:
 *
 *   startConversationWithUser()
 *
 * inside app/dashboard/actions.ts
 *
 * This keeps the Opportunity Graph based on real
 * user-created relationships.
 */
