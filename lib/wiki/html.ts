/**
 * A small, forgiving HTML reader for MediaWiki's rendered pages. It turns the
 * markup into a plain tree that the site then filters and renders as React
 * elements itself (only known tags and attributes survive), so nothing from
 * the wiki is ever injected as raw HTML.
 */

export type WNode = WElement | WText;
export interface WElement {
  type: "el";
  tag: string;
  attrs: Record<string, string>;
  children: WNode[];
}
export interface WText {
  type: "text";
  text: string;
}

const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);
/** Never kept, so their contents are skipped entirely. */
const RAW = new Set(["script", "style", "noscript", "template", "iframe", "object", "svg", "math", "textarea", "select"]);

const NAMED: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—", hellip: "…", lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”",
  copy: "©", reg: "®", trade: "™", middot: "·", bull: "•", times: "×", deg: "°", eacute: "é", aacute: "á", iacute: "í", oacute: "ó", uacute: "ú", ntilde: "ñ",
  Eacute: "É", ccedil: "ç", uuml: "ü", ouml: "ö", auml: "ä", laquo: "«", raquo: "»", larr: "←", rarr: "→", minus: "−", frac12: "½", pound: "£", euro: "€",
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
    }
    return NAMED[e] ?? m;
  });
}

const TOKEN = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<![^>]*>|<\/([a-zA-Z][\w:-]*)\s*>|<([a-zA-Z][\w:-]*)((?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>|[^<]+|</g;
const ATTR = /([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;

export function parseHtml(html: string): WNode[] {
  const root: WElement = { type: "el", tag: "#root", attrs: {}, children: [] };
  const stack: WElement[] = [root];
  let skip: string | null = null;
  for (const m of html.matchAll(TOKEN)) {
    const [whole, close, open, rawAttrs, selfClose] = m;
    if (skip) {
      if (close?.toLowerCase() === skip) skip = null;
      continue;
    }
    if (whole.startsWith("<!")) continue;
    if (close) {
      const tag = close.toLowerCase();
      const at = stack.findLastIndex((e) => e.tag === tag);
      if (at > 0) stack.length = at;
      continue;
    }
    if (open) {
      const tag = open.toLowerCase();
      if (RAW.has(tag)) {
        if (!selfClose) skip = tag;
        continue;
      }
      const attrs: Record<string, string> = {};
      for (const a of (rawAttrs ?? "").matchAll(ATTR)) attrs[a[1].toLowerCase()] = decodeEntities(a[2] ?? a[3] ?? a[4] ?? "");
      const el: WElement = { type: "el", tag, attrs, children: [] };
      // A new block closes an open paragraph, as browsers do.
      if (tag !== "p" && /^(div|ul|ol|table|h[1-6]|figure|dl|blockquote|pre)$/.test(tag) && stack.at(-1)?.tag === "p") stack.pop();
      stack.at(-1)!.children.push(el);
      if (!VOID.has(tag) && !selfClose) stack.push(el);
      continue;
    }
    stack.at(-1)!.children.push({ type: "text", text: decodeEntities(whole) });
  }
  return root.children;
}

/* ---------- Helpers ---------- */

export const isEl = (n: WNode | undefined): n is WElement => n?.type === "el";
export const classes = (n: WElement) => (n.attrs.class ?? "").split(/\s+/).filter(Boolean);
export const hasClass = (n: WNode, c: string) => isEl(n) && classes(n).includes(c);
export const hasClassPrefix = (n: WNode, p: string) => isEl(n) && classes(n).some((c) => c.startsWith(p));

export function textOf(nodes: WNode | WNode[]): string {
  const list = Array.isArray(nodes) ? nodes : [nodes];
  return list.map((n) => (n.type === "text" ? n.text : textOf(n.children))).join("");
}

/** Every element below `nodes` (depth first) that matches. */
export function findAll(nodes: WNode[], test: (e: WElement) => boolean, out: WElement[] = []): WElement[] {
  for (const n of nodes) {
    if (!isEl(n)) continue;
    if (test(n)) out.push(n);
    findAll(n.children, test, out);
  }
  return out;
}

export const findFirst = (nodes: WNode[], test: (e: WElement) => boolean): WElement | undefined => findAll(nodes, test)[0];

/** A copy of the tree without the elements `drop` matches. */
export function prune(nodes: WNode[], drop: (e: WElement) => boolean): WNode[] {
  const out: WNode[] = [];
  for (const n of nodes) {
    if (!isEl(n)) out.push(n);
    else if (!drop(n)) out.push({ ...n, children: prune(n.children, drop) });
  }
  return out;
}
