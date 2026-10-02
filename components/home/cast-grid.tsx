import Link from "next/link";
import type { InfoEntry, MediaItem } from "@/types/content";
import { ResponsiveImage } from "@/components/media/responsive-image";
import { Stagger } from "@/components/motion/reveal";

export interface CastMember {
  entry: InfoEntry;
  image?: MediaItem;
}

/** Portrait cards for the cast: artwork, name and role, nothing else. */
export function CastGrid({ cast }: { cast: CastMember[] }) {
  return (
    <Stagger as="ul" className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 sm:mx-0 sm:grid sm:grid-cols-4 sm:overflow-visible sm:px-0">
      {cast.map(({ entry, image }) => (
        <li key={entry.slug} className="w-[62vw] shrink-0 snap-start sm:w-auto">
          <Link
            href={`/info/characters/${entry.slug}`}
            data-cursor="view"
            data-cursor-label="Profile"
            className="group relative block aspect-[4/5] overflow-hidden rounded-3xl bg-surface-2"
            style={{ backgroundColor: image?.dominantColor ?? undefined }}
          >
            {image && (
              <ResponsiveImage
                item={image}
                sizes="(min-width: 640px) 25vw, 62vw"
                alt=""
                className="transition-transform duration-[1.2s] ease-[var(--ease-out)] group-hover:scale-[1.06]"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/5 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-5">
              <p className="display text-[22px] leading-tight text-white">{entry.name}</p>
              {entry.subtitle && <p className="mt-1 text-[14px] text-white/65">{entry.subtitle}</p>}
            </div>
          </Link>
        </li>
      ))}
    </Stagger>
  );
}
