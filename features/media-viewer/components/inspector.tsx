"use client";

import Link from "next/link";
import { useId, useState, type ReactNode } from "react";
import {
  ArrowLeftRight,
  ChevronDown,
  Copy,
  Download,
  ExternalLink,
  FlipHorizontal2,
  FlipVertical2,
  ImagePlus,
  RotateCcw,
  RotateCw,
  ScanLine,
  Trash2,
  X,
  ZoomIn,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { aspectRatioLabel, formatBitrate, formatBytes, formatDate, formatDuration, formatFps, formatMegapixels, formatResolution } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Segmented, Select, Slider, Switch } from "@/components/ui/controls";
import type { AspectKey, CompareMode, Rect } from "../types";
import { mediaSize, useConcreteView, useViewer, type InspectorSection } from "../store";
import { player } from "../controller";
import { clampRect, roundRect } from "../lib/geometry";
import { isDefaultAdjust } from "../lib/filters";
import { downloadBlob } from "../lib/capture";
import { useViewerActions } from "../use-actions";
import { SPEEDS } from "./transport";

function Section({ id, title, children, action }: { id: InspectorSection; title: string; children: ReactNode; action?: ReactNode }) {
  const collapsed = useViewer((s) => s.collapsed[id]);
  const toggle = useViewer((s) => s.toggleSection);
  const bodyId = useId();
  return (
    <section className="border-b border-divider" aria-label={title}>
      <div className="flex h-10 items-center justify-between pr-2 pl-4">
        <button
          type="button"
          onClick={() => toggle(id)}
          aria-expanded={!collapsed}
          aria-controls={bodyId}
          className="flex flex-1 items-center gap-1.5 text-left text-[12.5px] font-semibold text-text"
        >
          <ChevronDown className={cn("size-3.5 text-muted transition-transform duration-200", collapsed && "-rotate-90")} />
          {title}
        </button>
        {action}
      </div>
      <div id={bodyId} hidden={collapsed} className="px-4 pb-4">
        {children}
      </div>
    </section>
  );
}

const ResetButton = ({ onClick, disabled, label }: { onClick: () => void; disabled?: boolean; label: string }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="rounded px-1.5 py-0.5 text-[11.5px] font-medium text-muted hover:bg-surface-hover hover:text-text disabled:opacity-0"
  >
    {label}
  </button>
);

