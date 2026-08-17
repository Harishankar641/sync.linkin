#!/usr/bin/env node
/**
 * Stage-1 backfill: compute edit_magnitude + change_tags for every existing
 * message (and edit_delta) that has both original_draft and final_text.
 *
 * This is what makes the baseline real: the metric is computable on history
 * retroactively, so you get a per-user delta/acceptance baseline the moment
 * this runs, before any model change.
 *
 * Run AFTER applying migration 0005. Idempotent (skips rows already scored
 * unless you pass --force). Uses the service-role key (server-side only).
 *
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/backfill-edit-magnitude.mjs
 *   ... node scripts/backfill-edit-magnitude.mjs --force      # rescore all
 */
import { createClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) {
  console.error(
    "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars first."
  );
  process.exit(1);
}
const FORCE = process.argv.includes("--force");
const db = createClient(URL, KEY, { auth: { persistSession: false } });

// --- metric (kept in sync with lib/edit-magnitude.ts) ---
const HEDGE = [
  "synergies", "mutually beneficial", "explore potential", "circle back",
  "touch base", "at the end of the day", "love to", "excited to",
  "going forward", "leverage", "ecosystem", "path forward", "reach out"
];
const DAYS = /(monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|today|this week|next week)/i;
const NOT_X_ITS_Y = /\bnot .+?,?\s+it'?s\b/i;
const toks = (s) => (s || "").toLowerCase().match(/\w+|[^\w\s]/g) || [];
function lcsLen(a, b) {
  const n = a.length, m = b.length;
  if (!n || !m) return 0;
  let prev = new Array(m + 1).fill(0), curr = new Array(m + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++)
      curr[j] = a[i - 1] === b[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], curr[j - 1]);
    [prev, curr] = [curr, prev];
  }
  return prev[m];
}
function editMagnitude(draft, final) {
  const a = toks(draft), b = toks(final);
  if (!a.length && !b.length) return 0;
  return Math.round((1 - (2 * lcsLen(a, b)) / (a.length + b.length)) * 1000) / 1000;
}
const hasNumber = (s) => /\$?\d/.test(s || "");
const hedgeCount = (s) => HEDGE.reduce((n, p) => n + ((s || "").toLowerCase().includes(p) ? 1 : 0), 0);
function classifyChange(draft, final) {
  const t = [], dl = (draft || "").toLowerCase(), fl = (final || "").toLowerCase();
  if (hasNumber(final) && !hasNumber(draft)) t.push("add_number");
  if (hedgeCount(final) < hedgeCount(draft)) t.push("remove_hedging");
  if (toks(final).length <= 0.7 * toks(draft).length) t.push("shorten");
  if ((draft || "").includes("—") && !(final || "").includes("—")) t.push("remove_em_dash");
  if (DAYS.test(fl) && !DAYS.test(dl)) t.push("add_next_step");
  if (NOT_X_ITS_Y.test(dl) && !NOT_X_ITS_Y.test(fl)) t.push("remove_not_x_its_y");
  return t;
}

async function backfill(table, draftCol, finalCol) {
  let from = 0, page = 500, scored = 0;
  for (;;) {
    let q = db.from(table).select(`id, ${draftCol}, ${finalCol}, edit_magnitude`)
      .not(draftCol, "is", null).not(finalCol, "is", null)
      .order("id", { ascending: true }).range(from, from + page - 1);
    const { data, error } = await q;
    if (error) { console.error(`[${table}] read error:`, error.message); break; }
    if (!data || data.length === 0) break;
    for (const row of data) {
      if (!FORCE && row.edit_magnitude !== null && row.edit_magnitude !== undefined) continue;
      const draft = row[draftCol], final = row[finalCol];
      const { error: uErr } = await db.from(table).update({
        edit_magnitude: editMagnitude(draft, final),
        change_tags: classifyChange(draft, final)
      }).eq("id", row.id);
      if (uErr) console.error(`[${table}] update ${row.id} failed:`, uErr.message);
      else scored++;
    }
    if (data.length < page) break;
    from += page;
  }
  console.log(`[${table}] scored ${scored} row(s)`);
}

console.log(`Backfilling edit_magnitude${FORCE ? " (force rescore)" : ""}...`);
await backfill("messages", "original_draft", "final_text");
await backfill("edit_deltas", "original_draft", "edited_text");
console.log("Done. Baseline: select * from twin_edit_baseline order by scored_messages desc;");
