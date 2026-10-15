import type Database from "better-sqlite3";
import { splitFontName } from "@/lib/media/font-family";
import { slugify } from "@/lib/slug";

/**
 * One-off data fixes for databases created by earlier versions. Each runs
 * once (recorded in `meta`) and must be safe on a fresh database too.
 */
const FIXUPS: { key: string; run: (db: Database.Database) => void }[] = [
  {
    // Fonts used to sit loose in Fonts/; give each family its own folder and split "Family Style" names.
    key: "fixup:font-families",
    run(db) {
      if (!db.prepare("SELECT 1 FROM folders WHERE id = 'fonts'").get()) return;
      const rows = db.prepare("SELECT slug, folder_id, data FROM media WHERE kind = 'font'").all() as { slug: string; folder_id: string; data: string }[];
      const t = Date.now();
      for (const r of rows) {
        const item = JSON.parse(r.data);
        if (!item.font) continue;
        const name = /^regular$/i.test(item.font.style) ? item.font.family : `${item.font.family} ${item.font.style}`;
        const { family, style } = splitFontName(name);
        item.font = { ...item.font, family, style };
        let folder = r.folder_id;
        if (!folder || folder === "fonts") {
          const slug = slugify(family);
          folder = `fonts/${slug}`;
          if (!db.prepare("SELECT 1 FROM folders WHERE parent_id = 'fonts' AND slug = ?").get(slug)) {
            const sort = (db.prepare("SELECT COUNT(*) AS n FROM folders WHERE parent_id = 'fonts'").get() as { n: number }).n;
            db.prepare("INSERT INTO folders (id, parent_id, slug, name, description, cover_slug, sort, created_at, updated_at) VALUES (?, 'fonts', ?, ?, ?, ?, ?, ?, ?)").run(
              folder,
              slug,
              family,
              `Every style of ${family}. Try them with your own text.`,
              r.slug,
              sort,
              t,
              t,
            );
          } else {
            folder = (db.prepare("SELECT id FROM folders WHERE parent_id = 'fonts' AND slug = ?").get(slug) as { id: string }).id;
          }
        }
        item.folderId = folder;
        db.prepare("UPDATE media SET folder_id = ?, data = ?, updated_at = ? WHERE slug = ?").run(folder, JSON.stringify(item), t, r.slug);
      }
    },
  },
];

/* Appended to FIXUPS below (kept separate for readability). */
const NAV_INFO_TOOLS = {
  // The header's "Leonida" link became "Info", and a Tools menu joined the header.
  key: "fixup:nav-info-tools",
  run(db: Database.Database) {
    const row = db.prepare("SELECT value FROM settings WHERE key = 'site'").get() as { value: string } | undefined;
    if (!row) return;
    const site = JSON.parse(row.value);
    if (!Array.isArray(site.nav)) return;
    site.nav = site.nav.map((l: { label: string; href: string }) => (l.href === "/info" && l.label === "Leonida" ? { ...l, label: "Info" } : l));
    if (!site.nav.some((l: { href: string }) => l.href === "/tools")) site.nav.push({ label: "Tools", href: "/tools" });
    db.prepare("UPDATE settings SET value = ? WHERE key = 'site'").run(JSON.stringify(site));
  },
};
FIXUPS.push(NAV_INFO_TOOLS);

FIXUPS.push({
  // Shorter browser-tab title, and a menu that matches the header (Info and Tools instead of Characters and Leonida).
  key: "fixup:title-and-menu",
  run(db: Database.Database) {
    const row = db.prepare("SELECT value FROM settings WHERE key = 'site'").get() as { value: string } | undefined;
    if (!row) return;
    const site = JSON.parse(row.value);
    if (site.title === "GTA 6 Hub — GTA VI news, media archive & Media Viewer") site.title = "GTA 6 Hub";
    const old = ["/", "/news", "/media", "/viewer", "/info/characters", "/info/locations", "/timeline"];
    if (Array.isArray(site.menu) && site.menu.map((l: { href: string }) => l.href).join() === old.join())
      site.menu = [
        { label: "Home", href: "/" },
        { label: "News", href: "/news" },
        { label: "Media", href: "/media" },
        { label: "Viewer", href: "/viewer" },
        { label: "Info", href: "/info" },
        { label: "Tools", href: "/tools" },
        { label: "Timeline", href: "/timeline" },
      ];
    db.prepare("UPDATE settings SET value = ? WHERE key = 'site'").run(JSON.stringify(site));
  },
});

