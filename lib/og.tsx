import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import sharp from "sharp";
import type { MediaItem } from "@/types/content";
import { UPLOAD_DIR } from "@/lib/db";
import { smallestVariant } from "@/lib/media/variants";

/**
 * Link previews (Discord, iMessage, X…): every page gets a card in the site's
 * look. Dark dusk background with the pink glow, the logo top left, the page
 * title in GTA Art Deco with its lede, and a picture of the page fading in
 * from the right.
 */

export const OG_SIZE = { width: 1200, height: 630 };

const BG = "#0b0910";
const ROOT = process.cwd();
const PUBLIC = path.join(ROOT, "public");

/* Satori reads TTF/OTF (not WOFF2), so the site fonts are kept as TTF for these cards. */
let fonts: Promise<{ name: string; data: Buffer; weight: 500 | 700; style: "normal" }[]> | null = null;
function loadFonts() {
  fonts ??= Promise.all([
    readFile(path.join(ROOT, "assets/og/GTAArtDeco-Condensed-Bold.ttf")).then((data) => ({ name: "Deco Condensed", data, weight: 700 as const, style: "normal" as const })),
    readFile(path.join(ROOT, "assets/og/GTAArtDeco-Medium.ttf")).then((data) => ({ name: "Deco", data, weight: 500 as const, style: "normal" as const })),
  ]);
  fonts.catch(() => (fonts = null));
  return fonts;
}

/** A site image: a public file, an uploaded file (/files/…) or a full URL. */
async function readImage(src: string): Promise<Buffer | null> {
  try {
    if (/^https?:\/\//.test(src)) {
      const res = await fetch(src, { signal: AbortSignal.timeout(5000) });
      return res.ok ? Buffer.from(await res.arrayBuffer()) : null;
    }
    const clean = decodeURIComponent(src.split("?")[0]);
    const [base, rel] = clean.startsWith("/files/") ? [UPLOAD_DIR, clean.slice("/files/".length)] : [PUBLIC, clean.replace(/^\/+/, "")];
    const full = path.resolve(base, rel);
    if (!full.startsWith(path.resolve(base) + path.sep)) return null;
    return await readFile(/*turbopackIgnore: true*/ full);
  } catch {
    return null;
  }
}

/** Resized for the card, as a data URI (Satori can't decode WebP). */
async function picture(src: string, fit: "cover" | "contain") {
  const buf = await readImage(src);
  if (!buf) return null;
  try {
    const img = sharp(buf).rotate();
    const out =
      fit === "cover"
        ? await img.resize(820, 630, { fit: "cover", position: "attention" }).jpeg({ quality: 82 }).toBuffer()
        : await img.resize(600, 470, { fit: "inside", withoutEnlargement: false }).png().toBuffer();
    return `data:image/${fit === "cover" ? "jpeg" : "png"};base64,${out.toString("base64")}`;
  } catch {
    return null;
  }
}

let logo: Promise<string | null> | null = null;
function loadLogo() {
  logo ??= readImage("/brand/logo-480.webp").then(async (buf) =>
    buf ? `data:image/png;base64,${(await sharp(buf).resize({ height: 140 }).png().toBuffer()).toString("base64")}` : null,
  );
  return logo;
}

/** The picture to show for a media item: a large still (or a video's poster). */
export function mediaPicture(item: MediaItem | null | undefined): string | undefined {
  if (!item) return undefined;
  if (item.variants.length) return smallestVariant(item, 1200).url;
  return item.poster?.url;
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

export interface OgCard {
  title: string;
  lede?: string;
  /** Small line over the title, e.g. the section. */
  kicker?: string;
  /** Page picture; see readImage for what it accepts. */
  image?: string;
  /** "cover" fills the right side (photos); "contain" sits a cut-out (logos, plates) on it. */
  fit?: "cover" | "contain";
}

export async function ogImage({ title, lede, kicker, image, fit = "cover" }: OgCard) {
  const [fontList, logoUri, pic] = await Promise.all([loadFonts(), loadLogo(), image ? picture(image, fit) : Promise.resolve(null)]);
  const t = clip(title, 60);
  const titleSize = t.length <= 12 ? 120 : t.length <= 22 ? 100 : t.length <= 34 ? 82 : 66;
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: BG, fontFamily: "Deco" }}>
      {pic &&
        (fit === "cover" ? (
          // eslint-disable-next-line @next/next/no-img-element -- rendered to PNG, not the page
          <img src={pic} alt="" width={820} height={630} style={{ position: "absolute", right: 0, top: 0, width: 820, height: 630, objectFit: "cover" }} />
        ) : (
          <div style={{ position: "absolute", right: 40, top: 0, width: 600, height: 630, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- rendered to PNG, not the page */}
            <img src={pic} alt="" style={{ maxWidth: 600, maxHeight: 470, objectFit: "contain" }} />
          </div>
        ))}
      {/* The picture fades in from behind the background on its left. */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: 1200,
          height: 630,
          backgroundImage: `linear-gradient(90deg, ${BG} 0%, ${BG} 34%, rgba(11,9,16,0.82) 48%, rgba(11,9,16,0.35) 66%, rgba(11,9,16,0) 84%)`,
        }}
      />
      {/* The site's dusk glow. */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: 1200,
          height: 630,
          backgroundImage:
            "radial-gradient(circle at 18% 0%, rgba(255,79,163,0.22), rgba(255,79,163,0) 55%), radial-gradient(circle at 34% 115%, rgba(122,60,170,0.30), rgba(122,60,170,0) 60%)",
        }}
      />
      {logoUri && (
        // eslint-disable-next-line @next/next/no-img-element -- rendered to PNG, not the page
        <img src={logoUri} alt="" height={70} style={{ position: "absolute", left: 64, top: 56, height: 70 }} />
      )}
      <div style={{ position: "absolute", left: 64, bottom: 62, width: 640, display: "flex", flexDirection: "column" }}>
        {kicker && <div style={{ fontSize: 22, letterSpacing: 4, textTransform: "uppercase", color: "#ff8cc4", marginBottom: 14 }}>{clip(kicker, 40)}</div>}
        <div style={{ fontFamily: "Deco Condensed", fontSize: titleSize, lineHeight: 0.95, textTransform: "uppercase", color: "#f8f0f6" }}>{t}</div>
        {lede && <div style={{ fontSize: 25, lineHeight: 1.45, color: "rgba(248,240,246,0.7)", marginTop: 20 }}>{clip(lede, 150)}</div>}
      </div>
    </div>,
    { ...OG_SIZE, fonts: await fontList },
  );
}
