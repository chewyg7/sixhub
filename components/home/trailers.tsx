import Link from "next/link";
import { ArrowUpRight, Play } from "lucide-react";
import type { MediaItem } from "@/types/content";
import { formatDate, formatDuration } from "@/lib/format";
import { cn } from "@/lib/cn";
import { ResponsiveImage } from "@/components/media/responsive-image";
import { LightboxTrigger } from "@/components/media/lightbox-trigger";
import { viewerHref } from "@/components/media/media-links";
import { RevealImage, Stagger } from "@/components/motion/reveal";

/** Newest trailer as a cinematic frame; the others listed beside it. */
export function Trailers({ trailers }: { trailers: MediaItem[] }) {
  const [lead] = trailers;
  if (!lead) return null;
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
      <RevealImage className="rounded-[28px]">
        <LightboxTrigger
          items={trailers}
          index={0}
          label={`Play ${lead.title}`}
          className="group relative isolate block aspect-video w-full overflow-hidden rounded-[28px] bg-surface-2 text-left"
        >
          <span data-cursor="play" className="absolute inset-0 z-10" />
          <div className="absolute inset-0 -z-10" style={{ backgroundColor: lead.dominantColor ?? undefined }}>
            <ResponsiveImage
              item={lead}
              sizes="(min-width: 1024px) 66vw, 100vw"
              alt=""
              className="transition-transform duration-[1.4s] ease-[var(--ease-out)] group-hover:scale-[1.05]"
            />
          </div>
          <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/85 via-black/10 to-black/25" />
          <span className="absolute top-1/2 left-1/2 flex size-24 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white ring-1 ring-white/40 backdrop-blur-xl transition-[transform,background-color] duration-500 group-hover:scale-110 group-hover:bg-accent sm:size-28">
            <Play className="ml-1 size-9 fill-current" />
          </span>
          <div className="absolute inset-x-0 bottom-0 p-6 sm:p-9">
            <p className="display-xl text-[52px] text-white sm:text-[96px]">{lead.title}</p>
            <p className="mt-3 text-[15px] text-white/75">
              {formatDate(lead.datePublished)} · {formatDuration(lead.video?.duration)}
            </p>
          </div>
        </LightboxTrigger>
      </RevealImage>

      <Stagger as="ol" className="flex flex-col gap-3">
        {trailers.map((t, i) => (
          <li key={t.slug} className={cn("group relative flex gap-4 rounded-3xl p-3 transition-colors hover:bg-white/[0.05]", i === 0 && "bg-white/[0.04]")}>
            <LightboxTrigger items={trailers} index={i} label={`Play ${t.title}`} className="relative aspect-video w-36 shrink-0 overflow-hidden rounded-2xl bg-surface-2">
              <ResponsiveImage item={t} sizes="160px" alt="" className="transition-transform duration-700 group-hover:scale-110" />
              <span className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                <Play className="size-6 fill-white text-white" />
              </span>
            </LightboxTrigger>
            <div className="min-w-0 py-1">
              <p className="display truncate text-[22px]">{t.title}</p>
              <p className="mt-1 text-[14px] text-muted">
                {formatDate(t.datePublished)} · {formatDuration(t.video?.duration)}
              </p>
              <Link href={viewerHref(t.slug)} className="mt-2 inline-flex items-center gap-1.5 text-[14px] font-bold text-accent-text">
                Frame by frame <ArrowUpRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
            </div>
          </li>
        ))}
      </Stagger>
    </div>
  );
}