/** Rockstar's official cover art for each trailer, resized on their CDN (?im=Resize=<width>). */
export const TRAILER_ART: Record<string, string> = {
  "gta-vi-trailer-1": "https://videos-rockstargames-com.akamaized.net/v4/rkoCtr1r/art/global.jpg",
  "gta-vi-trailer-2": "https://videos-rockstargames-com.akamaized.net/v4/cpys7u21/art/global.jpg",
  "gta-vi-extended-look": "https://videos-rockstargames-com.akamaized.net/v4/rk721912/art/en-us.jpg",
};

export function trailerArt(base: string) {
  const at = (w: number) => `${base}?im=Resize=${w}`;
  return {
    poster: { url: at(1920), width: 1920, height: 1080, mimeType: "image/jpeg", filename: "poster.jpg" },
    variants: [480, 960, 1920].map((w) => ({ url: at(w), width: w, height: Math.round((w * 9) / 16), format: "jpeg" as const })),
  };
}

FIXUPS.push({
  // Trailer thumbnails now use Rockstar's official cover art instead of frames grabbed from the video.
  key: "fixup:trailer-art",
  run(db: Database.Database) {
    const t = Date.now();
    for (const [slug, base] of Object.entries(TRAILER_ART)) {
      const row = db.prepare("SELECT data FROM media WHERE slug = ?").get(slug) as { data: string } | undefined;
      if (!row) continue;
      const item = { ...JSON.parse(row.data), ...trailerArt(base) };
      db.prepare("UPDATE media SET data = ?, updated_at = ? WHERE slug = ?").run(JSON.stringify(item), t, slug);
    }
  },
});

FIXUPS.push({
  // English subtitles for the three trailers (files in public/media/<slug>/).
  key: "fixup:trailer-subtitles",
  run(db: Database.Database) {
    const t = Date.now();
    for (const slug of Object.keys(TRAILER_ART)) {
      const row = db.prepare("SELECT data FROM media WHERE slug = ?").get(slug) as { data: string } | undefined;
      if (!row) continue;
      const item = { ...JSON.parse(row.data), subtitles: [{ url: `/media/${slug}/subtitles.en.vtt`, lang: "en", label: "English" }] };
      db.prepare("UPDATE media SET data = ?, updated_at = ? WHERE slug = ?").run(JSON.stringify(item), t, slug);
    }
  },
});

FIXUPS.push({
  // Trailer 1 used to stream through /api/video on this server; it now loads straight from its CDN.
  key: "fixup:trailer-1-direct",
  run(db: Database.Database) {
    const row = db.prepare("SELECT data FROM media WHERE slug = 'gta-vi-trailer-1'").get() as { data: string } | undefined;
    if (!row) return;
    const item = JSON.parse(row.data);
    if (item.original?.url !== "/api/video/gta-vi-trailer-1") return;
    item.original.url = "https://cdn.invincible25.com/GTAVI_Trailer1.mp4";
    db.prepare("UPDATE media SET data = ?, updated_at = ? WHERE slug = 'gta-vi-trailer-1'").run(JSON.stringify(item), Date.now());
  },
});

export function runFixups(db: Database.Database) {
  const done = db.prepare("SELECT 1 FROM meta WHERE key = ?");
  for (const f of FIXUPS) {
    if (done.get(f.key)) continue;
    db.transaction(() => {
      if (done.get(f.key)) return;
      f.run(db);
      db.prepare("INSERT INTO meta (key, value) VALUES (?, '1')").run(f.key);
      db.prepare("INSERT INTO meta (key, value) VALUES ('content_version', '1') ON CONFLICT(key) DO UPDATE SET value = CAST(value AS INTEGER) + 1").run();
    }).immediate();
  }
}
