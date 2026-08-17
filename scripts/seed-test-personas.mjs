#!/usr/bin/env node
// Seed test persona twins.
//
// Usage:
//   node --env-file=.env.local scripts/seed-test-personas.mjs
//
// Safe to re-run. If a persona already exists by email it will be updated
// in place (display_name, is_test_persona flag, and twin profile).

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local"
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// Each test persona below is a fully-formed twin a real user can chat with
// to test their own twin before bringing real humans into the loop.
const personas = [
  {
    email: "sam.test@twinlink.local",
    display_name: "Sam Chen — Seed VC",
    goals:
      "Source and lead seed rounds in AI infrastructure, dev tools, and agent frameworks. Lead checks $500K–$2M with 50% reserves. Build a portfolio that helps founders win on technical merit and distribution. Make ~12 new investments per year.",
    deal_preferences:
      "Pre-seed and seed AI infra / dev tools / agent frameworks. Strong technical co-founders, ideally with prior shipped product or open-source traction. SF / NYC / remote OK. Want to lead or co-lead; will follow only on conviction founders. Standard SAFE or priced round, target 12–18% ownership.",
    communication_style:
      "Direct, substantive, asks specific questions about traction, defensibility, and team within 2 minutes. No fluff. Skeptical but engaged — will tell you exactly what would change my mind. Short paragraphs, no emoji, no jargon-as-decoration.",
    deal_breakers:
      "Won't lead rounds with no other committed capital. No solo founders unless deep technical moat. No consumer social. No crypto-only. No deals where I can't get information rights and pro rata."
  },
  {
    email: "maya.test@twinlink.local",
    display_name: "Maya Patel — Technical co-founder seeking",
    goals:
      "Find a non-technical co-founder with strong domain expertise (healthcare or legal) or distribution chops (enterprise sales) to start an applied-AI company. Bringing 10 years of ML/systems experience (ex-Anthropic, ex-Google Brain). Equity stage. Want to incorporate within 60 days of finding the right partner.",
    deal_preferences:
      "50/50 equity split between technical and business co-founder, 4-year vesting with 1-year cliff. Healthcare or legaltech preferred. Looking for someone who has sold deals or worked inside a regulated industry. SF Bay Area in-person 3 days/week minimum.",
    communication_style:
      "Thoughtful, asks probing questions about your background and why-now. Technical when needed but doesn't lead with credentials. Warm. Will share specific past projects to test for chemistry. Replies in 3–5 sentence paragraphs.",
    deal_breakers:
      "No co-founders without skin in the game (full-time, not advisory). Won't join solo-founder companies as employee #1. No B2C content/social. No remote-only co-founders. Won't ship before legal review in regulated verticals."
  },
  {
    email: "devon.test@twinlink.local",
    display_name: "Devon Ramirez — B2B Partnerships",
    goals:
      "Source 15+ integration and channel partnerships for our developer platform this year. Focus on AI/dev tool companies with 1k+ developer customers who would benefit from embedding our APIs. Drive $2M+ in partner-sourced ARR by Q4.",
    deal_preferences:
      "Revenue share (15–30%), co-marketing, or white-label integration deals. Prefer companies with active developer communities and self-serve product. Open to exclusivity for outsized commitments. 60-day pilots standard.",
    communication_style:
      "Friendly, moves to specifics fast (proposes a 30-min call within 2 messages), confident but not pushy. Uses concrete numbers. Emoji sparingly. Will share a one-pager early if I sense fit.",
    deal_breakers:
      "No competitor integrations — we have an existing exclusivity with our top vendor. No deals under $50K ACV equivalent. Won't sign NDAs to evaluate partnerships."
  },
  {
    email: "riley.test@twinlink.local",
    display_name: "Riley Kim — Engineering Recruiter",
    goals:
      "Place 8–12 senior engineers and engineering leaders per quarter at Series A–C AI startups. Equally focused on candidate-side (long-term placements) and company-side (active searches). Building a network of 200+ vetted senior+ AI engineers.",
    deal_preferences:
      "25% placement fee on first-year TC, 60-day candidate guarantee. Or monthly retainer ($15–25K) for embedded talent partner work. Open to equity in lieu of fee at early-stage if exceptional founder.",
    communication_style:
      "Quick, qualifying questions early, warm but efficient. Will ask: stage, role, comp band, remote policy, top 3 must-haves. Sends candidate profiles or role briefs as PDFs.",
    deal_breakers:
      "No companies below Series A (resource-constrained, slow hiring). No fully-remote roles where the candidate clearly prefers in-person. No contingency searches under $200K TC."
  },
  {
    email: "jordan.test@twinlink.local",
    display_name: "Jordan Brooks — Angel + advisor",
    goals:
      "Write 10–15 angel checks per year ($25K–$100K) into AI-native products I'd personally use or could see myself becoming a user of. Provide GTM and founder-coaching advice for 5–8 active founders. Maintain optionality on a future fund.",
    deal_preferences:
      "Pre-seed and seed. AI-native B2C, prosumer, or vertical SaaS. Want allocation for future rounds (1–2x my initial). Will commit within one meeting if it's a fit.",
    communication_style:
      "Storyteller, leans on my own founder backstory, asks about why-now and the founder's personal stake. Warm, asks about your family or how you spend Sundays. Long replies sometimes (5–8 sentences).",
    deal_breakers:
      "No infrastructure plays (outside my domain). No services businesses. Won't write checks bigger than $100K. Won't sign on standard SAFEs above $20M cap at pre-seed."
  }
];

