"use client";

import { useState } from "react";
import { Camera, ChevronFirst, ChevronLast, Pause, PictureInPicture2, Play, Repeat, StepBack, StepForward, Volume1, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatFps, formatSmpte, formatTimecode } from "@/lib/format";
import { usePipSupported } from "@/lib/hooks/use-client";
import { IconButton } from "@/components/ui/icon-button";
import { Popover } from "@/components/ui/popover";
import { Tooltip } from "@/components/ui/tooltip";
import { Scrubber } from "@/components/media/player/scrubber";
import { useViewer } from "../store";
import { player } from "../controller";
import { parseTimeInput } from "../lib/sources";
import { useViewerActions } from "../use-actions";

export const SPEEDS = [0.1, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];

export function SpeedControl({ compact }: { compact?: boolean }) {
  const rate = useViewer((s) => s.playback.rate);
  const [custom, setCustom] = useState("");
  return (
    <Popover
      label="Playback speed"
      trigger={(p) => (
        <Tooltip content="Playback speed">
          <button
            {...p}
            type="button"
            aria-label={`Playback speed ${rate}×`}
            className={cn("tabular h-8 rounded-md px-2 font-mono text-[12px] text-text transition-colors hover:bg-surface-hover", compact && "px-1.5")}
          >
            {+rate.toFixed(3)}×
          </button>
        </Tooltip>
      )}
    >
      {(close) => (
        <div className="w-[220px]">
          <p className="eyebrow px-1 pb-1.5 text-[10.5px]">Speed</p>
          <div className="grid grid-cols-4 gap-1">
            {SPEEDS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  player.setRate(s);
                  close();
                }}
                aria-pressed={rate === s}
                className={cn("tabular h-8 rounded-md font-mono text-[12px] transition-colors", rate === s ? "bg-text text-bg" : "bg-surface-3 text-text hover:bg-surface-hover")}
              >
                {s}×
              </button>
            ))}
          </div>
          <form
            className="mt-2 flex gap-1"
            onSubmit={(e) => {
              e.preventDefault();
              const v = parseFloat(custom);
              if (v > 0) {
                player.setRate(v);
                setCustom("");
                close();
              }
            }}
          >
            <input
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              inputMode="decimal"
              placeholder="Custom (0.06–16)"
              aria-label="Custom playback speed"
              className="h-8 min-w-0 flex-1 rounded-md border border-border bg-surface px-2 font-mono text-[12px] outline-none focus:border-border-strong"
            />
            <button type="submit" className="h-8 rounded-md bg-surface-3 px-2.5 text-[12px] font-medium hover:bg-surface-hover">
              Set
            </button>
          </form>
        </div>
      )}
    </Popover>
  );
}

function Timecode() {
  const time = useViewer((s) => s.playback.time);
  const frame = useViewer((s) => s.playback.frame);
  const duration = useViewer((s) => s.playback.duration);
  const kind = useViewer((s) => s.a?.kind);
  const fps = useViewer((s) => s.a?.meta.fps ?? 30);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [invalid, setInvalid] = useState(false);
  const isVideo = kind === "video";
  const shown = isVideo ? frame / fps : time;

  if (editing) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const t = parseTimeInput(value, fps);
          if (t === null || t < 0) {
            setInvalid(true);
            return;
          }
          player.seek(t);
          setEditing(false);
        }}
      >
        <input
          autoFocus
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setInvalid(false);
          }}
          onBlur={() => setEditing(false)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              setEditing(false);
            }
          }}
          aria-label="Go to time or frame (e.g. 12.5, 0:12.5, 00:00:12:15 or f370)"
          aria-invalid={invalid}
          className={cn("tabular h-8 w-[168px] rounded-md border bg-surface px-2 font-mono text-[12.5px] outline-none", invalid ? "border-danger" : "border-border-strong")}
        />
      </form>
    );
  }

  return (
    <Tooltip content="Click to go to a time or frame">
      <button
        type="button"
        onClick={() => {
          setValue(formatTimecode(shown));
          setEditing(true);
        }}
        className="tabular flex h-8 items-center gap-2 rounded-md px-2 font-mono text-[12.5px] transition-colors hover:bg-surface-hover"
        aria-label={`Current time ${formatTimecode(shown)}${isVideo ? `, frame ${frame}` : ""}. Click to jump to a time or frame.`}
      >
        <span className="text-text">{formatTimecode(shown, duration >= 3600)}</span>
        <span className="text-faint">/ {formatTimecode(duration, duration >= 3600)}</span>
      </button>
    </Tooltip>
  );
}

