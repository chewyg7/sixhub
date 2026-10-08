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
