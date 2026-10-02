import Link from "next/link";
import type { InfoEntry, MediaItem } from "@/types/content";
import { ResponsiveImage } from "@/components/media/responsive-image";
import { Stagger } from "@/components/motion/reveal";

export interface RegionCard {
  entry: InfoEntry;
  image?: MediaItem;
  count: number;
}

/** The regions as a grid of postcards; a swipeable row on phones. */
export function RegionRow({ regions }: { regions: RegionCard[] }) {
  return (
    <Stagger as="ul" className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-3">
      {regions.map(({ entry, image, count }) => (
        <li key={entry.slug} className="w-[78vw] shrink-0 snap-start sm:w-auto">
          <Link
            href={`/info/locations/${entry.slug}`}
            data-cursor="view"
            data-cursor-label="Explore"
            className="group relative block aspect-[16/10] overflow-hidden rounded-3xl bg-surface-2"
            style={{ backgroundColor: image?.dominantColor ?? undefined }}
          >
            {image && (
              <ResponsiveImage
                item={image}
                sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 78vw"
                alt=""
                className="transition-transform duration-[1.2s] ease-[var(--ease-out)] group-hover:scale-[1.05]"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-5 lg:p-6">
              <p className="display text-[22px] leading-tight text-white">{entry.name}</p>
              {count > 0 && <p className="mt-1 text-[14px] text-white/65">{count} shots</p>}
            </div>
          </Link>
        </li>
      ))}
    </Stagger>
  );
}
