"use client";

import { useState, useSyncExternalStore } from "react";
import { ShieldAlert } from "lucide-react";
import { cn } from "@/lib/cn";

/** A repo's icon, or the first letter of its name when it has none (or it won't load). */
export function RepoIcon({ name, icon, size = 56, className }: { name: string; icon?: string; size?: number; className?: string }) {
  const [broken, setBroken] = useState(false);
  const style = { width: size, height: size, borderRadius: size * 0.28 };
  if (icon && !broken)
    return (
      // eslint-disable-next-line @next/next/no-img-element -- third-party image, loaded straight from the repo's host
      <img src={icon} alt="" referrerPolicy="no-referrer" onError={() => setBroken(true)} className={cn("shrink-0 bg-white/[0.06] object-cover", className)} style={style} />
    );
  // A colour per name, so letter icons are told apart at a glance.
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
  return (
    <span
      aria-hidden
      className={cn("flex shrink-0 items-center justify-center font-bold text-white", className)}
      style={{ ...style, fontSize: size * 0.44, background: `linear-gradient(135deg, hsl(${h} 75% 52%), hsl(${(h + 45) % 360} 85% 58%))` }}
    >
      {(name.trim()[0] ?? "?").toUpperCase()}
    </span>
  );
}

/** The standing reminder on every repo page. */
export function RepoWarning({ host, className }: { host?: string; className?: string }) {
  return (
    <div className={cn("flex gap-3 rounded-2xl border border-[#ffb84d]/20 bg-[#ffb84d]/[0.07] px-4 py-3 text-[13.5px] leading-relaxed text-[#ffe2b3]", className)}>
      <ShieldAlert className="mt-0.5 size-4 shrink-0 text-[#ffb84d]" />
      <p>
        <strong className="text-[#ffd699]">Nothing here is hosted on GTA 6 Hub.</strong> Repos are made by other people
        {host ? (
          <>
            ; this one lives on <strong className="text-[#ffd699]">{host}</strong>, and its media loads straight from the links inside it
          </>
        ) : (
          ", and their media loads straight from the links inside them"
        )}
        . We don’t store, check or vouch for any of it. Be cautious and only use repos from people you trust.
      </p>
    </div>
  );
}

export const hostOf = (url: string) => {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
};

const noop = () => () => {};
/** False during the server render and hydration, true after: repos live only in this browser. */
export const useHydrated = () => useSyncExternalStore(noop, () => true, () => false);

/** Phones get the share sheet; computers get the link copied. Resolves to what happened. */
export async function shareRepoLink(link: string, name: string): Promise<"shared" | "copied" | "failed"> {
  if (matchMedia("(pointer: coarse)").matches && navigator.share) {
    try {
      await navigator.share({ title: name, url: link });
      return "shared";
    } catch (e) {
      if ((e as Error).name === "AbortError") return "failed";
    }
  }
  try {
    await navigator.clipboard.writeText(link);
    return "copied";
  } catch {
    return "failed";
  }
}
