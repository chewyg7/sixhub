"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, Image as ImageIcon, Loader2, Music2, Plus, Video } from "lucide-react";
import { fetchRepo, repoId, saveRepo, useSavedRepos, type RepoManifest } from "@/lib/repos";
import { pluralize } from "@/lib/format";
import { RepoIcon, RepoWarning, hostOf, useHydrated } from "./repo-bits";

/**
 * /media/repos/add?url=…: the page a shared repo link opens. Works even with
 * repos turned off in Settings; adding from here unlocks only this one repo.
 */
export function RepoAdd({ url }: { url: string }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const saved = useSavedRepos().find((r) => r.id === repoId(url));
  const [data, setData] = useState<{ m?: RepoManifest; error?: string } | null>(null);
  const [agreed, setAgreed] = useState(false);

  useEffect(() => {
    if (!url) return;
    let live = true;
    fetchRepo(url)
      .then((m) => live && setData({ m }))
      .catch((e: Error) => live && setData({ error: e.message }));
    return () => {
      live = false;
    };
  }, [url]);

  const m = data?.m;
  const counts = m && { image: m.items.filter((i) => i.kind === "image").length, video: m.items.filter((i) => i.kind === "video").length, audio: m.items.filter((i) => i.kind === "audio").length };
  const previews = m?.items.filter((i) => i.thumbnail || i.kind === "image").slice(0, 8) ?? [];

  return (
    <div className="mx-auto max-w-2xl pt-12 pb-16 sm:pt-20">
      <p className="kicker mb-4 text-center">Shared repo</p>
      {!url ? (
        <p className="text-center text-white/60">This link is missing the repo it should open.</p>
      ) : data?.error ? (
        <div className="rounded-[28px] border border-[#ff4d6d]/25 bg-[#ff4d6d]/[0.06] p-8 text-center">
          <p className="text-[17px] font-bold text-[#ffb3bf]">Couldn’t open this repo</p>
          <p className="mt-2 text-[14.5px] text-[#ffb3bf]/80">{data.error}</p>
          <p className="mt-4 text-[12.5px] break-all text-white/35">{url}</p>
        </div>
      ) : !m || !counts ? (
        <p className="flex items-center justify-center gap-2 py-16 text-white/50">
          <Loader2 className="size-5 animate-spin" /> Loading from {hostOf(url)}…
        </p>
      ) : (
        <article className="relative overflow-hidden rounded-[32px] border border-white/10 bg-white/[0.03] p-6 sm:p-9">
          <div aria-hidden className="absolute inset-x-0 -top-24 -z-10 mx-auto h-56 w-[80%] rounded-full bg-[radial-gradient(closest-side,rgb(255_79_163/0.22),transparent)] blur-2xl" />
          <div className="flex flex-col items-center text-center">
            <RepoIcon name={m.name} icon={m.icon} size={104} className="shadow-[0_24px_60px_-20px_rgb(0_0_0/0.9)]" />
            <h1 className="display-xl mt-5 text-[44px] leading-none sm:text-[64px]">{m.name}</h1>
            <p className="mt-2 text-[15px] text-white/60">
              by <strong className="text-white/90">{m.author}</strong>
            </p>
            {m.description && <p className="mt-4 max-w-lg text-[15.5px] leading-relaxed whitespace-pre-line text-white/70">{m.description}</p>}
            <p className="mt-5 flex flex-wrap justify-center gap-2 text-[13px] text-white/65">
              {counts.image > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.07] px-3 py-1.5">
                  <ImageIcon className="size-3.5" /> {pluralize(counts.image, "image")}
                </span>
              )}
              {counts.video > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.07] px-3 py-1.5">
                  <Video className="size-3.5" /> {pluralize(counts.video, "video")}
                </span>
              )}
              {counts.audio > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.07] px-3 py-1.5">
                  <Music2 className="size-3.5" /> {pluralize(counts.audio, "audio file")}
                </span>
              )}
            </p>
          </div>

          {previews.length > 0 && (
            <ul className="mt-7 grid grid-cols-4 gap-2" aria-label="Preview">
              {previews.map((p) => (
                <li key={p.id} className="aspect-square overflow-hidden rounded-xl bg-white/[0.05]">
                  {/* eslint-disable-next-line @next/next/no-img-element -- third-party preview, straight from the repo's link */}
                  <img src={p.thumbnail ?? p.url} alt="" loading="lazy" referrerPolicy="no-referrer" className="size-full object-cover" />
                </li>
              ))}
            </ul>
          )}

          <RepoWarning host={hostOf(url)} className="mt-7" />

          {hydrated && saved ? (
            <Link href={`/media/repos/${saved.id}`} className="mt-6 flex h-13 items-center justify-center gap-2 rounded-2xl bg-white text-[15px] font-bold text-[#140c18]">
              Open repo <ArrowRight className="size-4" />
            </Link>
          ) : (
            <>
              <label className="mt-6 flex cursor-pointer items-start gap-2.5 text-[14px] text-white/80">
                <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 size-4 shrink-0 accent-[#ff4fa3]" />I understand this repo isn’t from GTA 6 Hub, and I trust the person who shared it.
              </label>
              <button
                type="button"
                disabled={!agreed || !hydrated}
                onClick={() => {
                  const r = saveRepo(url, m, true);
                  router.push(`/media/repos/${r.id}`);
                }}
                className="mt-4 flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-white text-[15px] font-bold text-[#140c18] transition-opacity disabled:opacity-35"
              >
                <Plus className="size-4" /> Add to my repos
              </button>
            </>
          )}
          <p className="mt-4 text-center text-[12.5px] text-white/40">Saved in this browser only.</p>
        </article>
      )}
    </div>
  );
}
