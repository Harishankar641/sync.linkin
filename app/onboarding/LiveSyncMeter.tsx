"use client";

import { useEffect, useRef, useState } from "react";
import { SyncMeter } from "../SyncMeter";
import { computeSyncScore, type SyncInputs } from "@/lib/sync-score";

/**
 * LiveSyncMeter — wraps SyncMeter and listens to the onboarding form's
 * input events so the silhouette fills in real time as the user adds
 * context. The more they upload, the higher the fill rises and the more
 * the power-core gradient glows. Same data-source pattern SelfGraph uses
 * (DOM form scrape + input event listener) so behavior is consistent.
 */
export function LiveSyncMeter({
  formSelector = "form",
  size = 220,
  // Activity counts come from the server (passed as props from the
  // onboarding page that fetches them). Without these, the LiveSyncMeter
  // would only see form fields — name, goals, blob — and would always
  // show a LOWER sync % than the dashboard (which counts conversations,
  // agreements, and edit-deltas). User-reported bug: "dashboard and edit
  // twin page have different % sync amounts". This closes that gap.
  completedConversations = 0,
  acceptedAgreements = 0,
  editCount = 0
}: {
  formSelector?: string;
  size?: number;
  completedConversations?: number;
  acceptedAgreements?: number;
  editCount?: number;
}) {
  const [inputs, setInputs] = useState<SyncInputs>({
    completed_conversations: completedConversations,
    accepted_agreements: acceptedAgreements,
    edit_count: editCount
  });
  // Floating "+N%" reward chips when the sync score actually rises.
  // Real numbers only: the delta is the computed score difference.
  const [chips, setChips] = useState<{ id: string; delta: number }[]>([]);
  const prevTotal = useRef<number | null>(null);
  const reduceMotion = useRef(false);
  useEffect(() => {
    reduceMotion.current =
      typeof window !== "undefined" &&
      !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  }, []);

  useEffect(() => {
    function readForm(): SyncInputs {
      if (typeof document === "undefined") return {};
      const form = document.querySelector(
        formSelector
      ) as HTMLFormElement | null;
      if (!form) return {};
      const get = (name: string): string => {
        const el = form.querySelector<HTMLInputElement | HTMLTextAreaElement>(
          `[name="${name}"]`
        );
        return el?.value ?? "";
      };
      return {
        name: get("display_name"),
        goals: get("goals"),
        deal_preferences: get("deal_preferences"),
        comm_style: get("communication_style"),
        deal_breakers: get("deal_breakers"),
        ai_export_blob: get("ai_export_blob"),
        hometown: get("hometown"),
        current_city: get("current_city"),
        // Keep the activity counts so the live total matches dashboard.
        completed_conversations: completedConversations,
        accepted_agreements: acceptedAgreements,
        edit_count: editCount
      };
    }

    const form = document.querySelector(formSelector) as HTMLFormElement | null;
    if (!form) return;
    const update = () => {
      const next = readForm();
      setInputs(next);
      const total = computeSyncScore(next).total;
      if (
        prevTotal.current !== null &&
        total > prevTotal.current &&
        !reduceMotion.current
      ) {
        const id = Math.random().toString(36).slice(2);
        const delta = total - prevTotal.current;
        setChips((c) => [...c.slice(-3), { id, delta }]);
        setTimeout(
          () => setChips((c) => c.filter((x) => x.id !== id)),
          1500
        );
      }
      prevTotal.current = total;
    };
    update();
    form.addEventListener("input", update);
    return () => form.removeEventListener("input", update);
  }, [formSelector]);

  return (
    <div
      style={{
        position: "sticky",
        top: 24,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        padding: "16px 12px",
        background:
          "radial-gradient(500px 300px at 50% 20%, rgba(58,77,255,0.08), transparent 60%), radial-gradient(400px 300px at 50% 100%, rgba(160,96,255,0.08), transparent 60%), var(--panel-solid)",
        border: "1px solid var(--border)",
        borderRadius: 16
      }}
    >
      <div
        className="retro-label"
        style={{ color: "var(--amber-bright)", marginBottom: 4 }}
      >
        clone power
      </div>
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          top: 12,
          right: 14,
          pointerEvents: "none",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end"
        }}
      >
        {chips.map((c) => (
          <div key={c.id} className="sync-chip">
            +{c.delta}%
          </div>
        ))}
      </div>
      <style>{`
        @keyframes sync-chip-rise {
          0% { opacity: 0; transform: translateY(8px) scale(0.8); }
          20% { opacity: 1; }
          100% { opacity: 0; transform: translateY(-28px) scale(1.05); }
        }
        .sync-chip {
          font-size: 12px;
          font-weight: 800;
          color: var(--green);
          text-shadow: 0 0 12px rgba(94, 229, 178, 0.6);
          animation: sync-chip-rise 1.45s ease forwards;
        }
      `}</style>
      <SyncMeter inputs={inputs} size={size} />
      <p
        className="text-xs"
        style={{
          color: "var(--text-dim)",
          textAlign: "center",
          lineHeight: 1.5,
          maxWidth: 260,
          marginTop: 4
        }}
      >
        The more you upload, the more power your twin gets to represent you.
      </p>
    </div>
  );
}
