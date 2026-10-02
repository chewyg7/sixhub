import type { MediaItem } from "@/types/content";
import { CATEGORY_BY_SLUG } from "@/data/categories";
import { aspectRatioLabel, formatBitrate, formatBytes, formatDate, formatDuration, formatFps, formatMegapixels, formatResolution } from "@/lib/format";

export function mediaMetadataRows(item: MediaItem): [string, string][] {
  const rows: [string, string | undefined | false][] = [
    ["Type", `${CATEGORY_BY_SLUG[item.category]?.singular} (${item.kind})`],
    ["Published", formatDate(item.datePublished)],
    ["Added", formatDate(item.dateAdded)],
    ["Source", item.source.label],
    item.width ? ["Resolution", `${formatResolution(item.width, item.height)} px`] : ["Resolution", false],
    item.width ? ["Aspect ratio", aspectRatioLabel(item.width, item.height)] : ["Aspect ratio", false],
    item.kind === "image" && item.width ? ["Megapixels", formatMegapixels(item.width, item.height)] : ["Megapixels", false],
    item.video ? ["Duration", formatDuration(item.video.duration)] : item.audio ? ["Duration", formatDuration(item.audio.duration)] : ["Duration", false],
    item.video ? ["Frame rate", formatFps(item.video.fps)] : ["Frame rate", false],
    item.video?.frameCount ? ["Frames", item.video.frameCount.toLocaleString("en-US")] : ["Frames", false],
    item.video?.videoCodec ? ["Video codec", item.video.videoCodec] : ["Video codec", false],
    item.video?.audioCodec ? ["Audio codec", `${item.video.audioCodec}${item.video.audioSampleRate ? ` · ${item.video.audioSampleRate / 1000} kHz` : ""}`] : ["Audio codec", false],
    item.audio?.codec
      ? ["Codec", `${item.audio.codec}${item.audio.sampleRate ? ` · ${item.audio.sampleRate / 1000} kHz` : ""}${item.audio.channels === 2 ? " · stereo" : ""}`]
      : ["Codec", false],
    item.video?.bitrate ? ["Bitrate", formatBitrate(item.video.bitrate)] : item.audio?.bitrate ? ["Bitrate", formatBitrate(item.audio.bitrate)] : ["Bitrate", false],
    ["File type", item.original.mimeType],
    ["File size", formatBytes(item.original.bytes)],
    ["Filename", item.original.filename],
    item.original.hasAlpha ? ["Transparency", "Yes (alpha channel)"] : ["Transparency", false],
  ];
  return rows.filter((r): r is [string, string] => Boolean(r[1]));
}

export function MetadataTable({ item }: { item: MediaItem }) {
  return (
    <dl className="divide-y divide-divider text-[13px]">
      {mediaMetadataRows(item).map(([k, v]) => (
        <div key={k} className="grid grid-cols-[120px_1fr] gap-4 py-2">
          <dt className="text-muted">{k}</dt>
          <dd className="tabular font-mono text-[12.5px] break-words text-text">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
