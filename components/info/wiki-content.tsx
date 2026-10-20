import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { WIKI_ORIGIN, articleUrl, imageUrl } from "@/lib/wiki/api";
import { fileFromSrc } from "@/lib/wiki/article";
import { classes, findAll, findFirst, hasClass, isEl, textOf, type WElement, type WNode } from "@/lib/wiki/html";

/**
 * Renders wiki markup with the site's own elements. Only known tags survive,
 * with no wiki attributes beyond what's rebuilt here (links, images, table
 * spans), so the wiki's styling and scripts never reach the page.
 */

export type WikiLinks = Map<string, { section: string; slug: string }>;

const SAME = new Set(["p", "b", "strong", "i", "em", "u", "s", "small", "sup", "sub", "ul", "ol", "li", "dl", "dt", "dd", "blockquote", "code", "pre", "q", "cite", "br", "hr", "thead", "tbody", "tfoot", "tr", "caption"]);

/** Where a wiki link should go: our page for it, the wiki, or nowhere (files, categories). */
function linkTarget(href: string, links: WikiLinks): { internal?: string; external?: string } | null {
  if (href.startsWith("#")) return null;
  if (/^https?:\/\//.test(href)) return href.startsWith(WIKI_ORIGIN) ? linkTarget(href.slice(WIKI_ORIGIN.length), links) : { external: href };
  const m = href.match(/^\/w\/([^?#]+)/);
  if (!m) return null;
  const title = decodeURIComponent(m[1]).replace(/_/g, " ");
  if (/^(File|Category|Template|Special|User|GTA Wiki|Help|Talk|User talk|Module):/i.test(title)) return null;
  const ours = links.get(title);
  return ours ? { internal: `/info/${ours.section}/${ours.slug}` } : { external: articleUrl(title) };
}

function Img({ el, width }: { el: WElement; width: number }) {
  const file = fileFromSrc(el.attrs.src ?? "");
  if (!file) return null;
  const fw = Number(el.attrs["data-file-width"]) || undefined;
  const fh = Number(el.attrs["data-file-height"]) || undefined;
  const w = Number(el.attrs.width) || undefined;
  const h = Number(el.attrs.height) || undefined;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- served by the wiki's image server
    <img src={imageUrl(file, width, fw)} alt={el.attrs.alt || ""} width={w ?? fw} height={h ?? fh} loading="lazy" decoding="async" referrerPolicy="no-referrer" className="wiki-img" />
  );
}

/** A MediaWiki gallery as a grid of GTA VI pictures that open full size. */
function Gallery({ el, links }: { el: WElement; links: WikiLinks }) {
  const boxes = findAll(el.children, (e) => hasClass(e, "gallerybox"));
  if (!boxes.length) return null;
  return (
    <ul className="wiki-gallery">
      {boxes.map((box, i) => {
        const img = findFirst(box.children, (e) => e.tag === "img");
        const file = img && fileFromSrc(img.attrs.src ?? "");
        if (!img || !file) return null;
        const caption = findFirst(box.children, (e) => hasClass(e, "gallerytext"));
        return (
          <li key={i}>
            <a href={imageUrl(file, undefined)} target="_blank" rel="noopener" className="wiki-gallery-link">
              <Img el={img} width={640} />
            </a>
            {caption && textOf(caption).trim() && <div className="wiki-gallery-caption">{render(caption.children, links)}</div>}
          </li>
        );
      })}
    </ul>
  );
}

function element(el: WElement, key: number, links: WikiLinks): ReactNode {
  const kids = () => render(el.children, links, el.tag);
  if (hasClass(el, "gallery")) return <Gallery key={key} el={el} links={links} />;
  if (hasClass(el, "wiki-quote")) {
    const text = findFirst(el.children, (e) => hasClass(e, "wiki-quote-text"));
    const by = findFirst(el.children, (e) => hasClass(e, "wiki-quote-name"));
    return (
      <blockquote key={key} className="wiki-quote">
        <div className="wiki-quote-text">{text ? render(text.children, links) : kids()}</div>
        {by && <footer>{render(by.children, links)}</footer>}
      </blockquote>
    );
  }
  // Tabs become stacked, titled parts.
  if (hasClass(el, "tabbertab"))
    return (
      <Fragment key={key}>
        {el.attrs["data-title"] && <h4>{el.attrs["data-title"]}</h4>}
        {kids()}
      </Fragment>
    );
  if (el.tag === "img") return <Img key={key} el={el} width={Math.min(900, Math.max(320, (Number(el.attrs.width) || 300) * 2))} />;
  if (el.tag === "figure" || (el.tag === "span" && el.attrs.typeof?.startsWith("mw:File"))) {
    const img = findFirst(el.children, (e) => e.tag === "img");
    if (!img) return null;
    const small = (Number(img.attrs.width) || 0) < 60;
    if (small) return <Img key={key} el={img} width={80} />;
    const caption = findFirst(el.children, (e) => e.tag === "figcaption");
    return (
      <figure key={key} className={cn2("wiki-figure", classes(el).includes("mw-halign-right") || classes(el).includes("mw-default-size") ? "wiki-figure-side" : "")}>
        <Img el={img} width={720} />
        {caption && textOf(caption).trim() && <figcaption>{render(caption.children, links)}</figcaption>}
      </figure>
    );
  }
  if (el.tag === "a") {
    const target = linkTarget(el.attrs.href ?? "", links);
    if (!target) return <Fragment key={key}>{kids()}</Fragment>;
    if (target.internal)
      return (
        <Link key={key} href={target.internal} className="wiki-link">
          {kids()}
        </Link>
      );
    return (
      <a key={key} href={target.external} target="_blank" rel="noopener nofollow" className="wiki-link wiki-link-out">
        {kids()}
      </a>
    );
  }
  if (el.tag === "table") {
    if (!textOf(el).trim()) return null;
    return (
      <div key={key} className="wiki-table-wrap">
        <table className="wiki-table">{kids()}</table>
      </div>
    );
  }
  if (el.tag === "th" || el.tag === "td") {
    const Tag = el.tag;
    const colSpan = Number(el.attrs.colspan) || undefined;
    const rowSpan = Number(el.attrs.rowspan) || undefined;
    return (
      <Tag key={key} colSpan={colSpan} rowSpan={rowSpan}>
        {kids()}
      </Tag>
    );
  }
  if (/^h[2-6]$/.test(el.tag)) return <h4 key={key}>{textOf(el)}</h4>;
  if (el.tag === "abbr") return <abbr key={key} title={el.attrs.title}>{kids()}</abbr>;
  if (SAME.has(el.tag)) {
    const Tag = el.tag as "p";
    if (el.tag === "br" || el.tag === "hr") return <Tag key={key} />;
    if (el.tag === "p" && !textOf(el).trim() && !findFirst(el.children, (e) => e.tag === "img")) return null;
    return <Tag key={key}>{kids()}</Tag>;
  }
  if (el.tag === "div" && hasClass(el, "mw-heading")) return <h4 key={key}>{textOf(el)}</h4>;
  // Layout wrappers (div, span, center…) keep their content but not their styling.
  return <Fragment key={key}>{kids()}</Fragment>;
}

const cn2 = (...c: string[]) => c.filter(Boolean).join(" ");

/** Elements where stray whitespace isn't allowed (React warns about text inside tables and lists). */
const STRUCTURAL = new Set(["table", "thead", "tbody", "tfoot", "tr", "ul", "ol", "dl"]);

export function render(nodes: WNode[], links: WikiLinks, parent?: string): ReactNode[] {
  return nodes.map((n, i) => (isEl(n) ? element(n, i, links) : parent && STRUCTURAL.has(parent) && !n.text.trim() ? null : n.text));
}

export function WikiContent({ nodes, links, className }: { nodes: WNode[]; links: WikiLinks; className?: string }) {
  return <div className={cn2("wiki-prose", className ?? "")}>{render(nodes, links)}</div>;
}
