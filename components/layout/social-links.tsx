"use client";

import { useSiteData } from "@/components/site-data";
import { cn } from "@/lib/cn";

export function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="currentColor">
      <path d="M20.32 4.37A19.8 19.8 0 0 0 15.4 2.8a13.7 13.7 0 0 0-.63 1.29 18.4 18.4 0 0 0-5.53 0A13 13 0 0 0 8.6 2.8a19.7 19.7 0 0 0-4.93 1.57C.55 9.04-.3 13.58.12 18.06a19.9 19.9 0 0 0 6.04 3.05 14.6 14.6 0 0 0 1.3-2.1 12.9 12.9 0 0 1-2.04-.98l.5-.39a14.2 14.2 0 0 0 12.16 0l.5.39c-.65.39-1.33.71-2.05.98.37.74.81 1.44 1.3 2.1a19.8 19.8 0 0 0 6.05-3.05c.5-5.19-.84-9.7-3.56-13.69ZM8.02 15.31c-1.18 0-2.15-1.09-2.15-2.42s.95-2.42 2.15-2.42 2.17 1.1 2.15 2.42c0 1.33-.95 2.42-2.15 2.42Zm7.96 0c-1.18 0-2.15-1.09-2.15-2.42s.95-2.42 2.15-2.42 2.17 1.1 2.15 2.42c0 1.33-.94 2.42-2.15 2.42Z" />
    </svg>
  );
}

export function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="currentColor">
      <path d="M18.24 2.25h3.31l-7.23 8.26 8.5 11.24h-6.66l-5.21-6.82-5.97 6.82H1.67l7.73-8.84L1.25 2.25h6.83l4.71 6.23 5.45-6.23Zm-1.16 17.52h1.83L7.08 4.13H5.12l11.96 15.64Z" />
    </svg>
  );
}

export function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="none" stroke="currentColor" strokeWidth={2}>
      <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" />
      <circle cx="12" cy="12" r="4.3" />
      <circle cx="17.6" cy="6.4" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** "@gtasixinfo" from "https://x.com/gtasixinfo". */
export function handle(url: string) {
  const last = url.replace(/\/+$/, "").split("/").pop() ?? url;
  return url.includes("discord") ? last : `@${last}`;
}

/** Discord, X and Instagram, from the owner-editable settings. */
export function SocialLinks({ className, size = "md", labels = false }: { className?: string; size?: "sm" | "md"; labels?: boolean }) {
  const { socials } = useSiteData().settings;
  const links = [
    { href: socials.discord, label: "Discord", Icon: DiscordIcon },
    { href: socials.x, label: "X", Icon: XIcon },
    { href: socials.instagram, label: "Instagram", Icon: InstagramIcon },
  ].filter((l) => l.href);
  return (
    <ul className={cn("flex flex-wrap items-center gap-2", className)}>
      {links.map(({ href, label, Icon }) => (
        <li key={label}>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${label}: ${handle(href)}`}
            data-cursor="view"
            data-cursor-label={label}
            className={cn(
              "group inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] text-white transition-[background-color,border-color,transform] duration-300 hover:-translate-y-0.5 hover:border-accent/50 hover:bg-accent/15",
              labels ? "h-11 pr-4 pl-3 text-[14px] font-bold" : size === "sm" ? "size-10 justify-center" : "size-12 justify-center",
            )}
          >
            <Icon className={cn("transition-transform duration-500 group-hover:scale-110", size === "sm" ? "size-4" : "size-5")} />
            {labels && <span>{handle(href)}</span>}
          </a>
        </li>
      ))}
    </ul>
  );
}
