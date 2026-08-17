"use client";

import { useEffect } from "react";

/**
 * TypingParticles — every time the user presses a character key inside any
 * input / textarea on the onboarding form, spawn a small glowing dot at
 * the input's caret edge and animate it across the page toward the
 * SyncMeter on the right rail. Conveys "your typing is feeding the twin."
 *
 * Implementation: no React state per particle (would re-render the whole
 * form on every keystroke). We mount one fixed-position container
 * absolutely positioned at the body, listen to `input` events globally,
 * and use raw DOM nodes + CSS animations. Each particle removes itself
 * onanimationend.
 *
 * Mounted by OnboardingPage so it sees the form and the right-rail
 * SyncMeter without prop drilling.
 */
export function TypingParticles() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      // Respect reduced-motion preference — skip the effect entirely.
      return;
    }

    // Inject the keyframes + base style once.
    const STYLE_ID = "syncedin-typing-particles-style";
    if (!document.getElementById(STYLE_ID)) {
      const s = document.createElement("style");
      s.id = STYLE_ID;
      s.textContent = `
        @keyframes syncedin-particle-fly {
          0%   { transform: translate(0, 0) scale(0.6); opacity: 0; }
          15%  { opacity: 1; }
          70%  { opacity: 0.8; }
          100% { transform: translate(var(--dx, 400px), var(--dy, -40px)) scale(0.2); opacity: 0; }
        }
        .syncedin-particle {
          position: fixed;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          pointer-events: none;
          z-index: 70;
          background: radial-gradient(circle, #d83bff 0%, #6b2dc9 50%, transparent 80%);
          box-shadow: 0 0 8px 2px rgba(216,59,255,0.7);
          animation: syncedin-particle-fly 850ms cubic-bezier(0.25, 0.7, 0.3, 1) forwards;
        }
      `;
      document.head.appendChild(s);
    }

    // Throttle: at most one particle per ~40ms so a long key-mash doesn't
    // spawn hundreds of nodes per second.
    let lastSpawnAt = 0;

    function findSyncTarget(): { x: number; y: number } | null {
      // Try the LiveSyncMeter wrapper first (has data-sync-meter), then
      // any svg labeled as sync, then a sensible default in the top-right
      // of the viewport.
      const el =
        document.querySelector<HTMLElement>("[data-sync-meter]") ||
        document.querySelector<HTMLElement>("[aria-label='Sync meter']") ||
        document.querySelector<HTMLElement>(".syncedin-sync-meter");
      if (el) {
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      }
      // Fallback: aim at top-right of viewport, where the LiveSyncMeter
      // lives in the standard onboarding layout.
      return {
        x: window.innerWidth - 180,
        y: 280
      };
    }

    function spawnAt(originX: number, originY: number) {
      const now = performance.now();
      if (now - lastSpawnAt < 40) return;
      lastSpawnAt = now;
      const target = findSyncTarget();
      if (!target) return;
      const dx = target.x - originX;
      const dy = target.y - originY;
      const node = document.createElement("span");
      node.className = "syncedin-particle";
      node.style.left = `${originX}px`;
      node.style.top = `${originY}px`;
      // Slight randomness so a stream of particles fans out a bit.
      const jx = (Math.random() - 0.5) * 30;
      const jy = (Math.random() - 0.5) * 30;
      node.style.setProperty("--dx", `${dx + jx}px`);
      node.style.setProperty("--dy", `${dy + jy}px`);
      document.body.appendChild(node);
      node.addEventListener(
        "animationend",
        () => {
          node.remove();
        },
        { once: true }
      );
    }

    function onInput(e: Event) {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      // Only fire on inputs/textareas inside the onboarding form to scope
      // the effect (avoid firing on global search inputs elsewhere).
      const form = target.closest("#onboarding-form");
      if (!form) return;
      const tag = (target as HTMLElement).tagName;
      if (tag !== "INPUT" && tag !== "TEXTAREA") return;
      // Spawn at the input's right edge — close enough to "where the
      // caret is" without measuring the actual caret position.
      const rect = (target as HTMLElement).getBoundingClientRect();
      const x = Math.min(rect.right - 12, rect.left + 200);
      const y = rect.top + Math.min(rect.height / 2, 28);
      spawnAt(x, y);
    }

    document.addEventListener("input", onInput, { passive: true });
    return () => {
      document.removeEventListener("input", onInput);
    };
  }, []);

  return null;
}
