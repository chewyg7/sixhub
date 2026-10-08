"use client";

import Link from "next/link";
import { useEffect, useSyncExternalStore } from "react";
import { Wrench } from "lucide-react";
import { lockScroll } from "@/lib/hooks/use-focus-trap";

/** Set at sign-in to the admin panel (not a credential: it only decides who sees this screen). */
const isStaff = () => document.cookie.split("; ").some((c) => c === "gh_staff=1");
const noop = () => () => {};

/**
 * Maintenance mode. Visitors get a full-screen message; signed-in staff see
 * the site as normal with a small reminder that it's switched on.
 */
export function Maintenance({ title, message }: { title: string; message: string }) {
  const staff = useSyncExternalStore(noop, isStaff, () => false);
  useEffect(() => (staff ? undefined : lockScroll()), [staff]);

  if (staff)
    return (
      <Link
        href="/chewy/settings"
        className="fixed bottom-4 left-1/2 z-[900] flex -translate-x-1/2 items-center gap-2 rounded-full bg-[#ffb020] px-4 py-2 text-[13px] font-bold text-[#1a1200] shadow-[0_10px_30px_-10px_rgb(0_0_0/0.6)]"
      >
        <Wrench className="size-4" /> Maintenance mode is on. Visitors can’t see the site.
      </Link>
    );

  return (
    <div role="alertdialog" aria-modal="true" aria-labelledby="maint-title" className="fixed inset-0 z-[2500] flex items-center justify-center overflow-hidden bg-[#0b0910] px-6 text-center text-white">
      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_100%,rgb(255_79_163/0.28),transparent_70%)]" />
      <div className="relative max-w-xl">
        {/* eslint-disable-next-line @next/next/no-img-element -- brand mark */}
        <img src="/brand/logo-480.webp" alt="GTA 6 Hub" className="mx-auto h-16 w-auto" />
        <h1 id="maint-title" className="display-xl mt-8 text-[56px] leading-[0.95] sm:text-[84px]">
          {title}
        </h1>
        <p className="mt-5 text-[17px] leading-relaxed whitespace-pre-line text-white/70">{message}</p>
      </div>
    </div>
  );
}
