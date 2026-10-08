import Link from "next/link";
import type { ReactNode } from "react";

/**
 * A small, safe Markdown renderer for pages written in the admin panel.
 * It builds React elements (never raw HTML), so nothing typed into a page
 * can run script. Supported: # headings, paragraphs, - and 1. lists,
 * > quotes, ``` code blocks, --- rules, ![images](/…), **bold**, *italic*,
 * `code` and [links](/… or https://…).
 */

/** Only site paths, https/http and mailto links survive. */
export function safeHref(href: string): string | null {
  const h = href.trim();
  if (/^\/(?!\/)/.test(h) || /^#[\w-]+$/.test(h)) return h;
  try {
    const u = new URL(h);
    return ["https:", "http:", "mailto:"].includes(u.protocol) ? u.toString() : null;
  } catch {
    return null;
  }
}

const safeSrc = (src: string) => {
  const s = src.trim();
  if (/^\/(?!\/)[\w\-./%]+$/.test(s)) return s;
  try {
    return new URL(s).protocol === "https:" ? s : null;
  } catch {
    return null;
  }
};

function inline(text: string, key = "i"): ReactNode[] {
  const out: ReactNode[] = [];
  // Order matters: code first (its content is literal), then links, bold, italic.
  const re = /(`[^`]+`)|(\[([^\]]+)\]\(([^)\s]+)\))|(\*\*([^*]+)\*\*)|(\*([^*]+)\*|_([^_]+)_)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let n = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const k = `${key}-${n++}`;
    if (m[1]) out.push(<code key={k}>{m[1].slice(1, -1)}</code>);
    else if (m[2]) {
      const href = safeHref(m[4]);
      const label = inline(m[3], k);
      if (!href) out.push(<span key={k}>{label}</span>);
      else if (href.startsWith("/") || href.startsWith("#")) out.push(<Link key={k} href={href}>{label}</Link>);
      else
        out.push(
          <a key={k} href={href} target="_blank" rel="noopener noreferrer nofollow">
            {label}
          </a>,
        );
    } else if (m[5]) out.push(<strong key={k}>{inline(m[6], k)}</strong>);
    else out.push(<em key={k}>{inline(m[8] ?? m[9], k)}</em>);
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ source, className }: { source: string; className?: string }) {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let k = 0;
  const key = () => `b${k++}`;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    // Code block
    if (line.startsWith("```")) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) body.push(lines[i++]);
      i++;
      blocks.push(
        <pre key={key()}>
          <code>{body.join("\n")}</code>
        </pre>,
      );
      continue;
    }
    // Heading
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      const id = h[2].toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const content = inline(h[2]);
      blocks.push(h[1].length === 1 ? <h2 key={key()} id={id}>{content}</h2> : h[1].length === 2 ? <h3 key={key()} id={id}>{content}</h3> : <h4 key={key()} id={id}>{content}</h4>);
      i++;
      continue;
    }
    // Rule
    if (/^(-{3,}|\*{3,})\s*$/.test(line)) {
      blocks.push(<hr key={key()} />);
      i++;
      continue;
    }
    // Image on its own line
    const img = /^!\[([^\]]*)\]\(([^)\s]+)\)\s*$/.exec(line);
    if (img) {
      const src = safeSrc(img[2]);
      if (src)
        blocks.push(
          <figure key={key()}>
            {/* eslint-disable-next-line @next/next/no-img-element -- page author's image */}
            <img src={src} alt={img[1]} loading="lazy" />
            {img[1] && <figcaption>{img[1]}</figcaption>}
          </figure>,
        );
      i++;
      continue;
    }
    // Quote
    if (line.startsWith(">")) {
      const body: string[] = [];
      while (i < lines.length && lines[i].startsWith(">")) body.push(lines[i++].replace(/^>\s?/, ""));
      blocks.push(<blockquote key={key()}>{inline(body.join(" "))}</blockquote>);
      continue;
    }
    // Lists
    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\./.test(line);
      const items: ReactNode[] = [];
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) {
        items.push(<li key={`li${items.length}`}>{inline(lines[i].replace(/^\s*([-*]|\d+\.)\s+/, ""))}</li>);
        i++;
      }
      blocks.push(ordered ? <ol key={key()}>{items}</ol> : <ul key={key()}>{items}</ul>);
      continue;
    }
    // Paragraph: consecutive plain lines
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,3}\s|```|>|\s*([-*]|\d+\.)\s|!\[|-{3,}\s*$)/.test(lines[i])) para.push(lines[i++]);
    if (!para.length) para.push(lines[i++]);
    blocks.push(<p key={key()}>{inline(para.join(" "))}</p>);
  }

  return <div className={className ?? "prose-page"}>{blocks}</div>;
}
