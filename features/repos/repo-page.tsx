"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Check, ExternalLink, Loader2, RefreshCw, Settings2, Share2, Trash2 } from "lucide-react";
import { Breadcrumbs } from "@/components/layout/page";
import { usePreferences } from "@/lib/preferences";
import { fetchRepo, removeRepo, saveRepo, shareLink, toMediaItem, useSavedRepos, type RepoManifest } from "@/lib/repos";
import { useLightbox } from "@/components/media/lightbox-context";
import { pluralize } from "@/lib/format";
import { cn } from "@/lib/cn";
import { RepoIcon, RepoWarning, hostOf, shareRepoLink, useHydrated } from "./repo-bits";
import { RepoTile } from "./repo-tile";

const PAGE = 60;
const pill = "inline-flex h-10 items-center gap-2 rounded-full bg-white/[0.07] px-4 text-[13.5px] font-bold text-white/80 transition-colors hover:bg-white/15 hover:text-white";

function Gone({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto mt-10 max-w-xl rounded-[24px] border border-white/10 bg-white/[0.03] p-8 text-center">
      <Settings2 className="mx-auto size-7 text-white/40" />
      <div className="mt-3 text-[15px] leading-relaxed text-white/65">{children}</div>
      <Link href="/media/repos" className={cn(pill, "mt-5")}>
        My repos
      </Link>
    </div>
  );
}

