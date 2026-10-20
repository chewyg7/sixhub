import { ArrowUpRight } from "lucide-react";
import { WIKI_LICENSE, imageUrl } from "@/lib/wiki/api";
import type { WikiArticle, WikiInfobox } from "@/lib/wiki/article";
import { WikiContent, render, type WikiLinks } from "./wiki-content";

/** The article's details card: picture, caption and the infobox rows. */
export function WikiInfoboxCard({ box, title, links }: { box: WikiInfobox; title: string; links: WikiLinks }) {
  return (
    <aside className="overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.03]">
      {box.image && (
        <a href={imageUrl(box.image.file)} target="_blank" rel="noopener" className="block bg-black/30">
          {/* eslint-disable-next-line @next/next/no-img-element -- served by the wiki's image server */}
          <img
            src={imageUrl(box.image.file, 720, box.image.width)}
            alt={title}
            width={box.image.width}
            height={box.image.height}
            referrerPolicy="no-referrer"
            className="block h-auto max-h-[520px] w-full object-cover"
          />
        </a>
      )}
      {box.caption && <div className="wiki-prose border-b border-divider px-5 py-3 text-[13px]! leading-relaxed">{render(box.caption, links)}</div>}
      <div className="px-5 pb-3">
        {box.groups.map((g, gi) => (
          <div key={gi} className="pt-4">
            {g.header && <p className="eyebrow mb-2 text-[11px]">{g.header}</p>}
            <dl className="divide-y divide-divider">
              {g.rows.map((r, ri) => (
                <div key={ri} className="grid grid-cols-[minmax(0,110px)_1fr] gap-3 py-2.5 text-[13.5px]">
                  <dt className="text-muted">{r.label}</dt>
                  <dd className="wiki-prose min-w-0 text-[13.5px]! leading-snug! text-text">{render(r.value, links)}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </aside>
  );
}

/** The article body: each section with its GTA VI subsections. */
export function WikiSections({ article, links }: { article: WikiArticle; links: WikiLinks }) {
  return (
    <div className="space-y-14">
      {article.sections.map((s) => (
        <section key={s.id || s.title} aria-labelledby={`w-${s.id}`}>
          <h2 id={`w-${s.id}`} className="display mb-5 text-[32px] sm:text-[38px]">
            {s.title}
          </h2>
          <WikiContent nodes={s.nodes} links={links} />
          {s.subsections.map((sub) => (
            <div key={sub.id || sub.title} className="mt-8">
              <h3 className="mb-3 text-[20px] font-bold text-text">{sub.title}</h3>
              <WikiContent nodes={sub.nodes} links={links} />
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}

/** Credit and licence, required for reusing the wiki's text. */
export function WikiCredit({ url, title }: { url: string; title: string }) {
  return (
    <p className="mt-16 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-2xl border border-white/8 bg-white/[0.03] px-5 py-4 text-[13px] leading-relaxed text-muted">
      <span>
        From the{" "}
        <a href={url} target="_blank" rel="noopener" className="wiki-link">
          {title}
        </a>{" "}
        article on{" "}
        <a href="https://gta.wiki" target="_blank" rel="noopener" className="wiki-link">
          GTA Wiki
        </a>
        , shared under{" "}
        <a href={WIKI_LICENSE.url} target="_blank" rel="noopener license" className="wiki-link">
          {WIKI_LICENSE.name}
        </a>
        . Images are hosted by GTA Wiki; game images © Rockstar Games.
      </span>
      <a href={url} target="_blank" rel="noopener" className="ml-auto inline-flex items-center gap-1 font-semibold text-text hover:text-accent-text">
        Read or edit on GTA Wiki <ArrowUpRight className="size-3.5" />
      </a>
    </p>
  );
}
