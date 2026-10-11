"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, Link2, Loader2, Plus, Settings2, Share2, Trash2 } from "lucide-react";
import { Breadcrumbs } from "@/components/layout/page";
import { usePreferences } from "@/lib/preferences";
import { fetchRepo, removeRepo, repoId, saveRepo, shareLink, useSavedRepos, type SavedRepo } from "@/lib/repos";
import { pluralize } from "@/lib/format";
import { cn } from "@/lib/cn";
import { RepoIcon, RepoWarning, hostOf, shareRepoLink, useHydrated } from "./repo-bits";

function RepoCard({ repo }: { repo: SavedRepo }) {
  const [shared, setShared] = useState(false);
  const [confirm, setConfirm] = useState(false);
  return (
    <li className="group relative rounded-[24px] border border-white/10 bg-white/[0.03] p-5 transition-[border-color,background-color] duration-300 hover:border-white/20 hover:bg-white/[0.05]">
      <Link href={`/media/repos/${repo.id}`} className="flex items-center gap-4 after:absolute after:inset-0 after:rounded-[24px]">
        <RepoIcon name={repo.name} icon={repo.icon} size={60} />
        <span className="min-w-0">
          <span className="block truncate text-[18px] font-bold">{repo.name}</span>
          <span className="block truncate text-[13.5px] text-white/55">by {repo.author}</span>
        </span>
      </Link>
      {repo.description && <p className="mt-3 line-clamp-2 text-[13.5px] leading-relaxed text-white/60">{repo.description}</p>}
      <div className="relative mt-4 flex items-center justify-between gap-2">
        <p className="truncate text-[12.5px] text-white/40">
          {pluralize(repo.count, "item")} · {hostOf(repo.url)}
        </p>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={async () => {
              if ((await shareRepoLink(shareLink(repo.url), repo.name)) === "copied") {
                setShared(true);
                setTimeout(() => setShared(false), 1800);
              }
            }}
            aria-label={`Share ${repo.name}`}
            title={shared ? "Link copied" : "Share"}
            className="flex size-9 items-center justify-center rounded-full text-white/55 transition-colors hover:bg-white/10 hover:text-white"
          >
            {shared ? <Check className="size-4 text-[#7ee8ae]" /> : <Share2 className="size-4" />}
          </button>
          {confirm ? (
            <button type="button" onClick={() => removeRepo(repo.id)} onBlur={() => setConfirm(false)} className="h-9 rounded-full bg-[#ff4d6d]/15 px-3 text-[12.5px] font-bold text-[#ff8a9a]">
              Remove?
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setConfirm(true)}
              aria-label={`Remove ${repo.name}`}
              title="Remove"
              className="flex size-9 items-center justify-center rounded-full text-white/55 transition-colors hover:bg-white/10 hover:text-white"
            >
              <Trash2 className="size-4" />
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

function AddRepo() {
  const [url, setUrl] = useState("");
  const [state, setState] = useState<{ busy: boolean; error?: string; added?: string }>({ busy: false });
  const repos = useSavedRepos();
  const add = async () => {
    const link = url.trim();
    if (!link) return;
    if (repos.some((r) => r.id === repoId(link))) return setState({ busy: false, error: "That repo is already in your list." });
    setState({ busy: true });
    try {
      const m = await fetchRepo(link, true);
      saveRepo(link, m, false);
      setUrl("");
      setState({ busy: false, added: m.name });
    } catch (e) {
      setState({ busy: false, error: (e as Error).message });
    }
  };
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        add();
      }}
      className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5"
    >
      <label htmlFor="repo-url" className="text-[15px] font-bold">
        Add a repo
      </label>
      <p className="mt-0.5 text-[13px] text-white/50">Paste a direct link to a repo’s .json file.</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Link2 className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-white/35" />
          <input
            id="repo-url"
            type="url"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://raw.githubusercontent.com/you/repo/main/repo.json"
            className="h-12 w-full rounded-2xl border border-white/10 bg-black/25 pr-4 pl-10 text-[14.5px] text-white outline-none placeholder:text-white/25 focus-visible:border-accent"
          />
        </div>
        <button type="submit" disabled={state.busy || !url.trim()} className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-white px-5 text-[14.5px] font-bold text-[#140c18] transition-opacity disabled:opacity-40">
          {state.busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Add repo
        </button>
      </div>
      {state.error && <p className="mt-2.5 text-[13px] text-[#ff8a9a]">{state.error}</p>}
      {state.added && <p className="mt-2.5 text-[13px] text-[#7ee8ae]">Added {state.added}.</p>}
    </form>
  );
}

/** /media/repos: the repos saved in this browser. */
export function MyRepos() {
  const hydrated = useHydrated();
  const { repos: enabled } = usePreferences();
  const saved = useSavedRepos();
  const visible = enabled ? saved : saved.filter((r) => r.viaShare);

  return (
    <div className="pt-10 pb-10 sm:pt-16">
      <Breadcrumbs items={[{ href: "/media", label: "Media" }, { label: "My repos" }]} className="mb-6" />
      <h1 className="display-xl text-[56px] leading-[0.95] sm:text-[96px]">My repos</h1>
      <p className="mt-4 max-w-2xl text-[16px] leading-relaxed text-white/60">Media lists that other people host, kept in this browser only. Use another browser (or clear this site’s data) and they’re gone.</p>
      <RepoWarning className="mt-6 max-w-3xl" />

      {!hydrated ? (
        <div className="mt-8 h-40 animate-pulse rounded-[24px] bg-white/[0.03]" />
      ) : (
        <>
          {!enabled && (
            <div className="mt-8 flex max-w-3xl flex-col gap-3 rounded-[24px] border border-white/10 bg-white/[0.03] p-5 sm:flex-row sm:items-center">
              <Settings2 className="size-6 shrink-0 text-white/50" />
              <p className="flex-1 text-[14px] leading-relaxed text-white/65">
                Repos are turned off. Turn them on in <strong className="text-white">Menu → Settings → Repositories</strong> to add repos by link.
                {visible.length > 0 && " Repos you added from share links still open below."}
              </p>
            </div>
          )}
          {enabled && <AddRepo />}
          {visible.length > 0 ? (
            <ul className={cn("mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3")}>
              {visible.map((r) => (
                <RepoCard key={r.id} repo={r} />
              ))}
            </ul>
          ) : (
            enabled && <p className="mt-10 text-center text-[14.5px] text-white/45">No repos yet. Add one by link above, or open a repo someone shared with you.</p>
          )}
        </>
      )}

      <p className="mt-16 text-center">
        <Link href="/media/repos/guide" className="text-[12px] text-white/25 transition-colors hover:text-white/70">
          How do I make a repo?
        </Link>
      </p>
    </div>
  );
}
