import Link from "next/link";
import { SITE } from "@/lib/site";
import { getSettings } from "@/lib/content";
import { SocialLinks } from "./social-links";
import { Magnetic, SplitReveal } from "@/components/motion/reveal";

const COLUMNS = [
  {
    title: "Browse",
    links: [
      { href: "/news", label: "News" },
      { href: "/media", label: "Media" },
      { href: "/viewer", label: "Media Viewer" },
      { href: "/collections", label: "Collections" },
    ],
  },
  {
    title: "Database",
    links: [
      { href: "/info", label: "Information" },
      { href: "/info/characters", label: "Characters" },
      { href: "/info/locations", label: "Locations" },
      { href: "/timeline", label: "Timeline" },
    ],
  },
  {
    title: "Site",
    links: [
      { href: "/faq", label: "FAQ" },
      { href: "/about", label: "About" },
      { href: "/contact", label: "Contact" },
      { href: "/privacy", label: "Privacy" },
      { href: "/library", label: "Your library" },
    ],
  },
];

export async function Footer() {
  const { release } = await getSettings();
  const label = new Date(`${release.date}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
  return (
    <footer className="relative mt-36 overflow-hidden rounded-t-[40px] border-t border-white/10 bg-white/[0.02]">
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 left-1/2 h-[420px] w-[1200px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(255_79_163/0.22),transparent)]"
      />
      <div className="relative mx-auto flex max-w-[1600px] flex-col gap-8 px-5 pt-20 sm:px-8 lg:flex-row lg:items-end lg:justify-between lg:px-12">
        <div>
          <p className="kicker mb-4">Out {label}</p>
          <SplitReveal by="chars" className="display-xl text-[17vw] sm:text-[120px] lg:text-[150px]">
            See you in Leonida
          </SplitReveal>
        </div>
        <Magnetic>
          <Link
            href="/media"
            data-cursor="view"
            className="flex size-40 items-center justify-center rounded-full bg-[image:var(--sunset)] text-center text-[17px] font-bold text-white shadow-[0_20px_60px_-15px_rgb(255_79_163/0.8)] transition-transform duration-500 hover:scale-105 sm:size-48"
          >
            Explore
            <br />
            the archive
          </Link>
        </Magnetic>
      </div>
      <div className="relative mx-auto grid max-w-[1600px] gap-10 px-5 pt-20 pb-12 sm:px-8 md:grid-cols-[1.4fr_repeat(3,1fr)] lg:px-12">
        <div>
          <Link href="/" aria-label={`${SITE.name} home`} className="inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element -- brand mark */}
            <img src="/brand/logo-480.webp" alt="" width={480} height={335} className="h-16 w-auto" />
          </Link>
          <p className="mt-5 max-w-xs text-[15px] leading-relaxed text-muted">Every GTA VI screenshot, trailer and headline in one place, and the tools to study them.</p>
          <SocialLinks className="mt-6" size="sm" />
        </div>
        {COLUMNS.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <p className="text-[15px] font-bold text-text">{col.title}</p>
            <ul className="mt-5 space-y-3">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-[15px] text-muted transition-colors hover:text-accent-text">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="relative mx-auto flex max-w-[1600px] flex-col gap-2 border-t border-white/10 px-5 py-7 text-[13px] leading-relaxed text-faint sm:px-8 md:flex-row md:items-start md:justify-between lg:px-12">
        <p className="max-w-3xl">
          {SITE.name} is an independent fan website. It is not affiliated with, endorsed by or sponsored by Rockstar Games or Take-Two Interactive. Grand Theft Auto and related
          marks are trademarks of Take-Two Interactive Software, Inc. News articles belong to their publishers and link to the original stories.
        </p>
        <p className="shrink-0">
          © {new Date().getFullYear()} {SITE.domain}
        </p>
      </div>
    </footer>
  );
}
