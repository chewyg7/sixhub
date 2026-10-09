"use client";

import Link from "next/link";
import { useState, type CSSProperties, type ReactNode } from "react";
import {
  ArrowUpRight,
  BadgeCheck,
  CalendarDays,
  Check,
  Copy,
  Code2,
  Globe,
  Images,
  Link2,
  MapPin,
  Music2,
  Pin,
  Share2,
  Play,
  Tv,
} from "lucide-react";
import type { MediaItem } from "@/types/content";
import type { ButtonStyle, ProfileSettings, ProfileTheme } from "@/lib/profiles";
import { cn } from "@/lib/cn";
import { DiscordIcon, InstagramIcon, XIcon } from "@/components/layout/social-links";
import { MediaGrid } from "@/components/media/media-grid";

export interface ProfileUser {
  username: string;
  displayName: string;
  role: "owner" | "admin";
  avatarUrl: string | null;
  bio: string;
  links: { discord?: string; x?: string; instagram?: string; website?: string };
  createdAt: number;
}

/** Background per theme, tinted with the member's accent hue. */
function themeBackground(theme: ProfileTheme, h: number): string {
  switch (theme) {
    case "sunset":
      return `radial-gradient(80% 60% at 50% 0%, hsl(${h} 90% 55% / 0.35), transparent 70%), radial-gradient(70% 50% at 100% 100%, hsl(${(h + 40) % 360} 95% 60% / 0.22), transparent 70%), #120a14`;
    case "midnight":
      return `radial-gradient(60% 45% at 50% 0%, hsl(${h} 80% 50% / 0.18), transparent 70%), linear-gradient(180deg, #0a0c1c, #07070d)`;
    case "mono":
      return "linear-gradient(180deg, #121214, #0a0a0b)";
    default:
      return `radial-gradient(70% 55% at 15% 10%, hsl(${h} 90% 55% / 0.28), transparent 70%), radial-gradient(60% 50% at 90% 30%, hsl(${(h + 60) % 360} 90% 60% / 0.2), transparent 70%), radial-gradient(70% 60% at 50% 100%, hsl(${(h + 300) % 360} 80% 50% / 0.16), transparent 70%), #0d0912`;
  }
}

/** An icon for a link, guessed from its address. */
function linkIcon(url: string, className: string): ReactNode {
  const host = (() => {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return "";
    }
  })();
  if (/youtube\.com|youtu\.be/.test(host)) return <Play className={className} />;
  if (/twitch\.tv|kick\.com/.test(host)) return <Tv className={className} />;
  if (/github\.com/.test(host)) return <Code2 className={className} />;
  if (/spotify\.com|soundcloud\.com|music\.apple\.com|tiktok\.com/.test(host)) return <Music2 className={className} />;
  if (/x\.com|twitter\.com/.test(host)) return <XIcon className={className} />;
  if (/instagram\.com/.test(host)) return <InstagramIcon className={className} />;
  if (/discord\.(gg|com)/.test(host)) return <DiscordIcon className={className} />;
  if (/gtasixhub\.com/.test(host) || url.startsWith("/")) return <Link2 className={className} />;
  return <Globe className={className} />;
}

function LinkButton({ link, style, featured }: { link: { label: string; url: string }; style: ButtonStyle; featured?: boolean }) {
  const external = !link.url.startsWith("/");
  return (
    <a
      href={link.url}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      data-cursor="link"
      className={cn(
        "group relative flex items-center gap-3 overflow-hidden rounded-2xl px-4 transition-[transform,background-color,border-color,box-shadow] duration-300 hover:-translate-y-0.5 active:scale-[0.98]",
        featured ? "h-[68px] text-[17px]" : "h-14 text-[15.5px]",
        featured
          ? "bg-[image:var(--p-gradient)] font-bold text-white shadow-[0_14px_40px_-14px_var(--p-accent)]"
          : style === "solid"
            ? "bg-white font-bold text-[#140c18] hover:shadow-[0_10px_30px_-12px_var(--p-accent)]"
            : style === "outline"
              ? "border-2 border-white/25 font-bold text-white hover:border-[color:var(--p-accent)]"
              : "border border-white/12 bg-white/[0.07] font-bold text-white backdrop-blur-xl hover:border-white/25 hover:bg-white/[0.11]",
      )}
    >
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", featured ? "bg-white/20" : style === "solid" ? "bg-black/[0.06]" : "bg-white/10")}>
        {linkIcon(link.url, "size-[18px]")}
      </span>
      <span className="min-w-0 flex-1 truncate text-center">{link.label}</span>
      <ArrowUpRight className="size-4 shrink-0 opacity-50 transition-[transform,opacity] duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100" />
    </a>
  );
}

