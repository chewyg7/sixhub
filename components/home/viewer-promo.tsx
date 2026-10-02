import Link from "next/link";
import { ArrowRight, Crop, Pause, ScanSearch, StepBack, StepForward } from "lucide-react";
import type { MediaItem } from "@/types/content";
import { formatDuration } from "@/lib/format";
import { ResponsiveImage } from "@/components/media/responsive-image";
import { MediaThumb } from "@/components/media/media-thumb";
import { viewerHref } from "@/components/media/media-links";
import { RevealImage, SplitReveal } from "@/components/motion/reveal";

/** The Media Viewer pitch, shown as the tool itself rather than described. */
export function ViewerPromo({ still, picks }: { still: MediaItem; picks: MediaItem[] }) {
  return (
    <section aria-labelledby="viewer-h" className="relative overflow-hidden rounded-[36px] border border-white/10 bg-white/[0.03]">
      <div aria-hidden className="pointer-events-none absolute -top-32 -right-32 size-[520px] rounded-full bg-[radial-gradient(closest-side,rgb(244_162_197/0.18),transparent)]" />
      <div className="relative grid gap-10 p-6 sm:p-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14 lg:p-14">
        <div className="flex flex-col">
          <p className="kicker">The Media Viewer</p>
          <SplitReveal id="viewer-h" by="chars" className="display-xl mt-4 text-[64px] sm:text-[110px]">
            Frame by <span className="text-accent">frame</span>
          </SplitReveal>
          <p className="mt-5 max-w-md text-[16px] leading-relaxed text-muted">
            Step through every frame, zoom to the pixel, crop and capture at full resolution, and compare two shots side by side.
          </p>
          <ul className="mt-8 grid grid-cols-2 gap-x-6 gap-y-3 text-[14px] font-semibold text-text">
            {["Frame-exact stepping", "400% pixel zoom", "Crop & capture", "Slider compare"].map((f) => (
              <li key={f} className="flex items-center gap-2.5">
                <span className="size-1.5 rounded-full bg-[image:var(--sunset)]" />
                {f}
              </li>
            ))}
          </ul>
          <div className="mt-auto pt-10">
            <Link
              href="/viewer"
              className="group inline-flex h-12 items-center gap-2 rounded-full bg-[image:var(--sunset)] px-6 text-[15px] font-bold text-on-accent transition-transform hover:scale-[1.03]"
            >
              Open the Media Viewer <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>

        {/* A live-looking mock of the viewer: real image, crop box, transport. */}
        <RevealImage from="center" className="rounded-3xl">
          <div aria-hidden className="overflow-hidden rounded-3xl border border-white/15 bg-canvas shadow-[var(--elev-lg)]">
            <div className="flex h-9 items-center gap-2 border-b border-white/10 px-3 text-[11px] text-white/60">
              <span className="size-2.5 rounded-full bg-white/15" />
              <span className="size-2.5 rounded-full bg-white/15" />
              <span className="ml-2 font-semibold text-white/80">{still.title}</span>
              <span className="ml-auto">400%</span>
            </div>
            <div className="relative aspect-[16/9] overflow-hidden">
              <ResponsiveImage item={still} sizes="(min-width: 1024px) 50vw, 100vw" alt="" className="scale-[1.35] [image-rendering:auto]" />
              <div className="absolute top-[22%] left-[30%] h-[46%] w-[38%] border border-white shadow-[0_0_0_9999px_rgb(0_0_0/0.5)]">
                <span className="absolute -top-6 left-0 rounded bg-black/75 px-1.5 py-0.5 text-[10px] text-white">1456 × 824 px</span>
                {["-top-1 -left-1", "-top-1 -right-1", "-bottom-1 -left-1", "-bottom-1 -right-1"].map((p) => (
                  <span key={p} className={`absolute size-2 bg-white ${p}`} />
                ))}
              </div>
              <span className="absolute top-3 right-3 flex items-center gap-1.5 rounded-md bg-black/60 px-2 py-1 text-[11px] text-white backdrop-blur-sm">
                <Crop className="size-3" /> Crop
              </span>
            </div>
            <div className="border-t border-white/10 px-3 pt-2 pb-3">
              <div className="relative h-1 rounded-full bg-white/15">
                <div className="absolute inset-y-0 left-0 w-[38%] rounded-full bg-[image:var(--sunset)]" />
                <div className="absolute top-1/2 left-[38%] size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" />
              </div>
              <div className="mt-2.5 flex items-center gap-3 text-[11px] text-white/70">
                <StepBack className="size-3.5" />
                <Pause className="size-3.5 fill-current" />
                <StepForward className="size-3.5" />
                <span className="text-white">00:00:09.200</span>
                <span>F 276</span>
                <span className="ml-auto">30 fps</span>
              </div>
            </div>
          </div>
        </RevealImage>
      </div>

      <div className="relative border-t border-border px-6 py-5 sm:px-10 lg:px-14">
        <p className="kicker mb-3">Jump straight in</p>
        <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {picks.map((m) => (
            <li key={m.slug}>
              <Link href={viewerHref(m.slug)} className="group flex items-center gap-3 rounded-xl p-1.5 transition-colors hover:bg-surface-hover">
                <MediaThumb item={m} sizes="96px" aspect="16 / 10" className="w-20 shrink-0" rounded="rounded-lg" showKind={false} />
                <div className="min-w-0">
                  <p className="truncate text-[13.5px] font-bold">{m.title}</p>
                  <p className="tabular text-[11px] text-faint">{m.kind === "video" ? `${formatDuration(m.video?.duration)} · ${m.video?.fps} fps` : `${m.width}×${m.height}`}</p>
                </div>
                <ScanSearch className="ml-auto hidden size-4 shrink-0 text-faint group-hover:text-accent-text sm:block" />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
