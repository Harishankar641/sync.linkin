"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { notifyNewConnection } from "@/lib/notify";
import { assignConversationSlug } from "@/lib/conversationSlugServer";
import { randomUUID } from "node:crypto";

/**
 * Manually set the excitement score on a conversation. Locking it means the
 * user's judgment overrides the AI score and is kept as a calibration signal.
 */
export async function setExcitement(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const conversationId = String(formData.get("conversationId") ?? "").trim();
  const raw = Number(formData.get("score"));
  if (!conversationId || Number.isNaN(raw)) {
    redirect("/dashboard?error=bad_excitement");
  }
  const score = Math.max(0, Math.min(100, Math.round(raw)));

  const service = createServiceClient();
  const { data: conv } = await service
    .from("conversations")
    .select("participant_a, participant_b")
    .eq("id", conversationId)
    .maybeSingle();
  if (
    !conv ||
    (conv.participant_a !== user.id && conv.participant_b !== user.id)
  ) {
    redirect("/dashboard?error=forbidden");
  }

  await service
    .from("conversations")
    .update({ excitement_score: score, excitement_locked: true })
    .eq("id", conversationId);

  revalidatePath("/dashboard");
  redirect("/dashboard");
}

/**
 * Start (or open) a conversation between the current user and a test persona.
 * Test personas are seeded users with is_test_persona = true.
 */

const SAMPLE_PERSONAS = {
  jordan: {
    email: "jordan.test@twinlink.local",
    display_name: "Jordan Brooks — Angel + advisor",
    goals: "Write 10–15 angel checks per year ($25K–$100K) into AI-native products I'd personally use or could see myself becoming a user of. Provide GTM and founder-coaching advice for 5–8 active founders. Maintain optionality on a future fund.",
    deal_preferences: "Pre-seed and seed. AI-native B2C, prosumer, or vertical SaaS. Want allocation for future rounds (1–2x my initial). Will commit within one meeting if it's a fit.",
    communication_style: "Storyteller, leans on why-now and the founder's personal stake. Warm, asks about the founder and how they think. Long replies sometimes (5–8 sentences).",
    deal_breakers: "No infrastructure plays outside my domain. No services businesses. Won't write checks bigger than $100K. Won't sign on standard SAFEs above $20M cap at pre-seed."
  },
  maya: {
    email: "maya.test@twinlink.local",
    display_name: "Maya Patel — Technical co-founder seeking",
    goals: "Find a non-technical co-founder with strong domain expertise in healthcare or legal, or enterprise distribution chops, to start an applied-AI company. Bringing deep ML/systems experience and looking for an equity-stage partner.",
    deal_preferences: "50/50 equity split between technical and business co-founder, 4-year vesting with 1-year cliff. Healthcare or legaltech preferred. Looking for someone who has sold deals or worked inside a regulated industry. SF Bay Area or equivalent commitment.",
    communication_style: "Thoughtful, asks probing questions about background and why-now. Technical when needed but doesn't lead with credentials. Warm. Replies in 3–5 sentence paragraphs.",
    deal_breakers: "No co-founders without skin in the game. Won't join solo-founder companies as employee #1. No B2C content/social. Won't ship before legal review in regulated verticals."
  },
  devon: {
    email: "devon.test@twinlink.local",
    display_name: "Devon Ramirez — B2B Partnerships",
    goals: "Source 15+ integration and channel partnerships for a developer platform and drive $2M+ in partner-sourced ARR by Q4.",
    deal_preferences: "Revenue share, co-marketing, or white-label integration deals. Prefer companies with active developer communities and self-serve product. 60-day pilots standard.",
    communication_style: "Friendly, moves to specifics fast, proposes a call within a couple of messages, confident but not pushy. Uses concrete numbers.",
    deal_breakers: "No competitor integrations. No deals under $50K ACV equivalent. Won't sign NDAs just to evaluate partnerships."
  },
  riley: {
    email: "riley.test@twinlink.local",
    display_name: "Riley Kim — Engineering Recruiter",
    goals: "Place 8–12 senior engineers and engineering leaders per quarter at Series A–C AI startups while building a vetted senior AI engineering network.",
    deal_preferences: "25% placement fee on first-year total compensation, 60-day candidate guarantee, or an embedded talent-partner retainer. Open to exceptional early-stage equity arrangements.",
    communication_style: "Quick, qualifying questions early, warm but efficient. Asks stage, role, compensation band, remote policy, and top three must-haves.",
    deal_breakers: "No companies below Series A. No fully-remote roles when the candidate clearly prefers in-person. No contingency searches under $200K total compensation."
  },
  sam: {
    email: "sam.test@twinlink.local",
    display_name: "Sam Chen — Seed VC",
    goals: "Source and lead seed rounds in AI infrastructure, dev tools and agent frameworks with $500K–$2M lead checks. Build a portfolio that helps founders win on technical merit and distribution.",
    deal_preferences: "Pre-seed and seed AI infra, dev tools and agent frameworks. Strong technical co-founders and shipped product or open-source traction. SF/NYC/remote OK. Want to lead or co-lead.",
    communication_style: "Direct and substantive. Asks specific questions about traction, defensibility and team. Skeptical but engaged and will tell you exactly what would change my mind.",
    deal_breakers: "Won't lead rounds with no other committed capital. No solo founders unless there is a deep technical moat. No consumer social or crypto-only deals."
  }
} as const;

type SampleKey = keyof typeof SAMPLE_PERSONAS;