/* ------------------------------------------------------------------ */
function ViewSection() {
  const view = useConcreteView("a");
  const zoomTo = useViewer((s) => s.zoomTo);
  const fit = useViewer((s) => s.fit);
  const pixelated = useViewer((s) => s.pixelated);
  const minimap = useViewer((s) => s.minimap);
  const background = useViewer((s) => s.background);
  const set = useViewer((s) => s.set);
  const [input, setInput] = useState<string | null>(null);
  const pct = view ? Math.round(view.scale * 1000) / 10 : 100;
  return (
    <Section id="view" title="View">
      <div className="flex items-center gap-2">
        <label className="sr-only" htmlFor="zoom-input">
          Zoom percent
        </label>
        <input
          id="zoom-input"
          value={input ?? `${pct}%`}
          onFocus={() => setInput(String(pct))}
          onChange={(e) => setInput(e.target.value)}
          onBlur={() => setInput(null)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const v = parseFloat(input ?? "");
              if (v > 0) zoomTo(v / 100);
              (e.target as HTMLInputElement).blur();
            }
          }}
          className="tabular h-8 w-20 rounded-md border border-border bg-surface px-2 font-mono text-[12.5px] outline-none focus:border-border-strong"
        />
        <div className="grid flex-1 grid-cols-5 gap-1">
          {[
            ["Fit", () => fit("fit")],
            ["Fill", () => fit("fill")],
            ["100", () => zoomTo(1)],
            ["200", () => zoomTo(2)],
            ["400", () => zoomTo(4)],
          ].map(([l, fn]) => (
            <button key={l as string} type="button" onClick={fn as () => void} className="h-8 rounded-md bg-surface-3 text-[11.5px] font-medium text-text hover:bg-surface-hover">
              {l as string}
              {l !== "Fit" && l !== "Fill" && "%"}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-3 space-y-2.5">
        <Switch label="Pixel inspection" description="Sharp pixels above 200%" checked={pixelated} onChange={(v) => set({ pixelated: v })} />
        <Switch label="Navigator" description="Minimap when zoomed in" checked={minimap} onChange={(v) => set({ minimap: v })} />
      </div>
      <p className="mt-3 mb-1.5 text-[12px] text-muted">Background</p>
      <Segmented
        label="Background"
        size="sm"
        stretch
        value={background}
        onChange={(v) => set({ background: v })}
        options={[
          { value: "dark", label: "Dark" },
          { value: "checker", label: "Checker" },
          { value: "light", label: "Light" },
        ]}
      />
    </Section>
  );
}

function TransformSection() {
  const t = useViewer((s) => s.transform);
  const rotate = useViewer((s) => s.rotate);
  const flip = useViewer((s) => s.flip);
  const reset = useViewer((s) => s.resetTransform);
  const changed = t.rotation !== 0 || t.flipH || t.flipV;
  return (
    <Section id="transform" title="Transform" action={<ResetButton label="Reset" onClick={reset} disabled={!changed} />}>
      <div className="flex items-center gap-1">
        <IconButton label="Rotate left" shortcut="⇧R" variant="secondary" size="icon-sm" onClick={() => rotate(-1)}>
          <RotateCcw />
        </IconButton>
        <IconButton label="Rotate right" shortcut="R" variant="secondary" size="icon-sm" onClick={() => rotate(1)}>
          <RotateCw />
        </IconButton>
        <IconButton label="Flip horizontal" shortcut="H" variant="secondary" size="icon-sm" pressed={t.flipH} onClick={() => flip("h")}>
          <FlipHorizontal2 />
        </IconButton>
        <IconButton label="Flip vertical" shortcut="⇧H" variant="secondary" size="icon-sm" pressed={t.flipV} onClick={() => flip("v")}>
          <FlipVertical2 />
        </IconButton>
        <span className="tabular ml-auto font-mono text-[12px] text-muted">{t.rotation}°</span>
      </div>
    </Section>
  );
}

function AdjustSection() {
  const a = useViewer((s) => s.adjust);
  const set = useViewer((s) => s.setAdjust);
  const reset = useViewer((s) => s.resetAdjust);
  const pct = (v: number) => `${v}%`;
  return (
    <Section id="adjust" title="Adjust" action={<ResetButton label="Reset all" onClick={reset} disabled={isDefaultAdjust(a)} />}>
      <div className="space-y-2.5">
        <Slider label="Brightness" value={a.brightness} min={0} max={300} onChange={(v) => set({ brightness: v })} defaultValue={100} format={pct} />
        <Slider label="Contrast" value={a.contrast} min={0} max={300} onChange={(v) => set({ contrast: v })} defaultValue={100} format={pct} />
        <Slider label="Saturation" value={a.saturation} min={0} max={300} onChange={(v) => set({ saturation: v })} defaultValue={100} format={pct} />
        <Slider
          label="Exposure"
          value={a.exposure}
          min={-3}
          max={3}
          step={0.1}
          onChange={(v) => set({ exposure: v })}
          defaultValue={0}
          format={(v) => `${v > 0 ? "+" : ""}${v.toFixed(1)} EV`}
        />
        <Slider label="Sharpness" value={a.sharpness} min={0} max={100} onChange={(v) => set({ sharpness: v })} defaultValue={0} />
        <Slider label="Grayscale" value={a.grayscale} min={0} max={100} onChange={(v) => set({ grayscale: v })} defaultValue={0} format={pct} />
        <Switch label="Invert colors" checked={a.invert} onChange={(v) => set({ invert: v })} />
      </div>
      <p className="mt-3 text-[11.5px] leading-relaxed text-faint">Display only — the source file is never modified.</p>
    </Section>
  );
}

function PlaybackSection() {
  const rate = useViewer((s) => s.playback.rate);
  const loop = useViewer((s) => s.playback.loop);
  const volume = useViewer((s) => s.playback.volume);
  const muted = useViewer((s) => s.playback.muted);
  const [custom, setCustom] = useState("");
  return (
    <Section id="playback" title="Playback">
      <p className="mb-1.5 text-[12px] text-muted">Speed</p>
      <div className="grid grid-cols-4 gap-1">
        {SPEEDS.map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={rate === s}
            onClick={() => player.setRate(s)}
            className={cn("tabular h-7 rounded-md font-mono text-[11.5px]", rate === s ? "bg-text text-bg" : "bg-surface-3 hover:bg-surface-hover")}
          >
            {s}×
          </button>
        ))}
      </div>
      <form
        className="mt-2 flex gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          const v = parseFloat(custom);
          if (v > 0) player.setRate(v);
          setCustom("");
        }}
      >
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          inputMode="decimal"
          placeholder={`Custom (now ${+rate.toFixed(3)}×)`}
          aria-label="Custom speed"
          className="h-8 min-w-0 flex-1 rounded-md border border-border bg-surface px-2 font-mono text-[12px] outline-none focus:border-border-strong"
        />
        <Button type="submit" size="sm">
          Set
        </Button>
      </form>
      <div className="mt-3 space-y-2.5">
        <Slider label="Volume" value={Math.round((muted ? 0 : volume) * 100)} min={0} max={100} onChange={(v) => player.setVolume(v / 100)} format={(v) => `${v}%`} />
        <Switch label="Loop" checked={loop} onChange={(v) => player.setLoop(v)} />
      </div>
    </Section>
  );
}

