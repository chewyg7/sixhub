import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { SplitReveal } from "@/components/motion/reveal";

export function Container({ children, className, wide }: { children: ReactNode; className?: string; wide?: boolean }) {
  return <div className={cn("mx-auto w-full px-4 sm:px-6 lg:px-10", wide ? "max-w-[1600px]" : "max-w-[1440px]", className)}>{children}</div>;
}

export interface Crumb {
  href?: string;
  label: string;
}

export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="flex flex-wrap items-center gap-1 text-[13.5px] text-muted">
        {items.map((c, i) => (
          <li key={i} className="flex items-center gap-1">
            {c.href ? (
              <Link href={c.href} className="transition-colors hover:text-accent-text">
                {c.label}
              </Link>
            ) : (
              <span aria-current="page" className="text-text">
                {c.label}
              </span>
            )}
            {i < items.length - 1 && <ChevronRight aria-hidden className="size-3.5 text-faint" />}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** Page header: kicker, big sunset title, lede and actions. */
export function PageHeader({
  eyebrow,
  title,
  lede,
  crumbs,
  actions,
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  lede?: ReactNode;
  crumbs?: Crumb[];
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("relative pt-10 pb-10 sm:pt-16", className)}>
      {/* soft dusk glow behind the title */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-[420px] w-[min(900px,100vw)] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(244_162_197/0.14),transparent)] blur-2xl"
      />
      {crumbs && <Breadcrumbs items={crumbs} className="mb-6" />}
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="max-w-4xl">
          {eyebrow && <p className="kicker mb-4">{eyebrow}</p>}
          <SplitReveal as="h1" by="chars" when="intro" className="display-xl text-[64px] sm:text-[120px]">
            {title}
          </SplitReveal>
          {lede && <p className="mt-5 max-w-2xl text-[16px] leading-relaxed text-muted sm:text-[17px]">{lede}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

/** Section heading: kicker + sunset title + optional underlined link. */
export function SectionHeading({
  title,
  href,
  linkLabel = "View all",
  description,
  kicker,
  className,
  id,
  aside,
}: {
  title: ReactNode;
  href?: string;
  linkLabel?: string;
  description?: ReactNode;
  kicker?: ReactNode;
  className?: string;
  id?: string;
  aside?: ReactNode;
}) {
  return (
    <div className={cn("mb-8 flex flex-col gap-5 sm:mb-10 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="max-w-3xl">
        {kicker && <p className="kicker mb-3">{kicker}</p>}
        <SplitReveal id={id} by="words" className="display-xl text-[52px] sm:text-[92px]">
          {title}
        </SplitReveal>
        {description && <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted">{description}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-4">
        {aside}
        {href && <UnderlineLink href={href}>{linkLabel}</UnderlineLink>}
      </div>
    </div>
  );
}

/** Understated text link with a hairline underline and arrow. */
export function UnderlineLink({ href, children, external, className }: { href: string; children: ReactNode; external?: boolean; className?: string }) {
  const cls = cn(
    "group inline-flex items-center gap-2 border-b border-border-strong pb-1.5 text-[14px] font-semibold text-text transition-colors hover:border-accent hover:text-accent-text",
    className,
  );
  const inner = (
    <>
      {children}
      <ArrowUpRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
    </>
  );
  return external ? (
    <a href={href} target="_blank" rel="noopener" className={cls}>
      {inner}
    </a>
  ) : (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  );
}