/** /media/repos/[id]: one repo's media, loaded straight from its host. */
export function RepoPage({ id }: { id: string }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const { repos: enabled } = usePreferences();
  const saved = useSavedRepos().find((r) => r.id === id);
  const [data, setData] = useState<{ url: string; m?: RepoManifest; error?: string } | null>(null);
  const [nonce, setNonce] = useState(0);
  const [folder, setFolder] = useState<string | null>(null);
  const [shown, setShown] = useState(PAGE);
  const lightbox = useLightbox();
  const [shared, setShared] = useState(false);
  const allowed = !!saved && (enabled || saved.viaShare);
  const url = saved?.url;
  const viaShare = saved?.viaShare ?? false;
  const savedId = saved?.id;

  useEffect(() => {
    if (!allowed || !url) return;
    let live = true;
    fetchRepo(url, nonce > 0)
      .then((m) => {
        if (!live) return;
        setData({ url, m });
        saveRepo(url, m, viaShare); // keep the list's name, icon and count current
      })
      .catch((e: Error) => live && setData({ url, error: e.message }));
    return () => {
      live = false;
    };
  }, [allowed, url, nonce, viaShare]);

  const m = data?.url === url ? data?.m : undefined;
  const error = data?.url === url ? data?.error : undefined;
  const folders = useMemo(() => {
    const counts = new Map<string, number>();
    for (const i of m?.items ?? []) if (i.folder) counts.set(i.folder, (counts.get(i.folder) ?? 0) + 1);
    return [...counts];
  }, [m]);
  // Repo items become regular media items (still pointing at the repo's links) so the
  // site's lightbox, zoom, players and Media Viewer all work on them.
  const items = useMemo(
    () => (m && savedId ? (folder ? m.items.filter((i) => i.folder === folder) : m.items).map((i) => toMediaItem({ id: savedId, name: m.name, website: m.website }, i)) : []),
    [m, folder, savedId],
  );

  if (!hydrated) return <div className="mt-16 h-64 animate-pulse rounded-[28px] bg-white/[0.03]" />;
  if (!saved) return <Gone>This repo isn’t in this browser. Repos are saved per browser, so it may have been added somewhere else.</Gone>;
  if (!allowed)
    return (
      <Gone>
        Repos are turned off. Turn them on in <strong className="text-white">Menu → Settings → Repositories</strong> to open this one.
      </Gone>
    );

  const name = m?.name ?? saved.name;
  return (
    <div className="pt-10 pb-10 sm:pt-16">
      <Breadcrumbs items={[{ href: "/media", label: "Media" }, { href: "/media/repos", label: "My repos" }, { label: name }]} className="mb-8" />
      <header className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="flex min-w-0 items-center gap-5">
          <RepoIcon name={name} icon={m?.icon ?? saved.icon} size={96} className="shadow-[0_20px_50px_-20px_rgb(0_0_0/0.8)]" />
          <div className="min-w-0">
            <h1 className="display-xl truncate text-[44px] leading-none sm:text-[72px]">{name}</h1>
            <p className="mt-2 text-[15px] text-white/60">
              by <strong className="text-white/85">{m?.author ?? saved.author}</strong> · {pluralize(m?.items.length ?? saved.count, "item")}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={pill}
            onClick={async () => {
              if ((await shareRepoLink(shareLink(saved.url), name)) === "copied") {
                setShared(true);
                setTimeout(() => setShared(false), 1800);
              }
            }}
          >
            {shared ? <Check className="size-4 text-[#7ee8ae]" /> : <Share2 className="size-4" />} {shared ? "Link copied" : "Share"}
          </button>
          <button type="button" className={pill} onClick={() => setNonce((n) => n + 1)} aria-label="Reload this repo">
            <RefreshCw className="size-4" /> Refresh
          </button>
          {m?.website && (
            <a href={m.website} target="_blank" rel="noopener noreferrer nofollow" referrerPolicy="no-referrer" className={pill}>
              <ExternalLink className="size-4" /> Website
            </a>
          )}
          <button
            type="button"
            className={cn(pill, "hover:bg-[#ff4d6d]/20 hover:text-[#ff8a9a]")}
            onClick={() => {
              if (!confirm(`Remove ${name} from this browser?`)) return;
              removeRepo(saved.id);
              router.push("/media/repos");
            }}
          >
            <Trash2 className="size-4" /> Remove
          </button>
        </div>
      </header>
      {(m?.description ?? saved.description) && <p className="mt-6 max-w-3xl text-[16px] leading-relaxed whitespace-pre-line text-white/65">{m?.description ?? saved.description}</p>}
      <RepoWarning host={hostOf(saved.url)} className="mt-6 max-w-3xl" />

      {error ? (
        <div className="mt-10 rounded-[24px] border border-[#ff4d6d]/25 bg-[#ff4d6d]/[0.06] p-6 text-[14.5px] text-[#ffb3bf]">
          <p className="font-bold">Couldn’t load this repo.</p>
          <p className="mt-1 text-[#ffb3bf]/80">{error}</p>
        </div>
      ) : !m ? (
        <p className="mt-12 flex items-center justify-center gap-2 text-white/50">
          <Loader2 className="size-5 animate-spin" /> Loading from {hostOf(saved.url)}…
        </p>
      ) : (
        <>
          {folders.length > 0 && (
            <div className="no-scrollbar mt-10 -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0" role="tablist" aria-label="Folders">
              {[[null, m.items.length] as const, ...folders].map(([f, n]) => (
                <button
                  key={f ?? "all"}
                  type="button"
                  role="tab"
                  aria-selected={folder === f}
                  onClick={() => {
                    setFolder(f);
                    setShown(PAGE);
                  }}
                  className={cn(
                    "h-10 shrink-0 rounded-full px-4 text-[13.5px] font-bold whitespace-nowrap transition-colors",
                    folder === f ? "bg-white text-[#140c18]" : "bg-white/[0.07] text-white/70 hover:bg-white/15 hover:text-white",
                  )}
                >
                  {f ?? "All"} <span className="opacity-50">{n}</span>
                </button>
              ))}
            </div>
          )}
          {items.length ? (
            <ul className="mt-8 grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 sm:gap-x-4 lg:grid-cols-4 2xl:grid-cols-5">
              {items.slice(0, shown).map((item, i) => (
                <li key={item.id}>
                  <RepoTile item={item} onOpen={() => lightbox.open(items, i)} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-12 text-center text-white/45">This repo is empty.</p>
          )}
          {shown < items.length && (
            <div className="mt-10 text-center">
              <button type="button" className={pill} onClick={() => setShown((s) => s + PAGE)}>
                Show more ({items.length - shown} left)
              </button>
            </div>
          )}
          {m.skipped > 0 && <p className="mt-8 text-center text-[12.5px] text-white/35">{pluralize(m.skipped, "entry", "entries")} in this repo couldn’t be shown (broken or unsupported links).</p>}
        </>
      )}
    </div>
  );
}