const ASPECTS: { value: AspectKey; label: string }[] = [
  { value: "free", label: "Free" },
  { value: "16:9", label: "16:9" },
  { value: "4:3", label: "4:3" },
  { value: "1:1", label: "1:1" },
  { value: "9:16", label: "9:16" },
  { value: "custom", label: "Custom" },
];

function CropSection() {
  const crop = useViewer((s) => s.crop);
  const tool = useViewer((s) => s.tool);
  const mediaA = useViewer((s) => s.a);
  const size = mediaSize(mediaA);
  const setTool = useViewer((s) => s.setTool);
  const setCrop = useViewer((s) => s.setCrop);
  const setAspect = useViewer((s) => s.setAspect);
  const zoomToRect = useViewer((s) => s.zoomToRect);
  const actions = useViewerActions();
  const r = crop.rect ? roundRect(crop.rect) : null;
  const edit = (k: keyof Rect, v: number) => r && size && setCrop({ rect: clampRect({ ...r, [k]: v }, size) });
  return (
    <Section
      id="crop"
      title="Crop"
      action={
        <Button size="xs" variant={tool === "crop" ? "primary" : "secondary"} onClick={() => setTool(tool === "crop" ? "pan" : "crop")}>
          {tool === "crop" ? "Done" : "Crop tool"}
        </Button>
      }
    >
      <div className="grid grid-cols-3 gap-1">
        {ASPECTS.map((a) => (
          <button
            key={a.value}
            type="button"
            aria-pressed={crop.aspect === a.value}
            onClick={() => setAspect(a.value)}
            className={cn("h-7 rounded-md text-[11.5px] font-medium", crop.aspect === a.value ? "bg-text text-bg" : "bg-surface-3 hover:bg-surface-hover")}
          >
            {a.label}
          </button>
        ))}
      </div>
      {crop.aspect === "custom" && (
        <div className="mt-2 flex items-center gap-1.5 text-[12px] text-muted">
          <input
            type="number"
            min={1}
            value={crop.custom[0]}
            onChange={(e) => setCrop({ custom: [Math.max(1, Number(e.target.value)), crop.custom[1]] })}
            aria-label="Ratio width"
            className="h-8 w-16 rounded-md border border-border bg-surface px-2 font-mono text-text"
          />
          :
          <input
            type="number"
            min={1}
            value={crop.custom[1]}
            onChange={(e) => setCrop({ custom: [crop.custom[0], Math.max(1, Number(e.target.value))] })}
            aria-label="Ratio height"
            className="h-8 w-16 rounded-md border border-border bg-surface px-2 font-mono text-text"
          />
          <Button size="xs" variant="ghost" onClick={() => setAspect("custom")}>
            Apply
          </Button>
        </div>
      )}
      {r ? (
        <>
          <div className="mt-3 grid grid-cols-4 gap-1.5">
            {(["x", "y", "w", "h"] as const).map((k) => (
              <label key={k} className="text-[11px] text-faint uppercase">
                {k}
                <input
                  type="number"
                  value={r[k]}
                  onChange={(e) => edit(k, Number(e.target.value))}
                  className="tabular mt-0.5 h-7 w-full rounded-md border border-border bg-surface px-1.5 font-mono text-[11.5px] text-text normal-case"
                />
              </label>
            ))}
          </div>
          <p className="tabular mt-2 font-mono text-[11.5px] text-muted">
            {r.w} × {r.h} px · {aspectRatioLabel(r.w, r.h)}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-1.5">
            <Button size="sm" variant="primary" onClick={() => actions.exportCrop("download")}>
              <Download /> Save
            </Button>
            <Button size="sm" onClick={() => actions.exportCrop("copy")}>
              <Copy /> Copy
            </Button>
            <Button size="sm" onClick={() => actions.exportCrop("open")}>
              <ImagePlus /> Open
            </Button>
            <Button size="sm" onClick={() => crop.rect && zoomToRect(crop.rect)}>
              <ZoomIn /> Zoom to
            </Button>
          </div>
          <Button size="xs" variant="ghost" className="mt-1.5 w-full" onClick={() => setCrop({ rect: null })}>
            Clear selection
          </Button>
        </>
      ) : (
        <p className="mt-3 text-[12px] leading-relaxed text-muted">
          {tool === "crop" ? "Drag on the media to select an area." : "Press C or choose Crop tool, then drag on the media."}
        </p>
      )}
    </Section>
  );
}

