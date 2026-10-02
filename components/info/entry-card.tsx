import Link from "next/link";
import type { InfoEntry, MediaItem } from "@/types/content";
import { cn } from "@/lib/cn";
import { MediaThumb } from "@/components/media/media-thumb";

/** Card for a database entry. Uses the entry's image when one exists, otherwise a typographic tile. */
export function EntryCard({ entry, image, layout = "profile", mediaCount }: { entry: InfoEntry; image?: MediaItem; layout?: "profile" | "place" | "row"; mediaCount?: number }) {
  const href = `/info/${entry.section}/${entry.slug}`;
  if (layout === "row") {
    return (
      <Link href={href} className="group flex items-start justify-between gap-6 border-b border-divider py-5">
        <div>
          <p className="text-[17px] font-semibold group-hover:underline group-hover:decoration-border-strong group-hover:underline-offset-4">{entry.name}</p>
          {entry.subtitle && <p className="mt-0.5 text-[13px] text-muted">{entry.subtitle}</p>}
          <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-muted">{entry.summary}</p>
        </div>
        {image && <MediaThumb item={image} sizes="160px" aspect="16 / 10" className="hidden w-40 shrink-0 sm:block" showKind={false} rounded="rounded-md" />}
      </Link>
    );
  }
  const initials = entry.name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2);
  return (
    <Link href={href} className="group block">
      {image ? (
        <MediaThumb item={image} sizes="(min-width: 1024px) 25vw, 50vw" aspect={layout === "profile" ? "3 / 4" : "16 / 10"} showKind={false} rounded="rounded-xl" />
      ) : (
        <div
          className={cn(
            "flex items-end rounded-xl border border-divider bg-surface p-4 transition-colors group-hover:bg-surface-2",
            layout === "profile" ? "aspect-[3/4]" : "aspect-[16/10]",
          )}
        >
          <span className="display-tight text-[64px] text-surface-active transition-colors group-hover:text-border-strong" aria-hidden>
            {initials}
          </span>
        </div>
      )}
      <p className="mt-3 text-[16px] leading-tight font-semibold">{entry.name}</p>
      <p className="mt-0.5 text-[12.5px] text-muted">
        {entry.subtitle}
        {mediaCount ? ` · ${mediaCount} media` : ""}
      </p>
    </Link>
  );
}