function Social({ href, label, children, onClick }: { href?: string; label: string; children: ReactNode; onClick?: () => void }) {
  const cls = "flex size-11 items-center justify-center rounded-full border border-white/12 bg-white/[0.06] text-white/85 transition-[transform,background-color,color] duration-300 hover:-translate-y-0.5 hover:bg-white/12 hover:text-white";
  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label} title={label} className={cls}>
      {children}
    </a>
  ) : (
    <button type="button" onClick={onClick} aria-label={label} title={label} className={cls}>
      {children}
    </button>
  );
}

/**
 * A team member's public page: cover art, avatar and bio, then two tabs.
 * "Links" is a link-in-bio list; "Contributions" is everything they've added
 * to the archive (pinned items first).
 */
export function ProfileView({ user, profile, bannerUrl, uploads, pinned }: { user: ProfileUser; profile: ProfileSettings; bannerUrl: string | null; uploads: MediaItem[]; pinned: MediaItem[] }) {
  const [tab, setTab] = useState<"links" | "contributions">("links");
  const [copied, setCopied] = useState<string | null>(null);
  const h = profile.accentHue;
  const vars = {
    "--p-accent": `hsl(${h} 95% 62%)`,
    "--p-gradient": `linear-gradient(110deg, hsl(${h} 92% 58%), hsl(${(h + 35) % 360} 95% 62%))`,
  } as CSSProperties;
  const joined = new Date(user.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const featured = profile.links.filter((l) => l.featured);
  const rest = profile.links.filter((l) => !l.featured);
  const rest_pinned = uploads.filter((m) => !pinned.some((p) => p.slug === m.slug));
  const images = uploads.filter((m) => m.kind === "image").length;
  const videos = uploads.filter((m) => m.kind === "video").length;

  const copy = (text: string, what: string) => navigator.clipboard.writeText(text).then(() => {
    setCopied(what);
    window.setTimeout(() => setCopied(null), 1600);
  });
  const share = async () => {
    const url = `${location.origin}/@${user.username}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: `${user.displayName} · GTA 6 Hub`, url });
        return;
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
      }
    }
    copy(url, "link");
  };

  return (
    <div style={vars} className="relative -mt-[env(safe-area-inset-top)] min-h-[100svh] lg:-mt-28">
      <div aria-hidden className="absolute inset-0 -z-10" style={{ background: themeBackground(profile.theme, h) }} />

      {/* Cover */}
      <div className="relative h-[230px] overflow-hidden sm:h-[300px] lg:h-[360px]">
        {bannerUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- cover art from the archive
          <img src={bannerUrl} alt="" className="size-full object-cover" />
        ) : (
          <div className="size-full" style={{ background: `linear-gradient(135deg, hsl(${h} 80% 35%), hsl(${(h + 50) % 360} 85% 45%) 55%, hsl(${(h + 300) % 360} 70% 25%))` }} />
        )}
        <div aria-hidden className="absolute inset-0 bg-[linear-gradient(to_bottom,rgb(0_0_0/0.15),transparent_40%,rgb(10_7_14/0.9))]" />
      </div>

      <div className="relative mx-auto -mt-20 max-w-[620px] px-5 pb-16 sm:-mt-24">
        {/* Identity */}
        <div className="flex flex-col items-center text-center">
          <div className="relative">
            <span aria-hidden className="absolute -inset-3 rounded-full opacity-70 blur-2xl" style={{ background: "var(--p-gradient)" }} />
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- profile photo
              <img src={user.avatarUrl} alt="" width={136} height={136} className="relative size-[120px] rounded-full object-cover ring-4 ring-[#0d0912] sm:size-[136px]" />
            ) : (
              <span className="relative flex size-[120px] items-center justify-center rounded-full text-[48px] font-bold text-white ring-4 ring-[#0d0912] sm:size-[136px]" style={{ background: "var(--p-gradient)" }}>
                {user.displayName.slice(0, 1).toUpperCase()}
              </span>
            )}
          </div>
          <h1 className="display-xl mt-5 flex items-center gap-2 text-[44px] leading-[0.95] sm:text-[56px]">
            {user.displayName}
            <BadgeCheck className="size-7 shrink-0" style={{ color: "var(--p-accent)" }} aria-label="GTA 6 Hub team" />
          </h1>
          <p className="mt-2 flex flex-wrap items-center justify-center gap-x-2 text-[14.5px] text-white/60">
            <span>@{user.username}</span>
            <span className="rounded-full px-2.5 py-0.5 text-[12px] font-bold text-white" style={{ background: "var(--p-gradient)" }}>
              {user.role === "owner" ? "Owner" : "Team"}
            </span>
            {profile.pronouns && <span>· {profile.pronouns}</span>}
          </p>
          {profile.headline && <p className="mt-3 text-[17px] font-bold text-white/90">{profile.headline}</p>}
          {user.bio && <p className="mt-3 max-w-md text-[15.5px] leading-relaxed whitespace-pre-line text-white/70">{user.bio}</p>}
          <p className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[13px] text-white/45">
            {profile.location && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5" /> {profile.location}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="size-3.5" /> Joined {joined}
            </span>
          </p>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            {user.links.x && (
              <Social href={user.links.x} label="X">
                <XIcon className="size-[18px]" />
              </Social>
            )}
            {user.links.instagram && (
              <Social href={user.links.instagram} label="Instagram">
                <InstagramIcon className="size-[18px]" />
              </Social>
            )}
            {user.links.discord && (
              <Social label={`Discord: ${user.links.discord} (click to copy)`} onClick={() => copy(user.links.discord!, "discord")}>
                {copied === "discord" ? <Check className="size-[18px]" /> : <DiscordIcon className="size-[18px]" />}
              </Social>
            )}
            {user.links.website && (
              <Social href={user.links.website} label="Website">
                <Globe className="size-[18px]" />
              </Social>
            )}
            <Social label="Share profile" onClick={share}>
              {copied === "link" ? <Check className="size-[18px]" /> : <Share2 className="size-[18px]" />}
            </Social>
          </div>
        </div>

        {/* Tabs */}
        {profile.showContributions && (
          <div role="tablist" aria-label="Profile" className="relative mx-auto mt-8 grid w-full max-w-[360px] grid-cols-2 rounded-full border border-white/10 bg-white/[0.05] p-1 backdrop-blur-xl">
            <span
              aria-hidden
              className={cn("absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-full transition-transform duration-500 ease-[cubic-bezier(0.34,1.3,0.64,1)]", tab === "contributions" && "translate-x-full")}
              style={{ background: "var(--p-gradient)" }}
            />
            {(
              [
                ["links", "Links", Link2],
                ["contributions", `Contributions${uploads.length ? ` · ${uploads.length}` : ""}`, Images],
              ] as const
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={cn("relative z-10 flex h-11 items-center justify-center gap-2 rounded-full text-[14px] font-bold transition-colors", tab === id ? "text-white" : "text-white/60 hover:text-white")}
              >
                <Icon className="size-4" /> {label}
              </button>
            ))}
          </div>
        )}

        {/* Links */}
        {tab === "links" && (
          <div key="links" className="mt-6 grid animate-fade-in gap-3">
            {featured.map((l) => (
              <LinkButton key={l.id} link={l} style={profile.buttonStyle} featured />
            ))}
            {rest.map((l) => (
              <LinkButton key={l.id} link={l} style={profile.buttonStyle} />
            ))}
            {profile.links.length === 0 && <p className="py-6 text-center text-[14px] text-white/40">No links yet.</p>}
          </div>
        )}
      </div>

      {/* Contributions: wider than the link column */}
      {tab === "contributions" && profile.showContributions && (
        <div key="contrib" className="relative mx-auto -mt-10 max-w-[1240px] animate-fade-in px-5 pb-20">
          <div className="mx-auto mb-8 grid max-w-[620px] grid-cols-3 gap-3">
            {[
              ["Added", uploads.length],
              ["Images", images],
              ["Videos", videos],
            ].map(([label, n]) => (
              <div key={label as string} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-center backdrop-blur-xl">
                <span className="display-xl block text-[34px] leading-none">{n}</span>
                <span className="mt-1 block text-[12.5px] text-white/50">{label}</span>
              </div>
            ))}
          </div>
          {pinned.length > 0 && (
            <section className="mb-10">
              <h2 className="mb-4 flex items-center gap-2 text-[15px] font-bold text-white/80">
                <Pin className="size-4" style={{ color: "var(--p-accent)" }} /> Pinned
              </h2>
              <MediaGrid items={pinned} columns={3} />
            </section>
          )}
          {rest_pinned.length > 0 ? (
            <MediaGrid items={rest_pinned} columns={4} />
          ) : (
            pinned.length === 0 && <p className="py-10 text-center text-[14px] text-white/40">Nothing added to the archive yet.</p>
          )}
        </div>
      )}

      <div className="mx-auto max-w-[620px] px-5 pb-12 text-center">
        <Link href="/team" className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-[13px] text-white/55 transition-colors hover:text-white">
          <BadgeCheck className="size-4" style={{ color: "var(--p-accent)" }} /> Part of the GTA 6 Hub team <ArrowUpRight className="size-3.5" />
        </Link>
        <button type="button" onClick={() => copy(`${location.origin}/@${user.username}`, "link2")} className="mt-3 flex w-full items-center justify-center gap-1.5 text-[12.5px] text-white/35 hover:text-white/70">
          {copied === "link2" ? <Check className="size-3.5" /> : <Copy className="size-3.5" />} gtasixhub.com/@{user.username}
        </button>
      </div>
    </div>
  );
}