export async function startSampleConversation(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const sampleKey = String(formData.get("sampleKey") ?? "").trim() as SampleKey;
  const sample = SAMPLE_PERSONAS[sampleKey];
  if (!sample) redirect("/twin-lab?error=invalid_sample");

  const service = createServiceClient();
  let personaId: string | null = null;

  const { data: existingProfile } = await service
    .from("profiles")
    .select("id, is_test_persona")
    .eq("email", sample.email)
    .maybeSingle();

  if (existingProfile?.id) {
    personaId = existingProfile.id;
    if (!existingProfile.is_test_persona) {
      redirect("/twin-lab?error=sample_conflict");
    }
  } else {
    const { data: created, error: createError } = await service.auth.admin.createUser({
      email: sample.email,
      email_confirm: true,
      password: randomUUID() + randomUUID(),
      user_metadata: { is_test_persona: true }
    });
    if (createError || !created.user) {
      console.error("sample persona create failed", createError);
      redirect("/twin-lab?error=sample_seed_failed");
    }
    personaId = created.user.id;
  }

  if (!personaId) redirect("/twin-lab?error=sample_seed_failed");
  const samplePersonaId = personaId;

  const { error: profileError } = await service.from("profiles").upsert({
    id: samplePersonaId,
    email: sample.email,
    display_name: sample.display_name,
    is_test_persona: true
  }, { onConflict: "id" });
  if (profileError) {
    console.error("sample persona profile upsert failed", profileError);
    redirect("/twin-lab?error=sample_seed_failed");
  }

  const { error: twinError } = await service.from("twin_profiles").upsert({
    user_id: samplePersonaId,
    goals: sample.goals,
    deal_preferences: sample.deal_preferences,
    communication_style: sample.communication_style,
    deal_breakers: sample.deal_breakers,
    updated_at: new Date().toISOString()
  }, { onConflict: "user_id" });
  if (twinError) {
    console.error("sample persona twin upsert failed", twinError);
    redirect("/twin-lab?error=sample_seed_failed");
  }

  const { data: existingConversation } = await supabase
    .from("conversations")
    .select("id")
    .or(`and(participant_a.eq.${user.id},participant_b.eq.${samplePersonaId}),and(participant_a.eq.${samplePersonaId},participant_b.eq.${user.id})`)
    .maybeSingle();
  if (existingConversation) redirect(`/conversations/${existingConversation.id}?autostart=1`);

  const { data: conv, error: conversationError } = await supabase
    .from("conversations")
    .insert({ participant_a: user.id, participant_b: samplePersonaId })
    .select("id")
    .single();
  if (conversationError || !conv) {
    console.error("sample conversation insert failed", conversationError);
    redirect("/twin-lab?error=create_failed");
  }
  assignConversationSlug(conv.id as string).catch(() => {});
  redirect(`/conversations/${conv.id}?autostart=1`);
}

export async function startTestConversation(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const personaId = String(formData.get("personaId") ?? "").trim();
  if (!personaId) redirect("/dashboard?error=missing_persona");

  const service = createServiceClient();
  const { data: persona } = await service
    .from("profiles")
    .select("id, is_test_persona")
    .eq("id", personaId)
    .maybeSingle();
  if (!persona?.is_test_persona) {
    redirect("/dashboard?error=invalid_persona");
  }

  // Reuse existing conversation if one already exists.
  const { data: existing } = await supabase
    .from("conversations")
    .select("id")
    .or(
      `and(participant_a.eq.${user.id},participant_b.eq.${personaId}),and(participant_a.eq.${personaId},participant_b.eq.${user.id})`
    )
    .maybeSingle();
  if (existing) redirect(`/conversations/${existing.id}?autostart=1`);

  const { data: conv, error } = await supabase
    .from("conversations")
    .insert({ participant_a: user.id, participant_b: personaId })
    .select("id")
    .single();
  if (error || !conv) {
    console.error("test conversation insert failed", error);
    redirect("/dashboard?error=create_failed");
  }
  // #69 — fire-and-forget short-slug assignment so /c/<slug> works.
  assignConversationSlug(conv.id as string).catch(() => {});
  redirect(`/conversations/${conv.id}?autostart=1`);
}

/**
 * Start (or open) a conversation between the current user and another real
 * SyncedIn user, picked from the directory on the dashboard.
 */
export async function startConversationWithUser(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const otherId = String(formData.get("userId") ?? "").trim();
  if (!otherId) redirect("/dashboard?error=missing_user");
  if (otherId === user.id) redirect("/dashboard?error=self");

  const service = createServiceClient();
  const { data: other } = await service
    .from("profiles")
    .select("id")
    .eq("id", otherId)
    .maybeSingle();
  if (!other) redirect("/dashboard?error=user_not_found");

  // Reuse existing conversation if one already exists.
  const { data: existing } = await supabase
    .from("conversations")
    .select("id")
    .or(
      `and(participant_a.eq.${user.id},participant_b.eq.${otherId}),and(participant_a.eq.${otherId},participant_b.eq.${user.id})`
    )
    .maybeSingle();
  if (existing) redirect(`/conversations/${existing.id}`);

  const { data: conv, error } = await supabase
    .from("conversations")
    .insert({ participant_a: user.id, participant_b: otherId })
    .select("id")
    .single();
  if (error || !conv) {
    console.error("conversation insert failed", error);
    redirect("/dashboard?error=create_failed");
  }
  // #69 — short-slug for /c/<slug>.
  assignConversationSlug(conv.id as string).catch(() => {});
  // Fire-and-forget notification to both participants.
  notifyNewConnection({
    conversationId: conv.id,
    participantA: user.id,
    participantB: otherId
  }).catch((e) => console.warn("[start-conv] notify failed", e));
  redirect(`/conversations/${conv.id}`);
}
