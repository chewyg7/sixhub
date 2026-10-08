"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

/**
 * One digit in a slot. When it changes, the old digit slides out and the new
 * one springs in from the other side; `direction` picks which way it rolls.
 * The outgoing digit is removed when its animation ends (or after a short
 * timeout), so digits can never pile up; with reduced motion it is hidden.
 */
function Digit({ d, direction }: { d: string; direction: "down" | "up" }) {
  // Derive the previous digit during render (no effect): a change bumps `n`, which re-keys both layers and replays the animation.
  const [state, setState] = useState({ cur: d, prev: null as string | null, n: 0 });
  if (state.cur !== d) setState({ cur: d, prev: state.cur, n: state.n + 1 });
  const n = state.n;
  const hasPrev = state.prev !== null;
  // Fallback for when the animation never runs or never ends (background tab, animations off).
  useEffect(() => {
    if (!hasPrev) return;
    const t = window.setTimeout(() => setState((s) => (s.n === n ? { ...s, prev: null } : s)), 650);
    return () => window.clearTimeout(t);
  }, [n, hasPrev]);
  return (
    <span className={cn("roll-digit", direction === "up" && "roll-up")}>
      {state.prev !== null && (
        <span key={`out-${n}`} aria-hidden className="roll-out" onAnimationEnd={() => setState((s) => (s.n === n ? { ...s, prev: null } : s))}>
          {state.prev}
        </span>
      )}
      <span key={`in-${n}`} className={n ? "roll-in" : undefined}>
        {state.cur}
      </span>
    </span>
  );
}

/** A number whose digits roll individually, like a mechanical counter. */
export function RollingNumber({ value, pad = 1, direction = "down", className }: { value: number; pad?: number; direction?: "down" | "up"; className?: string }) {
  const text = String(Math.max(0, Math.floor(value))).padStart(pad, "0");
  return (
    <span className={cn("inline-flex", className)} aria-label={String(value)}>
      {/* Keyed from the right so the ones digit keeps its identity when the number gains a digit. */}
      {[...text].map((ch, i) => (
        <Digit key={text.length - i} d={ch} direction={direction} />
      ))}
    </span>
  );
}
