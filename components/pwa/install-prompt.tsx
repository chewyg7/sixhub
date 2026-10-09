"use client";

import { useEffect, useState, type ReactNode } from "react";
import { EllipsisVertical, Share, SquarePlus, X } from "lucide-react";
import { LiquidGlass } from "@/components/glass/liquid-glass";
import { cn } from "@/lib/cn";

/** Chrome's install event (not in TypeScript's DOM types yet). */
interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// Captured as early as possible: Chrome fires it once, often before React mounts this component.
let deferred: InstallEvent | null = null;
const listeners = new Set<() => void>();
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as InstallEvent;
    listeners.forEach((l) => l());
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    try {
      localStorage.setItem(KEY_NEVER, "1");
    } catch {}
  });
}

const KEY_LATER = "gh:install-later";
const KEY_NEVER = "gh:install-never";
const LATER_MS = 10 * 24 * 60 * 60_000;

/** Running as the installed app (home-screen icon), not in a browser tab. */
export function isStandalone(): boolean {
  return matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function platform(): "ios" | "android" | null {
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua) || (ua.includes("Mac") && navigator.maxTouchPoints > 1)) return "ios";
  if (/Android/.test(ua)) return "android";
  return null;
}

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex items-center gap-3">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-[13px] font-bold text-white/80">{n}</span>
      <span className="flex flex-wrap items-center gap-1.5 text-[14.5px] text-white/85">{children}</span>
    </li>
  );
}

const Key = ({ children }: { children: ReactNode }) => (
  <span className="inline-flex items-center gap-1 rounded-lg bg-white/12 px-2 py-1 text-[13.5px] font-bold text-white">{children}</span>
);

/**
 * "Add GTA 6 Hub to your Home Screen". Phones only, a few seconds into the
 * first visit, never inside the installed app. iPhone/iPad gets the Share →
 * Add to Home Screen steps (Safari has no install button); Android gets a
 * one-tap Install where the browser supports it, or the menu steps.
 */
export function InstallPrompt() {
  const [show, setShow] = useState(false);
  const [os, setOs] = useState<"ios" | "android" | null>(null);
  const [canPrompt, setCanPrompt] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const p = platform();
    if (!p || isStandalone()) return;
    try {
      if (localStorage.getItem(KEY_NEVER)) return;
      const later = Number(localStorage.getItem(KEY_LATER) ?? 0);
      if (later && Date.now() - later < LATER_MS) return;
    } catch {
      return;
    }
    const sync = () => setCanPrompt(Boolean(deferred));
    listeners.add(sync);
    const t = window.setTimeout(() => {
      setOs(p);
      sync();
      setShow(true);
    }, 7000);
    return () => {
      window.clearTimeout(t);
      listeners.delete(sync);
    };
  }, []);

  const close = (remember: "later" | "never") => {
    try {
      localStorage.setItem(remember === "never" ? KEY_NEVER : KEY_LATER, remember === "never" ? "1" : String(Date.now()));
    } catch {}
    setLeaving(true);
    window.setTimeout(() => setShow(false), 380);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    deferred = null;
    close(outcome === "accepted" ? "never" : "later");
  };

  if (!show || !os) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+92px)] z-[60] flex justify-center px-3 lg:hidden">
      <LiquidGlass
        elevated
        radius={30}
        bezel={18}
        thickness={40}
        tint="rgb(20 12 26 / 0.86)"
        role="dialog"
        aria-label="Install GTA 6 Hub"
        className={cn("pointer-events-auto w-full max-w-[420px] p-5", leaving ? "animate-[install-out_380ms_ease-in_both]" : "animate-[install-in_700ms_cubic-bezier(0.34,1.4,0.64,1)_both]")}
      >
        <button type="button" onClick={() => close("later")} aria-label="Not now" className="absolute top-3 right-3 flex size-9 items-center justify-center rounded-full text-white/55 hover:bg-white/10 hover:text-white">
          <X className="size-[18px]" />
        </button>
        <div className="flex items-center gap-3.5 pr-8">
          {/* eslint-disable-next-line @next/next/no-img-element -- app icon */}
          <img src="/pwa/icon-192.png" alt="" width={56} height={56} className="size-14 rounded-[16px] shadow-[0_8px_20px_-6px_rgb(255_79_163/0.7)]" />
          <div>
            <p className="text-[17px] font-bold text-white">Get the GTA 6 Hub app</p>
            <p className="text-[13.5px] text-white/60">Full screen, one tap from your home screen.</p>
          </div>
        </div>

        {os === "ios" && (
          <ol className="mt-4 grid gap-2.5">
            <Step n={1}>
              Tap
              <Key>
                <Share className="size-4" /> Share
              </Key>
              in your browser bar
            </Step>
            <Step n={2}>
              Choose
              <Key>
                <SquarePlus className="size-4" /> Add to Home Screen
              </Key>
            </Step>
            <Step n={3}>
              Tap <Key>Add</Key>
            </Step>
          </ol>
        )}

        {os === "android" && canPrompt && (
          <button
            type="button"
            onClick={install}
            className="mt-4 flex h-12 w-full items-center justify-center rounded-2xl bg-[image:var(--sunset)] text-[16px] font-bold text-white shadow-[0_10px_30px_-10px_rgb(255_79_163/0.9)] active:scale-[0.98]"
          >
            Install app
          </button>
        )}

        {os === "android" && !canPrompt && (
          <ol className="mt-4 grid gap-2.5">
            <Step n={1}>
              Open the browser menu
              <Key>
                <EllipsisVertical className="size-4" />
              </Key>
            </Step>
            <Step n={2}>
              Tap <Key>Install app</Key> or <Key>Add to Home screen</Key>
            </Step>
          </ol>
        )}

        <button type="button" onClick={() => close("never")} className="mt-4 w-full text-center text-[13px] font-bold text-white/40 hover:text-white/70">
          Don’t show this again
        </button>
      </LiquidGlass>
    </div>
  );
}

/** Registers the service worker (production only). */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
