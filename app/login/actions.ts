"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function origin() {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    "http://localhost:3000"
  );
}

/**
 * If the login form carries an `invite` (per-person slug) or `conference`
 * (community slug), thread it through the callback's `next` param so the
 * post-auth redirect lands on `/claim/<slug>` (atomic conversation seed)
 * or `/conferences/<slug>/join` (membership upsert) instead of dashboard.
 */
function nextFromForm(formData: FormData): string {
  const inv = String(formData.get("invite") ?? "").trim().toLowerCase();
  if (inv && /^[a-z0-9-]+$/.test(inv)) {
    return `/claim/${encodeURIComponent(inv)}`;
  }
  const conf = String(formData.get("conference") ?? "").trim().toLowerCase();
  if (conf && /^[a-z0-9-]+$/.test(conf)) {
    return `/conferences/${encodeURIComponent(conf)}/join`;
  }
  return "/dashboard";
}

function callbackUrl(formData: FormData): string {
  const next = nextFromForm(formData);
  return `${origin()}/auth/callback?next=${encodeURIComponent(next)}`;
}

// ── Magic link ────────────────────────────────────────────────────────────
export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) redirect("/login?error=missing_email");

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: callbackUrl(formData) }
  });

  if (error) {
    console.error("signInWithOtp error", error);
    const detail = encodeURIComponent(
      `${error.message}${error.status ? ` (status ${error.status})` : ""}`
    );
    redirect(`/login?error=send_failed&detail=${detail}`);
  }
  redirect("/login?sent=1");
}

// ── Password sign-in ──────────────────────────────────────────────────────
export async function signInWithPassword(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) redirect("/login?error=missing_credentials");

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password
  });
  if (error) {
    const detail = encodeURIComponent(error.message);
    redirect(`/login?error=password_failed&detail=${detail}`);
  }
  redirect(nextFromForm(formData));
}

// ── Password sign-up ──────────────────────────────────────────────────────
// If Supabase has "Confirm email" on, the user still gets a confirmation
// email. Once confirmed (or if confirmation is off) they can password-login
// forever after — the redundancy that doesn't depend on magic links working.
export async function signUpWithPassword(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) redirect("/login?error=missing_credentials");
  if (password.length < 8) {
    redirect(
      `/login?error=password_failed&detail=${encodeURIComponent(
        "Password must be at least 8 characters."
      )}`
    );
  }

  const supabase = createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: callbackUrl(formData) }
  });

  // ── Existing-account recovery (task #328) ─────────────────────────────────
  // A returning user who tries "Create account" with an email that already
  // exists used to get trapped. Supabase signals the collision two different
  // ways depending on the "Confirm email" setting:
  //   1. Confirm-email OFF → signUp returns an error whose message contains
  //      "already registered". Old code dumped that raw string as a dead-end.
  //   2. Confirm-email ON (enumeration protection) → signUp returns NO error
  //      and NO session, with an obfuscated user whose `identities` array is
  //      empty. Old code said "check your inbox" for a mail that never came.
  // In BOTH cases, recover the user instead of stranding them: fire a magic
  // sign-in link to the existing address and route to a clear, actionable
  // state. (signInWithOtp delivers to existing users without leaking
  // existence, so this is safe under enumeration protection too.)
  const existsByError =
    !!error && /already (been )?registered|already exists/i.test(error.message);
  const existsBySilence =
    !error &&
    !data.session &&
    !!data.user &&
    (data.user.identities?.length ?? 0) === 0;

  if (existsByError || existsBySilence) {
    // Best-effort recovery link — ignore its result so we never dead-end.
    await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: callbackUrl(formData) }
    });
    redirect("/login?exists=1");
  }

  if (error) {
    const detail = encodeURIComponent(error.message);
    redirect(`/login?error=password_failed&detail=${detail}`);
  }
  // If a session came back immediately, email confirmation is off — go in.
  if (data.session) redirect(nextFromForm(formData));
  // Otherwise they need to confirm via email first.
  redirect("/login?sent=1");
}

// ── OAuth (Google / Apple) ────────────────────────────────────────────────
// These require the provider to be enabled in Supabase → Auth → Providers
// with OAuth credentials. The code is ready; the provider config is not.
export async function signInWithGoogle() {
  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin()}/auth/callback` }
  });
  if (error || !data.url) {
    redirect(
      `/login?error=oauth_failed&detail=${encodeURIComponent(
        error?.message ?? "Google sign-in is not configured yet."
      )}`
    );
  }
  redirect(data.url);
}

export async function signInWithApple() {
  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "apple",
    options: { redirectTo: `${origin()}/auth/callback` }
  });
  if (error || !data.url) {
    redirect(
      `/login?error=oauth_failed&detail=${encodeURIComponent(
        error?.message ?? "Apple sign-in is not configured yet."
      )}`
    );
  }
  redirect(data.url);
}

// ── Sign out ──────────────────────────────────────────────────────────────
export async function signOut() {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect("/");
}
