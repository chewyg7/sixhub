"use client";

import { useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";

const tick = (cb: () => void) => {
  const id = window.setInterval(cb, 1000);
  return () => window.clearInterval(id);
};

/** Seconds until local midnight on `date` (YYYY-MM-DD). Null on the server. */
function useRemaining(date: string) {
  return useSyncExternalStore(
    tick,
    () => Math.max(0, Math.floor((new Date(`${date}T00:00:00`).getTime() - Date.now()) / 1000)),
    () => null,
  );
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Live release countdown. Placeholders on the server, then ticks every second. */
export function Countdown({ date, className, size = "lg" }: { date: string; className?: string; size?: "lg" | "sm" }) {
  const s = useRemaining(date);
  const values = s === null ? null : [Math.floor(s / 86400), Math.floor((s % 86400) / 3600), Math.floor((s % 3600) / 60), s % 60];
  const labels = ["Days", "Hours", "Minutes", "Seconds"];

  if (s === 0) return <p className={cn("display-xl text-hot text-[48px]", className)}>Out now</p>;

  return (
    <div
      className={cn("flex items-stretch", className)}
      role="timer"
      aria-label={values ? `${values[0]} days, ${values[1]} hours and ${values[2]} minutes until release` : "Release countdown"}
    >
      {labels.map((label, i) => (
        <div key={label} className={cn("flex flex-col items-center", i > 0 && "border-l border-white/15", size === "lg" ? "px-4 sm:px-7" : "px-3 sm:px-4")}>
          <span
            aria-hidden
            suppressHydrationWarning
            className={cn("display-xl tabular text-white", size === "lg" ? "min-w-[2ch] text-center text-[46px] sm:text-[64px]" : "min-w-[2ch] text-center text-[34px]")}
          >
            {values ? (i === 0 ? values[i] : pad(values[i])) : "--"}
          </span>
          <span className={cn("mt-1 text-white/55", size === "lg" ? "text-[13px]" : "text-[11.5px]")}>{label}</span>
        </div>
      ))}
    </div>
  );
}
