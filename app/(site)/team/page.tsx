import type { Metadata } from "next";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { ArrowUpRight, BadgeCheck, Globe, Heart } from "lucide-react";
import { Container } from "@/components/layout/page";
import { Stagger } from "@/components/motion/reveal";
import { DiscordIcon, InstagramIcon, XIcon } from "@/components/layout/social-links";
import { getMediaBySlugs, getSettings } from "@/lib/content";
import { smallestVariant } from "@/lib/media/variants";
import { getTeamMembers, type TeamMember } from "@/lib/profiles";
import { cn } from "@/lib/cn";

// Edited from the admin panel at any time; always render fresh.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Team",
  description: "Meet the people behind GTA 6 Hub.",
  alternates: { canonical: "/team" },
};

function Socials({ m }: { m: TeamMember }) {
  const l = m.user.links;
  const items = [
    l.x && { href: l.x, label: "X", icon: <XIcon className="size-4" /> },
    l.instagram && { href: l.instagram, label: "Instagram", icon: <InstagramIcon className="size-4" /> },
    l.website && { href: l.website, label: "Website", icon: <Globe className="size-4" /> },
  ].filter(Boolean) as { href: string; label: string; icon: ReactNode }[];
  if (!items.length && !l.discord) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {items.map((i) => (
        <a
          key={i.label}
          href={i.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${m.user.displayName} on ${i.label}`}
          className="flex size-9 items-center justify-center rounded-full bg-white/[0.07] text-white/75 transition-colors hover:bg-white/15 hover:text-white"
        >
          {i.icon}
        </a>
      ))}
      {l.discord && (
        <span title="Discord" className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white/[0.07] px-3 text-[12.5px] text-white/70">
          <DiscordIcon className="size-4" /> {l.discord}
        </span>
      )}
    </div>
  );
}

function Avatar({ m, size }: { m: TeamMember; size: number }) {
  return m.user.avatarUrl ? (
    // eslint-disable-next-line @next/next/no-img-element -- profile photo
    <img src={m.user.avatarUrl} alt="" width={size} height={size} className="rounded-full object-cover ring-4 ring-[#0d0912]" style={{ width: size, height: size }} />
  ) : (
    <span className="flex items-center justify-center rounded-full font-bold text-white ring-4 ring-[#0d0912]" style={{ width: size, height: size, fontSize: size * 0.4, background: "var(--m-gradient)" }}>
      {m.user.displayName.slice(0, 1).toUpperCase()}
    </span>
  );
}

const memberVars = (m: TeamMember) =>
  ({
    "--m-accent": `hsl(${m.profile.accentHue} 95% 62%)`,
    "--m-gradient": `linear-gradient(120deg, hsl(${m.profile.accentHue} 90% 55%), hsl(${(m.profile.accentHue + 40) % 360} 95% 60%))`,
  }) as CSSProperties;

export default async function TeamPage() {
  const { owners, team, settings } = getTeamMembers();
  const { socials } = await getSettings();
  const all = [...owners, ...team];
  const covers = new Map((await getMediaBySlugs(all.map((m) => m.profile.bannerSlug).filter(Boolean))).map((c) => [c.slug, smallestVariant(c, 960)?.url ?? c.original.url]));
  const added = all.reduce((n, m) => n + m.uploads, 0);
  const title = (m: TeamMember) => m.team.role || m.profile.headline || (m.user.role === "owner" ? "Owner" : "Team");
  const blurb = (m: TeamMember) => m.team.blurb || m.user.bio;

  return (
    <div className="relative overflow-x-clip">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-40 -z-10 mx-auto h-[620px] w-[min(1100px,100vw)] rounded-full bg-[radial-gradient(closest-side,rgb(255_79_163/0.2),transparent)] blur-2xl" />
      <Container wide>
        {/* Hero */}
        <header className="mx-auto max-w-3xl pt-14 pb-14 text-center sm:pt-20 sm:pb-20">
          <p className="kicker mb-4">{settings.kicker}</p>
          <h1 className="display-xl text-[54px] leading-[0.92] sm:text-[96px]">{settings.title}</h1>
          <p className="mx-auto mt-6 max-w-2xl text-[17px] leading-relaxed text-white/70 sm:text-[18.5px]">{settings.intro}</p>
          <p className="mt-6 inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-[13.5px] text-white/60">
            <span>
              <strong className="text-white">{all.length}</strong> {all.length === 1 ? "person" : "people"}
            </span>
            <span className="size-1 rounded-full bg-white/30" />
            <span>
              <strong className="text-white">{added.toLocaleString("en-US")}</strong> items added to the archive
            </span>
          </p>
        </header>

        {/* Owners */}
        {owners.length > 0 && (
          <section aria-labelledby="owners">
            <h2 id="owners" className="mb-6 text-center text-[13px] font-bold tracking-[0.2em] text-white/45 uppercase">
              {settings.ownersHeading}
            </h2>
            <Stagger as="ul" className={cn("mx-auto grid gap-6", owners.length === 1 ? "max-w-xl" : "max-w-5xl md:grid-cols-2")}>
              {owners.map((m) => {
                const cover = covers.get(m.profile.bannerSlug);
                return (
                  <li key={m.user.id} style={memberVars(m)}>
                    <article className="group relative h-full overflow-hidden rounded-[32px] border border-white/10 bg-white/[0.03] shadow-[0_40px_100px_-40px_var(--m-accent)] transition-[transform,border-color] duration-500 hover:-translate-y-1 hover:border-white/20">
                      <div className="relative h-44 overflow-hidden [mask-image:linear-gradient(to_bottom,black_35%,transparent)]">
                        {cover ? (
                          // eslint-disable-next-line @next/next/no-img-element -- cover art
                          <img src={cover} alt="" loading="lazy" className="size-full object-cover transition-transform duration-[1.2s] group-hover:scale-105" />
                        ) : (
                          <div className="size-full" style={{ background: "var(--m-gradient)" }} />
                        )}
                      </div>
                      <div className="relative -mt-16 px-7 pb-7">
                        <Avatar m={m} size={112} />
                        <h3 className="display-xl mt-4 flex items-center gap-2 text-[38px] leading-none">
                          {m.user.displayName} <BadgeCheck className="size-6" style={{ color: "var(--m-accent)" }} />
                        </h3>
                        <p className="mt-2 text-[15px] font-bold" style={{ color: "var(--m-accent)" }}>
                          {title(m)}
                        </p>
                        {blurb(m) && <p className="mt-3 text-[15.5px] leading-relaxed whitespace-pre-line text-white/70">{blurb(m)}</p>}
                        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                          <Socials m={m} />
                          <Link
                            href={`/@${m.user.username}`}
                            className="inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-[14px] font-bold text-white transition-transform hover:scale-[1.04]"
                            style={{ background: "var(--m-gradient)" }}
                          >
                            @{m.user.username} <ArrowUpRight className="size-4" />
                          </Link>
                        </div>
                      </div>
                    </article>
                  </li>
                );
              })}
            </Stagger>
          </section>
        )}

        {/* Everyone else */}
        {team.length > 0 && (
          <section aria-labelledby="crew" className="mt-20 sm:mt-28">
            <h2 id="crew" className="mb-6 text-center text-[13px] font-bold tracking-[0.2em] text-white/45 uppercase">
              {settings.teamHeading}
            </h2>
            <Stagger as="ul" className="mx-auto grid max-w-6xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {team.map((m) => (
                <li key={m.user.id} style={memberVars(m)}>
                  <Link
                    href={`/@${m.user.username}`}
                    className="group flex h-full flex-col rounded-[26px] border border-white/10 bg-white/[0.03] p-6 transition-[transform,border-color,background-color] duration-500 hover:-translate-y-1 hover:border-[color:var(--m-accent)] hover:bg-white/[0.05]"
                  >
                    <div className="flex items-center gap-4">
                      <Avatar m={m} size={72} />
                      <div className="min-w-0">
                        <p className="truncate text-[19px] font-bold">{m.user.displayName}</p>
                        <p className="truncate text-[14px] font-bold" style={{ color: "var(--m-accent)" }}>
                          {title(m)}
                        </p>
                      </div>
                    </div>
                    {blurb(m) && <p className="mt-4 line-clamp-3 text-[14.5px] leading-relaxed text-white/65">{blurb(m)}</p>}
                    <p className="mt-auto flex items-center justify-between pt-5 text-[13px] text-white/45">
                      <span>{m.uploads ? `${m.uploads.toLocaleString("en-US")} added` : `@${m.user.username}`}</span>
                      <ArrowUpRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </p>
                  </Link>
                </li>
              ))}
            </Stagger>
          </section>
        )}

        {all.length === 0 && <p className="py-10 text-center text-white/50">The team will be introduced here soon.</p>}

        {/* Closing */}
        <section className="relative mx-auto mt-24 max-w-3xl overflow-hidden rounded-[36px] border border-white/10 bg-white/[0.03] px-6 py-14 text-center sm:mt-32 sm:px-12 sm:py-20">
          <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(70%_80%_at_50%_120%,rgb(255_79_163/0.25),transparent_70%)]" />
          <Heart className="mx-auto size-8 fill-current text-accent" />
          <h2 className="display-xl mt-5 text-[44px] leading-none sm:text-[64px]">{settings.closingTitle}</h2>
          <p className="mx-auto mt-5 max-w-xl text-[17px] leading-relaxed whitespace-pre-line text-white/75">{settings.closing}</p>
          {settings.signoff && <p className="mt-5 text-[15px] font-bold text-white/60">{settings.signoff}</p>}
          {settings.showJoin && socials.discord && (
            <a
              href={socials.discord}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-8 inline-flex h-12 items-center gap-2 rounded-full bg-[#5865F2] px-6 text-[15px] font-bold text-white transition-transform hover:scale-[1.04]"
            >
              <DiscordIcon className="size-5" /> Hang out with us on Discord
            </a>
          )}
        </section>
      </Container>
    </div>
  );
}