function FrameReadout() {
  const frame = useViewer((s) => s.playback.frame);
  const fps = useViewer((s) => s.a?.meta.fps ?? 30);
  const fpsSource = useViewer((s) => s.a?.meta.fpsSource);
  const duration = useViewer((s) => s.playback.duration);
  const total = Math.max(0, Math.round(duration * fps) - 1);
  return (
    <div className="tabular hidden items-center gap-3 font-mono text-[12px] text-muted md:flex" aria-live="off">
      <span title="Frame number">
        F <span className="text-text">{frame}</span>
        <span className="text-faint">/{total}</span>
      </span>
      <span className="hidden text-faint xl:inline" title="SMPTE timecode">
        {formatSmpte(frame, fps)}
      </span>
      <span
        title={fpsSource === "assumed" ? "Frame rate not known yet — assumed 30 fps until it's measured during playback" : `Frame rate (${fpsSource})`}
        className={cn(fpsSource === "assumed" && "text-warning")}
      >
        {formatFps(fps)}
        {fpsSource === "assumed" && "?"}
      </span>
    </div>
  );
}

function Volume() {
  const volume = useViewer((s) => s.playback.volume);
  const muted = useViewer((s) => s.playback.muted);
  const Icon = muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;
  return (
    <div className="group/vol hidden items-center sm:flex">
      <IconButton label={muted ? "Unmute" : "Mute"} shortcut="M" size="icon-sm" onClick={player.toggleMute}>
        <Icon />
      </IconButton>
      <input
        type="range"
        aria-label="Volume"
        min={0}
        max={1}
        step={0.01}
        value={muted ? 0 : volume}
        onChange={(e) => player.setVolume(Number(e.target.value))}
        className="range w-0 opacity-0 transition-[width,opacity] duration-200 group-focus-within/vol:w-20 group-focus-within/vol:opacity-100 group-hover/vol:w-20 group-hover/vol:opacity-100"
        style={{ "--fill": `${(muted ? 0 : volume) * 100}%` } as React.CSSProperties}
      />
    </div>
  );
}

export function Transport() {
  const media = useViewer((s) => s.a);
  const playing = useViewer((s) => s.playback.playing);
  const time = useViewer((s) => s.playback.time);
  const duration = useViewer((s) => s.playback.duration);
  const buffered = useViewer((s) => s.playback.buffered);
  const loop = useViewer((s) => s.playback.loop);
  const fps = useViewer((s) => s.a?.meta.fps ?? 30);
  const pip = usePipSupported();
  const actions = useViewerActions();
  if (!media || media.kind === "image") return null;
  const isVideo = media.kind === "video";

  return (
    <div className="border-t border-divider bg-surface px-2 pt-1 pb-[calc(env(safe-area-inset-bottom)+8px)] sm:px-3 lg:pb-2" role="group" aria-label="Playback controls">
      <Scrubber
        duration={duration}
        current={time}
        buffered={buffered}
        onSeek={player.seek}
        storyboard={media.storyboard}
        fps={isVideo ? fps : undefined}
        step={isVideo ? 1 / fps : 1}
        bigStep={1}
        precise
        accent
        label="Timeline"
        className="h-5"
      />
      <div className="flex items-center gap-0.5">
        <IconButton label="Go to start" shortcut="Home" size="icon-sm" onClick={player.toStart} className="hidden sm:inline-flex">
          <ChevronFirst />
        </IconButton>
        {isVideo && (
          <IconButton label="Previous frame" shortcut="←" size="icon-sm" onClick={() => player.stepFrame(-1)}>
            <StepBack />
          </IconButton>
        )}
        <IconButton label={playing ? "Pause" : "Play"} shortcut="Space" size="icon" onClick={player.toggle} className="text-text">
          {playing ? <Pause className="fill-current" /> : <Play className="fill-current" />}
        </IconButton>
        {isVideo && (
          <IconButton label="Next frame" shortcut="→" size="icon-sm" onClick={() => player.stepFrame(1)}>
            <StepForward />
          </IconButton>
        )}
        <IconButton label="Go to end" shortcut="End" size="icon-sm" onClick={player.toEnd} className="hidden sm:inline-flex">
          <ChevronLast />
        </IconButton>
        <Timecode />
        <div className="mx-1 hidden h-4 w-px bg-divider md:block" />
        {isVideo && <FrameReadout />}
        <div className="flex-1" />
        <SpeedControl />
        <IconButton label={loop ? "Loop on" : "Loop off"} size="icon-sm" pressed={loop} onClick={() => player.setLoop(!loop)} className="hidden sm:inline-flex">
          <Repeat />
        </IconButton>
        <Volume />
        {isVideo && (
          <IconButton label="Capture frame (save PNG)" shortcut="S" size="icon-sm" onClick={() => actions.captureFrame("download")}>
            <Camera />
          </IconButton>
        )}
        {isVideo && pip && (
          <IconButton label="Picture in picture" size="icon-sm" onClick={() => player.pip().catch(() => {})} className="hidden sm:inline-flex">
            <PictureInPicture2 />
          </IconButton>
        )}
      </div>
    </div>
  );
}