function CaptureSection() {
  const kind = useViewer((s) => s.a?.kind);
  const captures = useViewer((s) => s.captures);
  const opts = useViewer((s) => s.captureOptions);
  const setOpts = useViewer((s) => s.setCaptureOptions);
  const remove = useViewer((s) => s.removeCapture);
  const actions = useViewerActions();
  return (
    <Section id="capture" title={kind === "video" ? "Frame capture" : "Export"}>
      <div className="grid grid-cols-2 gap-1.5">
        <Button size="sm" variant="primary" onClick={() => actions.captureFrame("download")}>
          <Download /> Save {kind === "video" ? "frame" : "image"}
        </Button>
        <Button size="sm" onClick={() => actions.captureFrame("copy")}>
          <Copy /> Copy
        </Button>
        {kind === "video" && (
          <>
            <Button size="sm" onClick={() => actions.captureFrame("open")}>
              <ImagePlus /> Open as image
            </Button>
            <Button size="sm" onClick={() => actions.captureFrame("compare")}>
              <ArrowLeftRight /> Pin as B
            </Button>
          </>
        )}
      </div>
      <div className="mt-3 space-y-2.5">
        <Switch label="Apply adjustments" description="Include filters, rotation and flips" checked={opts.applyAdjust} onChange={(v) => setOpts({ applyAdjust: v })} />
        <div className="flex items-center justify-between">
          <span className="text-[13px]">Format</span>
          <Select value={opts.format} onChange={(e) => setOpts({ format: e.target.value as typeof opts.format })} aria-label="Export format">
            <option value="image/png">PNG (lossless)</option>
            <option value="image/jpeg">JPEG</option>
            <option value="image/webp">WebP</option>
          </Select>
        </div>
      </div>
      <p className="mt-2 text-[11.5px] text-faint">Captured at the source&apos;s native resolution.</p>
      {captures.length > 0 && (
        <>
          <p className="mt-4 mb-1.5 text-[12px] text-muted">This session</p>
          <ul className="grid grid-cols-2 gap-1.5">
            {captures.map((c) => (
              <li key={c.id} className="group relative">
                <button
                  type="button"
                  onClick={() => actions.openCapture(c)}
                  aria-label={`Open capture ${c.title}`}
                  className="block w-full overflow-hidden rounded-md bg-surface-3"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- blob preview */}
                  <img src={c.url} alt="" className="aspect-video w-full object-cover" />
                </button>
                <p className="tabular mt-0.5 truncate font-mono text-[10.5px] text-faint">{c.frame !== undefined ? `F${c.frame}` : `${c.width}×${c.height}`}</p>
                <div className="absolute top-1 right-1 flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                  <button type="button" aria-label="Download capture" onClick={() => downloadBlob(c.blob, `${c.title}.png`)} className="rounded bg-black/70 p-1 text-white">
                    <Download className="size-3" />
                  </button>
                  <button type="button" aria-label="Remove capture" onClick={() => remove(c.id)} className="rounded bg-black/70 p-1 text-white">
                    <Trash2 className="size-3" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </Section>
  );
}

function CompareSection({ onOpenFile }: { onOpenFile: (pane: "a" | "b") => void }) {
  const compare = useViewer((s) => s.compare);
  const b = useViewer((s) => s.b);
  const aKind = useViewer((s) => s.a?.kind);
  const setCompare = useViewer((s) => s.setCompare);
  const swap = useViewer((s) => s.swap);
  const load = useViewer((s) => s.load);
  const actions = useViewerActions();
  const timed = b && b.kind !== "image" && aKind !== "image";
  return (
    <Section
      id="compare"
      title="Compare"
      action={<Switch label="Enable comparison" checked={compare.enabled} onChange={(v) => setCompare({ enabled: v })} className="[&_label]:sr-only" />}
    >
      {!compare.enabled ? (
        <p className="text-[12px] leading-relaxed text-muted">Turn on to compare two assets — side by side, overlaid or with a slider. Press X.</p>
      ) : (
        <div className="space-y-3">
          <div className="rounded-md border border-border p-2.5">
            <p className="text-[11px] font-semibold tracking-wider text-faint uppercase">B</p>
            <p className="mt-0.5 truncate text-[13px]">{b ? b.title : "Nothing loaded"}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              <Button size="xs" onClick={() => onOpenFile("b")}>
                Open file
              </Button>
              {aKind === "video" && (
                <Button size="xs" onClick={() => actions.captureFrame("compare")}>
                  Current frame
                </Button>
              )}
              {b && (
                <IconButton label="Remove B" size="icon-xs" onClick={() => load("b", null)}>
                  <X />
                </IconButton>
              )}
            </div>
            {!b && <p className="mt-2 text-[11.5px] text-faint">Or use the compare button on any item in the media browser.</p>}
          </div>
          <Segmented<CompareMode>
            label="Comparison mode"
            size="sm"
            stretch
            value={compare.mode}
            onChange={(mode) => setCompare({ mode })}
            options={[
              { value: "side", label: "Side by side" },
              { value: "overlay", label: "Overlay" },
              { value: "slider", label: "Slider" },
            ]}
          />
          {compare.mode === "overlay" && (
            <>
              <Slider
                label="B opacity"
                value={Math.round(compare.opacity * 100)}
                min={0}
                max={100}
                onChange={(v) => setCompare({ opacity: v / 100 })}
                defaultValue={50}
                format={(v) => `${v}%`}
              />
              <Segmented
                label="Blend"
                size="sm"
                stretch
                value={compare.blend}
                onChange={(blend) => setCompare({ blend })}
                options={[
                  { value: "normal", label: "Normal" },
                  { value: "difference", label: "Difference" },
                ]}
              />
            </>
          )}
          {compare.mode === "slider" && (
            <Slider
              label="Divider"
              value={Math.round(compare.split * 100)}
              min={0}
              max={100}
              onChange={(v) => setCompare({ split: v / 100 })}
              defaultValue={50}
              format={(v) => `${v}%`}
            />
          )}
          {compare.mode === "side" && <Switch label="Sync zoom & pan" checked={compare.sync} onChange={(v) => setCompare({ sync: v })} />}
          {timed && (
            <>
              <Switch label="Link playback" description="B follows A's play, pause and seek" checked={compare.linkPlayback} onChange={(v) => setCompare({ linkPlayback: v })} />
              {compare.linkPlayback && (
                <label className="flex items-center justify-between text-[13px]">
                  Offset (s)
                  <input
                    type="number"
                    step={0.1}
                    value={compare.offset}
                    onChange={(e) => setCompare({ offset: Number(e.target.value) })}
                    className="tabular h-8 w-24 rounded-md border border-border bg-surface px-2 font-mono text-[12px]"
                  />
                </label>
              )}
            </>
          )}
          <Button size="sm" variant="secondary" className="w-full" onClick={swap} disabled={!b}>
            <ArrowLeftRight /> Swap A and B
          </Button>
        </div>
      )}
    </Section>
  );
}

function InfoSection() {
  const media = useViewer((s) => s.a);
  if (!media) return null;
  const m = media.meta;
  const fpsNote = m.fpsSource === "container" ? " (from file)" : m.fpsSource === "measured" ? " (measured)" : m.fpsSource === "assumed" ? " (assumed)" : "";
  const rows: [string, string | undefined][] = [
    ["Filename", m.filename],
    ["Resolution", m.width ? `${formatResolution(m.width, m.height)} px` : undefined],
    ["Aspect ratio", m.width ? aspectRatioLabel(m.width, m.height) : undefined],
    ["Megapixels", media.kind === "image" && m.width ? formatMegapixels(m.width, m.height) : undefined],
    ["Duration", m.duration ? formatDuration(m.duration) : undefined],
    ["Frame rate", media.kind === "video" && m.fps ? `${formatFps(m.fps)}${fpsNote}` : undefined],
    ["Frames", m.frameCount?.toLocaleString("en-US")],
    ["Video codec", m.videoCodec],
    ["Audio codec", m.audioCodec],
    ["Audio", m.sampleRate ? `${m.sampleRate / 1000} kHz${m.channels ? ` · ${m.channels === 2 ? "stereo" : m.channels === 1 ? "mono" : `${m.channels} ch`}` : ""}` : undefined],
    ["Bitrate", m.bitrate ? formatBitrate(m.bitrate) : undefined],
    ["File type", m.mimeType],
    ["File size", m.bytes ? formatBytes(m.bytes) : undefined],
    ["Transparency", m.hasAlpha ? "Alpha channel" : undefined],
    ["Source", m.source],
    ["Released", m.released ? formatDate(m.released) : undefined],
    ["Modified", m.lastModified ? new Date(m.lastModified).toLocaleString() : undefined],
  ];
  return (
    <Section id="info" title="Media info">
      {media.item?.verification === "community" && <p className="mb-2 rounded-md bg-warning/10 px-2.5 py-1.5 text-[11.5px] text-warning">Community made — not official Rockstar media.</p>}
      {!media.cors && (
        <p className="mb-2 rounded-md bg-surface-3 px-2.5 py-1.5 text-[11.5px] text-muted">
          This remote source blocks pixel access, so capture, crop export and colour picking are unavailable.
        </p>
      )}
      <dl className="grid grid-cols-[92px_1fr] gap-x-3 gap-y-1.5 text-[12px]">
        {rows
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-muted">{k}</dt>
              <dd className="tabular font-mono text-[11.5px] break-words text-text">{v}</dd>
            </div>
          ))}
      </dl>
      {(media.slug || m.sourceUrl) && (
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[12px]">
          {media.slug && (
            <Link href={`/media/${media.slug}`} className="inline-flex items-center gap-1 text-muted hover:text-text">
              <ScanLine className="size-3.5" /> Details page
            </Link>
          )}
          {m.sourceUrl && (
            <a href={m.sourceUrl} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-muted hover:text-text">
              <ExternalLink className="size-3.5" /> Source
            </a>
          )}
        </div>
      )}
    </Section>
  );
}

/** All inspector sections relevant to the loaded media. */
export function Inspector({ onOpenFile, only }: { onOpenFile: (pane: "a" | "b") => void; only?: InspectorSection[] }) {
  const kind = useViewer((s) => s.a?.kind);
  const has = (s: InspectorSection) => !only || only.includes(s);
  if (!kind) return <p className="p-4 text-[12.5px] text-muted">Open something to see its tools and information.</p>;
  const visual = kind !== "audio";
  return (
    <div>
      {visual && has("view") && <ViewSection />}
      {kind !== "image" && has("playback") && <PlaybackSection />}
      {visual && has("adjust") && <AdjustSection />}
      {visual && has("transform") && <TransformSection />}
      {visual && has("crop") && <CropSection />}
      {visual && has("capture") && <CaptureSection />}
      {visual && has("compare") && <CompareSection onOpenFile={onOpenFile} />}
      {has("info") && <InfoSection />}
    </div>
  );
}