console.log(`Seeding ${personas.length} test personas to ${url}…\n`);

// Pull the existing auth users once so we can find-or-create idempotently.
const { data: existing, error: listErr } = await supabase.auth.admin.listUsers({
  perPage: 1000
});
if (listErr) {
  console.error("Failed to list users:", listErr);
  process.exit(1);
}
const byEmail = new Map(existing.users.map((u) => [u.email, u]));

let created = 0,
  updated = 0,
  errors = 0;

for (const p of personas) {
  try {
    let userId;
    const found = byEmail.get(p.email);
    if (found) {
      userId = found.id;
      console.log(`  ↻  ${p.email}  (already exists, will update)`);
      updated++;
    } else {
      const { data, error } = await supabase.auth.admin.createUser({
        email: p.email,
        email_confirm: true,
        password: randomUUID() + randomUUID(), // never used; nobody logs in as them
        user_metadata: { is_test_persona: true }
      });
      if (error) throw error;
      userId = data.user.id;
      console.log(`  +  ${p.email}  (created)`);
      created++;
    }

    // The auto-profile trigger should have inserted the profile row, but
    // upsert here as a belt-and-suspenders measure in case the trigger
    // didn't fire (e.g. if you ran the seed against a project that was
    // created before the trigger existed).
    const { error: upProfileErr } = await supabase
      .from("profiles")
      .upsert(
        {
          id: userId,
          email: p.email,
          display_name: p.display_name,
          is_test_persona: true
        },
        { onConflict: "id" }
      );
    if (upProfileErr) throw upProfileErr;

    // Upsert the twin profile.
    const { error: upTwinErr } = await supabase
      .from("twin_profiles")
      .upsert(
        {
          user_id: userId,
          goals: p.goals,
          deal_preferences: p.deal_preferences,
          communication_style: p.communication_style,
          deal_breakers: p.deal_breakers,
          updated_at: new Date().toISOString()
        },
        { onConflict: "user_id" }
      );
    if (upTwinErr) throw upTwinErr;
  } catch (e) {
    errors++;
    console.error(`  ✗  ${p.email}:`, e?.message ?? e);
  }
}

console.log(
  `\nDone. ${created} created, ${updated} updated, ${errors} error(s).`
);
process.exit(errors > 0 ? 1 : 0);
