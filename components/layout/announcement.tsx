"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { ArrowUpRight, X } from "lucide-react";
import { useSiteData } from "@/components/site-data";

const KEY = "gh:announcement-dismissed";
const noop = () => () => {};
const readDismissed = () => {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
};

/** The owner's announcement as a pill under the header. Dismissal lasts the session and resets when the text changes. */
export function Announcement() {
  const { announcement } = useSiteData().settings;
  const dismissedText = useSyncExternalStore(noop, readDismissed, () => null);
  const [closed, setClosed] = useState(false);
  if (!announcement.enabled || !announcement.text || closed || dismissedText === announcement.text) return null;

  const external = /^https?:\/\//.test(announcement.href);
  const body = (
    <>
      <span className="size-1.5 shrink-0 animate-pulse rounded-full bg-accent" />
      <span className="truncate">{announcement.text}</span>
      {announcement.href && <ArrowUpRight className="size-4 shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />}
    </>
  );
  const cls = "group flex min-w-0 items-center gap-2.5 py-2 pl-4 text-[13.5px] font-bold text-white";

  return (
    <div className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+12px)] z-40 flex justify-center px-4 lg:top-[104px]">
      <div className="pointer-events-auto flex max-w-[min(640px,100%)] animate-fade-in items-center rounded-full border border-white/12 bg-[#140c1c]/70 shadow-[0_16px_40px_-16px_rgb(0_0_0/0.8)] backdrop-blur-xl">
        {announcement.href ? (
          external ? (
            <a href={announcement.href} target="_blank" rel="noopener noreferrer" className={cls}>
              {body}
            </a>
          ) : (
            <Link href={announcement.href} className={cls}>
              {body}
            </Link>
          )
        ) : (
          <span className={cls}>{body}</span>
        )}
        <button
          type="button"
          aria-label="Dismiss announcement"
          onClick={() => {
            try {
              sessionStorage.setItem(KEY, announcement.text);
            } catch {}
            setClosed(true);
          }}
          className="mr-1 ml-1 flex size-8 shrink-0 items-center justify-center rounded-full text-white/55 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
